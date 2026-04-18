// src/app/api/orders/import-preview/route.ts
// POST /api/orders/import-preview  (multipart/form-data field: file)
// Validates the file, returns a preview of what would be imported
// WITHOUT inserting anything into the database.
// Returns: { total, valid, invalid, rows[], errors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

const RowSchema = z.object({
  name:            z.string().min(1).max(500).trim(),
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).default('TASK'),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).default('NOT_STARTED'),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  unitCode:        z.string().optional().nullable(),
  projectCode:     z.string().optional().nullable(),
  ownerEmail:      z.string().email().optional().nullable().or(z.literal('')),
  startDate:       z.string().optional().nullable(),
  dueDate:         z.string().optional().nullable(),
  percentComplete: z.coerce.number().int().min(0).max(100).default(0),
  notes:           z.string().max(2000).optional().nullable(),
});

const ALIASES: Record<string, string> = {
  'name': 'name', 'name*': 'name', 'title': 'name',
  'type': 'type', 'type*': 'type',
  'status': 'status',
  'priority': 'priority',
  'unitcode': 'unitCode', 'unit code': 'unitCode', 'unit': 'unitCode',
  'projectcode': 'projectCode', 'project code': 'projectCode',
  'owneremail': 'ownerEmail', 'owner email': 'ownerEmail', 'owner': 'ownerEmail',
  'startdate': 'startDate', 'start date': 'startDate',
  'duedate': 'dueDate', 'due date': 'dueDate',
  'percentcomplete': 'percentComplete', '% complete': 'percentComplete', '%': 'percentComplete',
  'notes': 'notes',
};

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:create');
  if (isErrorResponse(user)) return user;

  let formData: FormData;
  try { formData = await req.formData(); } catch {
    return NextResponse.json({ error: 'Expected multipart/form-data' }, { status: 400 });
  }

  const file = formData.get('file') as File | null;
  if (!file) return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });

  const fileName = file.name.toLowerCase();
  if (!fileName.endsWith('.xlsx') && !fileName.endsWith('.xls') && !fileName.endsWith('.csv')) {
    return NextResponse.json({ error: 'Only .xlsx, .xls, or .csv files accepted' }, { status: 400 });
  }

  const buf  = Buffer.from(await file.arrayBuffer());
  const wb   = XLSX.read(buf, { type: 'buffer', cellDates: true });

  const sheetName = wb.SheetNames.find(n =>
    !n.toLowerCase().includes('template') && !n.toLowerCase().includes('summary')
  ) ?? wb.SheetNames[0];

  const ws  = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (raw.length === 0) {
    return NextResponse.json({ error: 'No data rows found', total: 0, valid: 0, invalid: 0, rows: [] });
  }

  // Load lookups
  const [units, projects, users] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, code: true } }),
    prisma.project.findMany({ select: { id: true, code: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true, name: true } }),
  ]);

  const unitMap    = new Map(units.map(u    => [u.code?.toLowerCase()    ?? '', u.id]));
  const projectMap = new Map(projects.map(p => [p.code?.toLowerCase()    ?? '', p.id]));
  const userMap    = new Map(users.map(u    => [u.email?.toLowerCase()   ?? '', u]));

  const previewRows: any[] = [];
  let validCount = 0;
  let invalidCount = 0;

  const limit = Math.min(raw.length, 200); // preview up to 200 rows

  for (let i = 0; i < limit; i++) {
    const rawRow = raw[i];
    const rowNum = i + 2; // 1-indexed + header

    // Normalize keys
    const normalized: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const alias = ALIASES[k.toLowerCase().trim()];
      if (alias) normalized[alias] = typeof v === 'string' ? v.trim() : v;
    }

    const parsed = RowSchema.safeParse(normalized);
    const rowErrors: string[] = [];

    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        rowErrors.push(`${issue.path.join('.')}: ${issue.message}`);
      }
      invalidCount++;
    } else {
      const d = parsed.data;

      // Lookup validations
      const unitId    = d.unitCode    ? unitMap.get(d.unitCode.toLowerCase())    : undefined;
      const projectId = d.projectCode ? projectMap.get(d.projectCode.toLowerCase()) : undefined;
      const ownerInfo = d.ownerEmail  ? userMap.get(d.ownerEmail.toLowerCase())  : undefined;

      if (d.unitCode    && !unitId)    rowErrors.push(`Unit code "${d.unitCode}" not found`);
      if (d.projectCode && !projectId) rowErrors.push(`Project code "${d.projectCode}" not found`);
      if (d.ownerEmail  && !ownerInfo) rowErrors.push(`Owner email "${d.ownerEmail}" not found`);

      if (rowErrors.length === 0) {
        validCount++;
      } else {
        invalidCount++;
      }

      previewRows.push({
        rowNum,
        valid:    rowErrors.length === 0,
        errors:   rowErrors,
        data: {
          name:            d.name,
          type:            d.type,
          status:          d.status,
          priority:        d.priority,
          unitCode:        d.unitCode   ?? '',
          unitResolved:    unitId ? units.find(u => u.id === unitId)?.code : null,
          projectCode:     d.projectCode ?? '',
          ownerEmail:      d.ownerEmail  ?? '',
          ownerName:       ownerInfo?.name ?? null,
          startDate:       d.startDate   ?? '',
          dueDate:         d.dueDate     ?? '',
          percentComplete: d.percentComplete,
        },
      });
      continue;
    }

    previewRows.push({ rowNum, valid: false, errors: rowErrors, data: normalized });
  }

  return NextResponse.json({
    fileName: file.name,
    sheetName,
    totalInFile: raw.length,
    previewing:  limit,
    valid:       validCount,
    invalid:     invalidCount,
    rows:        previewRows,
  });
}
