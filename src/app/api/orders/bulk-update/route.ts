// src/app/api/orders/bulk-update/route.ts
// POST /api/orders/bulk-update  (multipart/form-data field: file)
// Accepts .xlsx or .csv with orderCode column
// Matches existing orders by orderCode and updates changed fields
// Returns { updated, skipped, notFound, errors[] }

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const UpdateRowSchema = z.object({
  orderCode:       z.string().min(1).trim(), // required — used to find the record
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).optional(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  percentComplete: z.coerce.number().int().min(0).max(100).optional(),
  dueDate:         z.string().optional().nullable(),
  notes:           z.string().max(2000).optional().nullable(),
  ragOverride:     z.enum(['GREEN','AMBER','RED','']).optional().nullable(),
  ownerEmail:      z.string().email().optional().nullable().or(z.literal('')),
});

const ALIASES: Record<string, string> = {
  'ordercode':      'orderCode', 'order code':      'orderCode', 'order': 'orderCode', 'code': 'orderCode',
  'status':         'status',
  'priority':       'priority',
  'percentcomplete':'percentComplete', '% complete':'percentComplete', '%':'percentComplete',
  'duedate':        'dueDate',  'due date':  'dueDate',
  'notes':          'notes',
  'ragoverride':    'ragOverride', 'rag':'ragOverride', 'rag override':'ragOverride',
  'owneremail':     'ownerEmail', 'owner email':'ownerEmail', 'owner':'ownerEmail',
};

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:edit');
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
    return NextResponse.json({ error: 'No data rows found', updated: 0, skipped: 0, notFound: 0 });
  }

  if (raw.length > 500) {
    return NextResponse.json({ error: 'Maximum 500 rows per bulk update request' }, { status: 400 });
  }

  // Load user lookups
  const users = await prisma.user.findMany({ where: { isActive: true }, select: { id: true, email: true } });
  const userMap = new Map(users.map(u => [u.email?.toLowerCase() ?? '', u.id]));

  let updatedCount = 0;
  let skippedCount = 0;
  let notFoundCount = 0;
  const errors: { row: number; code: string; messages: string[] }[] = [];

  for (let i = 0; i < raw.length; i++) {
    const rowNum = i + 2;
    const rawRow = raw[i];

    // Normalize keys
    const normalized: Record<string, any> = {};
    for (const [k, v] of Object.entries(rawRow)) {
      const alias = ALIASES[k.toLowerCase().trim()];
      if (alias) normalized[alias] = typeof v === 'string' ? v.trim() : v;
    }

    const parsed = UpdateRowSchema.safeParse(normalized);
    if (!parsed.success) {
      const msgs = parsed.error.issues.map(i => `${i.path.join('.')}: ${i.message}`);
      errors.push({ row: rowNum, code: String(normalized.orderCode ?? ''), messages: msgs });
      skippedCount++;
      continue;
    }

    const d = parsed.data;

    // Find the order
    const existing = await prisma.order.findFirst({
      where: { orderCode: d.orderCode, isDeleted: false },
      select: { id: true, orderCode: true, status: true, priority: true, percentComplete: true },
    });

    if (!existing) {
      errors.push({ row: rowNum, code: d.orderCode, messages: [`Order "${d.orderCode}" not found`] });
      notFoundCount++;
      continue;
    }

    // Resolve ownerEmail → ownerId
    let ownerId: string | null | undefined;
    if (d.ownerEmail !== undefined) {
      if (d.ownerEmail === '' || d.ownerEmail === null) {
        ownerId = null;
      } else {
        ownerId = userMap.get(d.ownerEmail.toLowerCase());
        if (!ownerId) {
          errors.push({ row: rowNum, code: d.orderCode, messages: [`Owner email "${d.ownerEmail}" not found`] });
          skippedCount++;
          continue;
        }
      }
    }

    // Build update payload (only changed fields)
    const updateData: any = {};
    if (d.status          !== undefined && d.status          !== existing.status)          updateData.status          = d.status;
    if (d.priority        !== undefined && d.priority        !== existing.priority)        updateData.priority        = d.priority;
    if (d.percentComplete !== undefined && d.percentComplete !== existing.percentComplete) updateData.percentComplete = d.percentComplete;
    if (d.dueDate         !== undefined) updateData.dueDate     = d.dueDate ? new Date(d.dueDate) : null;
    if (d.notes           !== undefined) updateData.notes        = d.notes;
    if (d.ragOverride     !== undefined) updateData.ragOverride  = d.ragOverride || null;
    if (ownerId           !== undefined) updateData.ownerId      = ownerId;

    if (Object.keys(updateData).length === 0) {
      skippedCount++; // no changes
      continue;
    }

    // Check reschedule
    if (updateData.dueDate && existing.status !== 'DONE') {
      updateData.rescheduleCount = { increment: 1 };
    }

    await prisma.order.update({ where: { id: existing.id }, data: updateData });

    await audit({
      action:     'UPDATE',
      module:     'orders',
      user,
      recordId:   existing.id,
      recordCode: existing.orderCode,
      notes:      `Bulk Excel update: changed ${Object.keys(updateData).join(', ')}`,
    });

    updatedCount++;
  }

  return NextResponse.json({
    updated:  updatedCount,
    skipped:  skippedCount,
    notFound: notFoundCount,
    total:    raw.length,
    errors,
  });
}
