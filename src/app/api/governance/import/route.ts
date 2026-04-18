// src/app/api/governance/import/route.ts
// POST /api/governance/import  (multipart/form-data  field: file)
// Accepts .xlsx or .csv, validates every row, creates governance items in DB
// Returns { imported, skipped, total, errors[], insertErrors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

// ── Row validation schema ─────────────────────────────────────
const ImportRowSchema = z.object({
  title:            z.string().min(1).max(500).trim(),
  type:             z.enum(['POLICY','PROCEDURE','STANDARD','GUIDELINE','COMMITTEE_DECISION','CONTROL','COMPLIANCE_REQUIREMENT','UPDATE_ITEM']).default('POLICY'),
  status:           z.enum(['DRAFT','ACTIVE','UNDER_REVIEW','SUPERSEDED','ARCHIVED']).default('DRAFT'),
  priority:         z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  riskLevel:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  version:          z.string().max(50).default('1.0'),
  unitCode:         z.string().optional().nullable(),
  ownerEmail:       z.string().email().optional().nullable().or(z.literal('')),
  reviewerEmail:    z.string().email().optional().nullable().or(z.literal('')),
  effectiveDate:    z.string().optional().nullable(),
  nextReviewDate:   z.string().optional().nullable(),
  reviewCycleDays:  z.coerce.number().int().min(0).max(3650).optional().nullable(),
  source:           z.string().max(500).optional().nullable(),
  complianceImpact: z.string().max(2000).optional().nullable(),
  notes:            z.string().max(2000).optional().nullable(),
  evidenceLinks:    z.string().max(1000).optional().nullable(),
});

type ImportRow = z.infer<typeof ImportRowSchema>;

// ── Column aliases ────────────────────────────────────────────
const ALIASES: Record<string, string> = {
  'title':            'title',        'title*':           'title',
  'name':             'title',
  'type':             'type',         'type*':            'type',
  'status':           'status',
  'priority':         'priority',
  'risklevel':        'riskLevel',    'risk level':       'riskLevel',  'risk': 'riskLevel',
  'version':          'version',
  'unitcode':         'unitCode',     'unit code':        'unitCode',   'unit': 'unitCode',
  'owneremail':       'ownerEmail',   'owner email':      'ownerEmail', 'owner': 'ownerEmail',
  'revieweremail':    'reviewerEmail','reviewer email':   'reviewerEmail', 'reviewer': 'reviewerEmail',
  'effectivedate':    'effectiveDate','effective date':   'effectiveDate', 'effective': 'effectiveDate',
  'nextreviewdate':   'nextReviewDate','next review date':'nextReviewDate','next review': 'nextReviewDate',
  'reviewcycledays':  'reviewCycleDays','review cycle days': 'reviewCycleDays','review cycle': 'reviewCycleDays',
  'source':           'source',       'reference':        'source',
  'complianceimpact': 'complianceImpact','compliance impact': 'complianceImpact','compliance': 'complianceImpact',
  'notes':            'notes',
  'evidencelinks':    'evidenceLinks','evidence links':   'evidenceLinks','evidence': 'evidenceLinks',
};

export async function POST(req: NextRequest) {
  const user = await requirePermission('governance:create');
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

  const sheetName = wb.SheetNames.find(n =>
    !n.toLowerCase().includes('template') && !n.toLowerCase().includes('summary')
  ) ?? wb.SheetNames[0];
  const ws  = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: '' });

  if (raw.length === 0) {
    return NextResponse.json({
      error: 'No data rows found in the spreadsheet', imported: 0, skipped: 0, errors: [],
    }, { status: 400 });
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
  const [units, users] = await Promise.all([
    prisma.unit.findMany({ select: { id: true, code: true } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true } }),
  ]);

  const unitMap = new Map(units.map(u => [u.code?.toUpperCase() ?? '', u.id]));
  const userMap = new Map(users.map(u => [u.email.toLowerCase(), u.id]));

  // ── Validate all rows ────────────────────────────────────────
  type ValidRow = ImportRow & {
    _unitId?:     string;
    _ownerId?:    string;
    _reviewerId?: string;
  };

  const results: { row: number; status: 'ok' | 'error'; errors?: string[] }[] = [];
  const validRows: ValidRow[] = [];

  for (let i = 0; i < raw.length; i++) {
    const normalized = normalizeRow(raw[i]);
    const rowNum     = i + 2; // +2: row 1 = header

    if (!normalized.title) {
      results.push({ row: rowNum, status: 'error', errors: ['Empty title — row skipped'] });
      continue;
    }

    const parsed = ImportRowSchema.safeParse(normalized);
    if (!parsed.success) {
      const errs = parsed.error.issues.map(e => `${e.path.join('.')}: ${e.message}`);
      results.push({ row: rowNum, status: 'error', errors: errs });
      continue;
    }

    const d = parsed.data;
    const unitId     = d.unitCode      ? unitMap.get(d.unitCode.toUpperCase())          ?? undefined : undefined;
    const ownerId    = d.ownerEmail    ? userMap.get(d.ownerEmail.toLowerCase())         ?? undefined : undefined;
    const reviewerId = d.reviewerEmail ? userMap.get(d.reviewerEmail.toLowerCase())      ?? undefined : undefined;

    const rowErrors: string[] = [];
    if (d.unitCode      && !unitId)     rowErrors.push(`Unit code "${d.unitCode}" not found`);
    if (d.ownerEmail    && !ownerId)    rowErrors.push(`Owner email "${d.ownerEmail}" not found`);
    if (d.reviewerEmail && !reviewerId) rowErrors.push(`Reviewer email "${d.reviewerEmail}" not found`);
    if (d.effectiveDate && d.nextReviewDate && d.nextReviewDate < d.effectiveDate) {
      rowErrors.push('Next review date must be after effective date');
    }

    if (rowErrors.length) {
      results.push({ row: rowNum, status: 'error', errors: rowErrors });
      continue;
    }

    results.push({ row: rowNum, status: 'ok' });
    validRows.push({ ...d, _unitId: unitId, _ownerId: ownerId, _reviewerId: reviewerId });
  }

  // ── Insert valid rows ────────────────────────────────────────
  let imported = 0;
  const insertErrors: string[] = [];

  for (const row of validRows) {
    try {
      const seq = await prisma.sequence.update({
        where: { id: 'governance' },
        data:  { current: { increment: 1 } },
      });
      const govCode = `${seq.prefix}-${String(seq.current).padStart(seq.padding, '0')}`;

      await prisma.governanceItem.create({
        data: {
          govCode,
          title:            row.title,
          type:             row.type,
          status:           row.status,
          priority:         row.priority,
          riskLevel:        row.riskLevel,
          version:          row.version ?? '1.0',
          unitId:           row._unitId      ?? null,
          ownerId:          row._ownerId     ?? null,
          reviewerId:       row._reviewerId  ?? null,
          effectiveDate:    row.effectiveDate  ? new Date(row.effectiveDate)  : null,
          nextReviewDate:   row.nextReviewDate ? new Date(row.nextReviewDate) : null,
          reviewCycleDays:  row.reviewCycleDays ?? null,
          source:           row.source           ?? null,
          complianceImpact: row.complianceImpact ?? null,
          notes:            row.notes            ?? null,
          evidenceLinks:    row.evidenceLinks    ?? null,
          createdById:      user.id,
        },
      });
      imported++;
    } catch (e: any) {
      insertErrors.push(`DB error: ${e.message?.slice(0, 200)}`);
    }
  }

  const skipped = results.filter(r => r.status === 'error').length;
  const errors  = results
    .filter(r => r.status === 'error')
    .map(r => ({ row: r.row, messages: r.errors ?? [] }));

  await audit({
    action:   'IMPORT',
    module:   'governance',
    user,
    recordId: 'bulk',
    notes:    `Governance import: ${imported} created, ${skipped} skipped from ${file.name}`,
  });

  return NextResponse.json({
    imported,
    skipped,
    total:  raw.length,
    errors: errors.slice(0, 50),
    insertErrors: insertErrors.slice(0, 10),
  }, { status: imported > 0 ? 201 : 200 });
}
