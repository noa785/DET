// src/app/api/orders/import/route.ts
// POST /api/orders/import  (multipart/form-data  field: file)
// Accepts .xlsx or .csv, validates every row, creates orders in DB
// Returns { imported, skipped, errors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { computeRAG, computePlannedPercent } from '@/lib/business-logic/orders';

// ── Row validation schema ─────────────────────────────────────
const ImportRowSchema = z.object({
  name:             z.string().min(1).max(500).trim(),
  type:             z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).default('TASK'),
  status:           z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).default('NOT_STARTED'),
  priority:         z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  unitCode:         z.string().optional().nullable(),
  projectCode:      z.string().optional().nullable(),
  ownerEmail:       z.string().email().optional().nullable().or(z.literal('')),
  startDate:        z.string().optional().nullable(),
  dueDate:          z.string().optional().nullable(),
  percentComplete:  z.coerce.number().int().min(0).max(100).default(0),
  notes:            z.string().max(2000).optional().nullable(),
  links:            z.string().max(1000).optional().nullable(),
  dependencies:     z.string().max(500).optional().nullable(),
});

type ImportRow = z.infer<typeof ImportRowSchema>;

// ── Column aliases (header → field name) ─────────────────────
const ALIASES: Record<string, string> = {
  'name':             'name',      'name*':          'name',
  'title':            'name',
  'type':             'type',      'type*':          'type',
  'status':           'status',
  'priority':         'priority',
  'unitcode':         'unitCode',  'unit code':      'unitCode',  'unit':     'unitCode',
  'projectcode':      'projectCode','project code':  'projectCode','project':  'projectCode',
  'owneremail':       'ownerEmail','owner email':    'ownerEmail', 'owner':    'ownerEmail',
  'startdate':        'startDate', 'start date':     'startDate',  'start':    'startDate',
  'duedate':          'dueDate',   'due date':       'dueDate',    'due':      'dueDate',
  'percentcomplete':  'percentComplete','% complete': 'percentComplete','%':   'percentComplete','percent': 'percentComplete',
  'notes':            'notes',
  'links':            'links',
  'dependencies':     'dependencies',
};

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:create');
  if (isErrorResponse(user)) return user;

  // ── Parse multipart ──────────────────────────────────────────
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

  // ── Read file → raw rows ─────────────────────────────────────
  const buf  = Buffer.from(await file.arrayBuffer());
  const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });

  // Use first non-template sheet, or first sheet
  const sheetName = wb.SheetNames.find(n => !n.toLowerCase().includes('template') && !n.toLowerCase().includes('summary')) ?? wb.SheetNames[0];
  const ws   = wb.Sheets[sheetName];
  const raw  = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (raw.length === 0) {
    return NextResponse.json({ error: 'No data rows found in the spreadsheet', imported: 0, skipped: 0, errors: [] }, { status: 400 });
  }

  // ── Normalize headers ────────────────────────────────────────
  function normalizeRow(rawRow: Record<string, any>): Record<string, any> {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const normalized = k.toLowerCase().trim();
      const field = ALIASES[normalized];
      if (field) out[field] = typeof v === 'string' ? v.trim() : v;
    }
    return out;
  }

  // ── Load lookup data once ────────────────────────────────────
  const [units, projects, users] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, code: true } }),
    prisma.project.findMany({ select: { id: true, code: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true } }),
  ]);

  const unitMap    = new Map(units.map(u => [u.code?.toUpperCase() ?? '', u.id]));
  const projectMap = new Map(projects.map(p => [p.code?.toUpperCase() ?? '', p.id]));
  const userMap    = new Map(users.map(u => [u.email.toLowerCase(), u.id]));

  // ── Validate all rows first (dry-run style) ──────────────────
  const results: { row: number; status: 'ok' | 'error'; errors?: string[] }[] = [];
  const validRows: (ImportRow & { _unitId?: string; _projectId?: string; _ownerId?: string })[] = [];

  for (let i = 0; i < raw.length; i++) {
    const normalized = normalizeRow(raw[i]);
    const rowNum     = i + 2; // +2 because row 1 = header

    // Skip empty rows
    if (!normalized.name) { results.push({ row: rowNum, status: 'error', errors: ['Empty name — row skipped'] }); continue; }

    const parsed = ImportRowSchema.safeParse(normalized);
    if (!parsed.success) {
      const errs = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      results.push({ row: rowNum, status: 'error', errors: errs });
      continue;
    }

    const d = parsed.data;

    // Resolve foreign keys
    const unitId    = d.unitCode    ? unitMap.get(d.unitCode.toUpperCase())    ?? undefined : undefined;
    const projectId = d.projectCode ? projectMap.get(d.projectCode.toUpperCase()) ?? undefined : undefined;
    const ownerId   = d.ownerEmail  ? userMap.get(d.ownerEmail.toLowerCase())   ?? undefined : undefined;

    const rowErrors: string[] = [];
    if (d.unitCode    && !unitId)    rowErrors.push(`Unit code "${d.unitCode}" not found`);
    if (d.projectCode && !projectId) rowErrors.push(`Project code "${d.projectCode}" not found`);
    if (d.ownerEmail  && !ownerId)   rowErrors.push(`User email "${d.ownerEmail}" not found`);
    if (d.startDate && d.dueDate && d.dueDate < d.startDate) rowErrors.push('Due date must be after start date');

    if (rowErrors.length) {
      results.push({ row: rowNum, status: 'error', errors: rowErrors });
      continue;
    }

    results.push({ row: rowNum, status: 'ok' });
    validRows.push({ ...d, _unitId: unitId, _projectId: projectId, _ownerId: ownerId });
  }

  // ── Insert valid rows ────────────────────────────────────────
  let imported = 0;
  const insertErrors: string[] = [];

  for (const row of validRows) {
    try {
      const seq = await prisma.sequence.update({
        where: { id: 'order' },
        data:  { current: { increment: 1 } },
      });
      const orderCode = `${seq.prefix}-${String(seq.current).padStart(seq.padding, '0')}`;

      const ragAuto = computeRAG({
        status:          row.status,
        percentComplete: row.percentComplete,
        dueDate:         row.dueDate ?? undefined,
      });

      await prisma.order.create({
        data: {
          orderCode,
          type:             row.type,
          name:             row.name,
          unitId:           row._unitId    ?? null,
          projectId:        row._projectId ?? null,
          ownerId:          row._ownerId   ?? null,
          status:           row.status,
          priority:         row.priority,
          percentComplete:  row.percentComplete,
          startDate:        row.startDate ? new Date(row.startDate) : null,
          dueDate:          row.dueDate   ? new Date(row.dueDate)   : null,
          notes:            row.notes        ?? null,
          links:            row.links        ?? null,
          dependencies:     row.dependencies ?? null,
          ragAuto,
          plannedPercent:   computePlannedPercent(row.startDate ?? undefined, row.dueDate ?? undefined),
          createdById:      user.id,
          updatedById:      user.id,
        },
      });

      imported++;
    } catch (e: any) {
      insertErrors.push(`DB error: ${e.message}`);
    }
  }

  const skipped = results.filter(r => r.status === 'error').length;
  const errors  = results
    .filter(r => r.status === 'error')
    .map(r => ({ row: r.row, messages: r.errors ?? [] }));

  await audit({
    action:   'IMPORT',
    module:   'orders',
    user,
    recordId: 'bulk',
    notes:    `Import: ${imported} created, ${skipped} skipped from ${file.name}`,
  });

  return NextResponse.json({
    imported,
    skipped,
    total:  raw.length,
    errors: errors.slice(0, 50), // cap error list
    insertErrors: insertErrors.slice(0, 10),
  }, { status: imported > 0 ? 201 : 200 });
}
