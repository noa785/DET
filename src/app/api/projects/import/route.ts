// src/app/api/projects/import/route.ts
// POST /api/projects/import  (multipart/form-data  field: file)
// Accepts .xlsx or .csv, validates every row, UPSERTS projects (overwrites existing by code)
// Returns { imported, updated, skipped, total, errors[], insertErrors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

// Row validation schema
const ImportRowSchema = z.object({
  code:        z.string().min(2).max(20).trim().regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, dashes only'),
  name:        z.string().min(2).max(200).trim(),
  unitCode:    z.string().optional().nullable(),
  phase:       z.enum(['INITIATION', 'PLANNING', 'EXECUTION', 'MONITORING', 'CLOSURE']).default('PLANNING'),
  startDate:   z.string().optional().nullable(),
  endDate:     z.string().optional().nullable(),
  sponsor:     z.string().max(200).optional().nullable(),
  description: z.string().max(2000).optional().nullable(),
});

type ImportRow = z.infer<typeof ImportRowSchema>;

// Column aliases (header -> field name)
const ALIASES: Record<string, string> = {
  'code':        'code',        'code*':        'code',     'project code': 'code', 'projectcode': 'code',
  'name':        'name',        'name*':        'name',     'project name': 'name', 'projectname': 'name',
  'unitcode':    'unitCode',    'unit code':    'unitCode', 'unit':         'unitCode', 'owner unit': 'unitCode',
  'phase':       'phase',
  'startdate':   'startDate',   'start date':   'startDate', 'start':       'startDate',
  'enddate':     'endDate',     'end date':     'endDate',   'end':         'endDate',
  'sponsor':     'sponsor',
  'description': 'description', 'notes':        'description',
};

export async function POST(req: NextRequest) {
  // Only admins can create/update projects
  const user = await requirePermission('admin:settings');
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

  // Read file -> raw rows
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
      if (field) {
        if (v instanceof Date) {
          out[field] = v.toISOString().slice(0, 10);
        } else {
          out[field] = typeof v === 'string' ? v.trim() : v;
        }
      }
    }
    return out;
  }

  // Load units once
  const units = await prisma.unit.findMany({ select: { id: true, code: true } });
  const unitMap = new Map(units.map(u => [u.code?.toUpperCase() ?? '', u.id]));

  // Validate all rows
  const results: { row: number; status: 'ok' | 'error'; errors?: string[] }[] = [];
  const validRows: (ImportRow & { _unitId?: string })[] = [];

  for (let i = 0; i < raw.length; i++) {
    const normalized = normalizeRow(raw[i]);
    const rowNum     = i + 2;

    // Skip empty rows
    if (!normalized.code || !normalized.name) {
      // Only report as error if some other field was filled
      const hasAny = Object.values(normalized).some(v => v !== '' && v != null);
      if (hasAny) {
        results.push({ row: rowNum, status: 'error', errors: ['Both "code" and "name" are required'] });
      }
      continue;
    }

    // Uppercase the code before validation
    if (typeof normalized.code === 'string') normalized.code = normalized.code.toUpperCase();

    const parsed = ImportRowSchema.safeParse(normalized);
    if (!parsed.success) {
      const errs = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      results.push({ row: rowNum, status: 'error', errors: errs });
      continue;
    }

    const d = parsed.data;
    const unitId = d.unitCode ? unitMap.get(d.unitCode.toUpperCase()) ?? undefined : undefined;

    const rowErrors: string[] = [];
    if (d.unitCode && !unitId) rowErrors.push(`Unit code "${d.unitCode}" not found`);
    if (d.startDate && d.endDate && d.endDate < d.startDate) rowErrors.push('End date must be after start date');

    if (rowErrors.length) {
      results.push({ row: rowNum, status: 'error', errors: rowErrors });
      continue;
    }

    results.push({ row: rowNum, status: 'ok' });
    validRows.push({ ...d, _unitId: unitId });
  }

  // Upsert (overwrite existing by code)
  let imported = 0;
  let updated  = 0;
  const insertErrors: string[] = [];

  for (const row of validRows) {
    try {
      const existing = await prisma.project.findUnique({ where: { code: row.code } });

      if (existing) {
        await prisma.project.update({
          where: { code: row.code },
          data: {
            name:        row.name,
            unitId:      row._unitId ?? null,
            phase:       row.phase,
            startDate:   row.startDate ? new Date(row.startDate) : null,
            endDate:     row.endDate   ? new Date(row.endDate)   : null,
            sponsor:     row.sponsor     ?? null,
            description: row.description ?? null,
          },
        });
        updated++;
      } else {
        await prisma.project.create({
          data: {
            code:        row.code,
            name:        row.name,
            unitId:      row._unitId ?? null,
            phase:       row.phase,
            startDate:   row.startDate ? new Date(row.startDate) : null,
            endDate:     row.endDate   ? new Date(row.endDate)   : null,
            sponsor:     row.sponsor     ?? null,
            description: row.description ?? null,
            createdById: user.id,
          },
        });
        imported++;
      }
    } catch (e: any) {
      insertErrors.push(`Row code "${row.code}": ${e.message}`);
    }
  }

  const skipped = results.filter(r => r.status === 'error').length;
  const errors  = results
    .filter(r => r.status === 'error')
    .map(r => ({ row: r.row, messages: r.errors ?? [] }));

  await audit({
    action:   'IMPORT',
    module:   'projects',
    user,
    recordId: 'bulk',
    notes:    `Project import: ${imported} created, ${updated} updated, ${skipped} skipped from ${file.name}`,
  });

  return NextResponse.json({
    imported,
    updated,
    skipped,
    total:  raw.length,
    errors: errors.slice(0, 50),
    insertErrors: insertErrors.slice(0, 10),
  }, { status: (imported + updated) > 0 ? 201 : 200 });
}
