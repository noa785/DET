// src/app/api/order-descriptions/import/route.ts
// POST /api/order-descriptions/import  (multipart/form-data  field: file)
// Bulk-upserts OrderDescription records.
// Match strategy: each row carries `legacyOrderId` (e.g. SU-SS-001).
//   We find the Order whose `notes` contains "Legacy ID: <legacyOrderId>".
//   Fallback: also accept `orderCode` (e.g. ORD-0001) if user prefers explicit match.
// Returns { imported, updated, skipped, total, errors[], insertErrors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

// Row validation schema
const ImportRowSchema = z.object({
  legacyOrderId:      z.string().optional().nullable(),
  orderCode:          z.string().optional().nullable(),
  objective:          z.string().max(5000).optional().nullable(),
  scope:              z.string().max(5000).optional().nullable(),
  rationale:          z.string().max(5000).optional().nullable(),
  governanceImpact:   z.string().max(5000).optional().nullable(),
  affectedUnit:       z.string().max(200).optional().nullable(),
  relatedPolicies:    z.string().max(2000).optional().nullable(),
  requiredEvidence:   z.string().max(5000).optional().nullable(),
  risks:              z.string().max(5000).optional().nullable(),
}).refine(d => (d.legacyOrderId && d.legacyOrderId.trim()) || (d.orderCode && d.orderCode.trim()), {
  message: 'Either legacyOrderId or orderCode is required',
});

type ImportRow = z.infer<typeof ImportRowSchema>;

// Column aliases
const ALIASES: Record<string, string> = {
  'legacyorderid':    'legacyOrderId',  'legacy order id': 'legacyOrderId', 'legacyid': 'legacyOrderId', 'legacy id': 'legacyOrderId',
  'ordercode':        'orderCode',      'order code':      'orderCode',
  'objective':        'objective',
  'scope':            'scope',
  'rationale':        'rationale',
  'governanceimpact': 'governanceImpact','governance impact': 'governanceImpact',
  'affectedunit':     'affectedUnit',   'affected unit':   'affectedUnit',
  'relatedpolicies':  'relatedPolicies','related policies':'relatedPolicies',
  'requiredevidence': 'requiredEvidence','required evidence':'requiredEvidence',
  'risks':            'risks',
};

// Allow up to 60 seconds for large imports
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  // Parse multipart
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded (field: file)' }, { status: 400 });

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .xlsx, .xls, or .csv files are accepted' }, { status: 400 });
  }

  // Read file
  const buf = Buffer.from(await file.arrayBuffer());
  const wb  = XLSX.read(buf, { type: 'buffer', cellDates: true });
  const sheetName = wb.SheetNames.find(n => !n.toLowerCase().includes('template') && !n.toLowerCase().includes('summary') && !n.toLowerCase().includes('instructions') && !n.toLowerCase().includes('reference')) ?? wb.SheetNames[0];
  const ws  = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (raw.length === 0) {
    return NextResponse.json({ error: 'No data rows found in the spreadsheet', imported: 0, updated: 0, skipped: 0, errors: [] }, { status: 400 });
  }

  // Normalize headers
  function normalizeRow(rawRow: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const normalized = String(k).toLowerCase().trim();
      const field = ALIASES[normalized];
      if (field) out[field] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  }

  // Validate rows
  const results: { row: number; status: 'ok' | 'error'; errors?: string[] }[] = [];
  const validRows: { rowNum: number; data: ImportRow }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const normalized = normalizeRow(raw[i]);
    const rowNum     = i + 2;

    // Skip fully empty rows
    const hasAny = Object.values(normalized).some(v => v !== '' && v != null);
    if (!hasAny) continue;

    const parsed = ImportRowSchema.safeParse(normalized);
    if (!parsed.success) {
      const errs = parsed.error.issues.map(e => `${e.path.join('.') || 'row'}: ${e.message}`);
      results.push({ row: rowNum, status: 'error', errors: errs });
      continue;
    }

    results.push({ row: rowNum, status: 'ok' });
    validRows.push({ rowNum, data: parsed.data });
  }

  // ── Pre-fetch ALL order matches in 2 queries (not 2N queries) ──
  let imported = 0;
  let updated  = 0;
  const insertErrors: string[] = [];

  // Build the lookup keys
  const orderCodes = validRows
    .map(v => v.data.orderCode?.trim())
    .filter((c): c is string => !!c);
  const legacyIds = validRows
    .map(v => v.data.legacyOrderId?.trim())
    .filter((c): c is string => !!c);

  // ONE query for all explicit orderCodes
  const ordersByCode = orderCodes.length > 0
    ? await prisma.order.findMany({
        where: { orderCode: { in: orderCodes }, isDeleted: false },
        select: { id: true, orderCode: true, notes: true },
      })
    : [];
  const codeToId = new Map(ordersByCode.map(o => [o.orderCode, o.id]));
  const codeToOrderCode = new Map(ordersByCode.map(o => [o.orderCode, o.orderCode]));

  // ONE query for all orders that might match legacy IDs (fetch the small
  // subset of orders that have any legacy id in their notes; then map in JS)
  const ordersWithLegacy = legacyIds.length > 0
    ? await prisma.order.findMany({
        where: {
          isDeleted: false,
          notes: { contains: 'Legacy ID:' },
        },
        select: { id: true, orderCode: true, notes: true },
      })
    : [];

  // Build legacyId -> [orderId, orderCode] map (in JS, instant)
  const legacyToOrders = new Map<string, { id: string; orderCode: string }[]>();
  for (const o of ordersWithLegacy) {
    if (!o.notes) continue;
    const match = o.notes.match(/Legacy ID:\s*([^\s|]+)/);
    if (!match) continue;
    const lid = match[1];
    const arr = legacyToOrders.get(lid) ?? [];
    arr.push({ id: o.id, orderCode: o.orderCode });
    legacyToOrders.set(lid, arr);
  }

  // Resolve every row to an orderId
  type Resolved = {
    rowNum: number;
    orderId: string;
    orderCodeFound: string;
    data: ImportRow;
  };
  const resolved: Resolved[] = [];

  for (const { rowNum, data: row } of validRows) {
    let orderId: string | null = null;
    let orderCodeFound: string | null = null;

    if (row.orderCode && row.orderCode.trim()) {
      const id = codeToId.get(row.orderCode.trim());
      if (id) {
        orderId = id;
        orderCodeFound = codeToOrderCode.get(row.orderCode.trim()) ?? null;
      }
    }

    if (!orderId && row.legacyOrderId && row.legacyOrderId.trim()) {
      const legacy = row.legacyOrderId.trim();
      const matches = legacyToOrders.get(legacy) ?? [];
      if (matches.length === 1) {
        orderId = matches[0].id;
        orderCodeFound = matches[0].orderCode;
      } else if (matches.length > 1) {
        insertErrors.push(`Row ${rowNum}: legacyOrderId "${legacy}" matched ${matches.length} orders — skipped`);
        continue;
      }
    }

    if (!orderId) {
      const ref = row.orderCode || row.legacyOrderId || '(none)';
      insertErrors.push(`Row ${rowNum}: order not found for "${ref}"`);
      continue;
    }

    resolved.push({ rowNum, orderId, orderCodeFound: orderCodeFound ?? '', data: row });
  }

  if (resolved.length > 0) {
    try {
      // ONE query: which orderIds already have a description?
      const orderIds = resolved.map(r => r.orderId);
      const existingDescs = await prisma.orderDescription.findMany({
        where: { orderId: { in: orderIds } },
        select: { orderId: true },
      });
      const hasDescSet = new Set(existingDescs.map(d => d.orderId));

      // Split: new vs existing
      const toCreate = resolved.filter(r => !hasDescSet.has(r.orderId));
      const toUpdate = resolved.filter(r =>  hasDescSet.has(r.orderId));

      // Bulk-create the new descriptions in ONE query
      if (toCreate.length > 0) {
        const result = await prisma.orderDescription.createMany({
          data: toCreate.map(r => ({
            orderId:           r.orderId,
            objective:         r.data.objective         ?? null,
            scope:             r.data.scope             ?? null,
            rationale:         r.data.rationale         ?? null,
            governanceImpact:  r.data.governanceImpact  ?? null,
            affectedUnit:      r.data.affectedUnit      ?? null,
            relatedPolicies:   r.data.relatedPolicies   ?? null,
            requiredEvidence:  r.data.requiredEvidence  ?? null,
            risks:             r.data.risks             ?? null,
            lastEditedById:    user.id,
          })),
          skipDuplicates: true,
        });
        imported = result.count;
      }

      // Update existing ones (small loop — typically empty on first import)
      for (const r of toUpdate) {
        try {
          await prisma.orderDescription.update({
            where: { orderId: r.orderId },
            data: {
              objective:         r.data.objective         ?? null,
              scope:             r.data.scope             ?? null,
              rationale:         r.data.rationale         ?? null,
              governanceImpact:  r.data.governanceImpact  ?? null,
              affectedUnit:      r.data.affectedUnit      ?? null,
              relatedPolicies:   r.data.relatedPolicies   ?? null,
              requiredEvidence:  r.data.requiredEvidence  ?? null,
              risks:             r.data.risks             ?? null,
              lastEditedById:    user.id,
            },
          });
          updated++;
        } catch (e: any) {
          insertErrors.push(`Row ${r.rowNum}: update failed — ${e.message}`);
        }
      }
    } catch (e: any) {
      insertErrors.push(`Batch upsert failed: ${e.message}`);
    }
  }

  const skipped = results.filter(r => r.status === 'error').length;
  const errors  = results
    .filter(r => r.status === 'error')
    .map(r => ({ row: r.row, messages: r.errors ?? [] }));

  await audit({
    action:   'IMPORT',
    module:   'order_descriptions',
    user,
    recordId: 'bulk',
    notes:    `Description import: ${imported} created, ${updated} updated, ${skipped} skipped from ${file.name}`,
  });

  return NextResponse.json({
    imported,
    updated,
    skipped,
    total:  raw.length,
    errors: errors.slice(0, 50),
    insertErrors: insertErrors.slice(0, 50),
  }, { status: (imported + updated) > 0 ? 201 : 200 });
}
