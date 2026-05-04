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

  // Process upserts
  let imported = 0;   // newly created descriptions
  let updated  = 0;   // existing descriptions overwritten
  const insertErrors: string[] = [];

  for (const { rowNum, data: row } of validRows) {
    try {
      // Find the order
      let orderId: string | null = null;
      let orderCodeFound: string | null = null;

      if (row.orderCode && row.orderCode.trim()) {
        const o = await prisma.order.findUnique({
          where: { orderCode: row.orderCode.trim() },
          select: { id: true, orderCode: true, isDeleted: true },
        });
        if (o && !o.isDeleted) {
          orderId = o.id;
          orderCodeFound = o.orderCode;
        }
      }

      if (!orderId && row.legacyOrderId && row.legacyOrderId.trim()) {
        // Match against `notes` containing "Legacy ID: <id>"
        const legacy = row.legacyOrderId.trim();
        const candidates = await prisma.order.findMany({
          where: {
            isDeleted: false,
            notes: { contains: `Legacy ID: ${legacy}` },
          },
          select: { id: true, orderCode: true },
          take: 2,
        });
        if (candidates.length === 1) {
          orderId = candidates[0].id;
          orderCodeFound = candidates[0].orderCode;
        } else if (candidates.length > 1) {
          insertErrors.push(`Row ${rowNum}: legacyOrderId "${legacy}" matched ${candidates.length} orders — skipped`);
          continue;
        }
      }

      if (!orderId) {
        const ref = row.orderCode || row.legacyOrderId || '(none)';
        insertErrors.push(`Row ${rowNum}: order not found for "${ref}"`);
        continue;
      }

      // Upsert the description
      const existing = await prisma.orderDescription.findUnique({ where: { orderId } });

      const descData = {
        objective:         row.objective         ?? null,
        scope:             row.scope             ?? null,
        rationale:         row.rationale         ?? null,
        governanceImpact:  row.governanceImpact  ?? null,
        affectedUnit:      row.affectedUnit      ?? null,
        relatedPolicies:   row.relatedPolicies   ?? null,
        requiredEvidence:  row.requiredEvidence  ?? null,
        risks:             row.risks             ?? null,
        lastEditedById:    user.id,
      };

      if (existing) {
        await prisma.orderDescription.update({ where: { orderId }, data: descData });
        updated++;
      } else {
        await prisma.orderDescription.create({ data: { orderId, ...descData } });
        imported++;
      }

      // Audit per record (lightweight)
      await audit({
        action:   'UPDATE',
        module:   'order_descriptions',
        user,
        recordId: orderId,
        recordCode: orderCodeFound ?? undefined,
        notes:    `Description bulk-upserted from import`,
        orderId,
      }).catch(() => {});
    } catch (e: any) {
      insertErrors.push(`Row ${rowNum}: ${e.message}`);
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
