// src/app/api/work/orders/[id]/route.ts
// DET v2: read one order's history, and update an order (drawer and grid editor).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { toDetOrder, DET_ORDER_SELECT } from '@/lib/det/server';
import { BUCKETS, GOV, SECTIONS, bucketOf, canEditSection, type Bucket, type DbStatus, type GovStatus, type SectionKey } from '@/lib/det/shared';

const PatchSchema = z.object({
  name:      z.string().trim().min(1).max(500).optional(),
  ownerName: z.string().trim().max(200).optional(),
  bucket:    z.enum(['NOT_STARTED', 'IN_PROGRESS', 'STUCK', 'DONE']).optional(),
  progress:  z.number().int().min(0).max(100).optional(),
  dueDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  section:   z.enum(['SYSTEMS_ENGINEERING', 'AUTOMATION']).optional(),
  unitCode:  z.string().trim().max(20).nullable().optional(),
  govStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED']).optional(),
  govNote:   z.string().trim().max(5000).optional(),
  points:    z.array(z.string().trim().max(1000)).max(100).optional(),
  narrative: z.string().trim().max(10000).optional(),
  note:      z.string().trim().max(2000).optional(),   // "what changed", saved in the history only
});

// GET: change history for the drawer
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  const logs = await prisma.auditLog.findMany({
    where: { orderId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
    select: { id: true, notes: true, field: true, newValue: true, userName: true, createdAt: true, action: true },
  });
  return NextResponse.json({
    data: logs.map(l => ({
      id: l.id,
      text: l.notes || (l.field ? `${l.field}: ${l.newValue ?? ''}` : l.action),
      by: l.userName ?? '',
      at: l.createdAt.toISOString(),
    })),
  });
}

// PATCH: update any of the simple fields
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  // Each team edits only its own section (see canEditSection in lib/det/shared).
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const parsed = PatchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 });
  const b = parsed.data;

  const existing = await prisma.order.findFirst({
    where: { id: params.id, isDeleted: false },
    select: { id: true, orderCode: true, status: true, percentComplete: true, govStatus: true, section: true, dueDate: true, startDate: true, rescheduleCount: true, ownerName: true, unit: { select: { code: true } } },
  });
  if (!existing) return NextResponse.json({ error: 'Order not found' }, { status: 404 });
  const fromSection = existing.section as SectionKey;
  if (!canEditSection(user.role, fromSection)) {
    return NextResponse.json({ error: `You can view ${SECTIONS[fromSection].name} but not edit it.` }, { status: 403 });
  }
  if (b.section !== undefined && b.section !== fromSection && !canEditSection(user.role, b.section)) {
    return NextResponse.json({ error: `You cannot move orders into ${SECTIONS[b.section].name}.` }, { status: 403 });
  }

  const changes: string[] = [];
  const data: Record<string, unknown> = { updatedById: user.id };

  if (b.name !== undefined) { data.name = b.name; changes.push('Title updated'); }
  if (b.ownerName !== undefined && (b.ownerName || null) !== existing.ownerName) { data.ownerName = b.ownerName || null; changes.push(`Responsible: ${b.ownerName || 'none'}`); }
  if (b.section !== undefined && b.section !== existing.section) { data.section = b.section; changes.push('Moved to another section'); }
  if (b.startDate !== undefined) {
    const nd = b.startDate ? new Date(`${b.startDate}T00:00:00Z`) : null;
    if ((nd?.getTime() ?? null) !== (existing.startDate?.getTime() ?? null)) { data.startDate = nd; changes.push(`Start date: ${b.startDate ?? 'none'}`); }
  }
  if (b.unitCode !== undefined && (b.unitCode || null) !== (existing.unit?.code ?? null)) {
    const unit = b.unitCode ? await prisma.unit.findUnique({ where: { code: b.unitCode }, select: { id: true, name: true } }) : null;
    if (b.unitCode && !unit) return NextResponse.json({ error: 'Unknown unit' }, { status: 400 });
    data.unitId = unit?.id ?? null;
    changes.push(`Unit: ${unit?.name ?? 'none'}`);
  }

  // Status and progress move together: Done means 100%, 100% means Done.
  let progress = b.progress ?? existing.percentComplete;
  let status = existing.status as DbStatus;
  if (b.bucket !== undefined && b.bucket !== bucketOf(status)) status = BUCKETS[b.bucket as Bucket].db;
  if (b.progress !== undefined && b.bucket === undefined) {
    if (progress === 100) status = 'DONE';
    else if (status === 'DONE') status = 'IN_PROGRESS';
    else if (progress > 0 && status === 'NOT_STARTED') status = 'IN_PROGRESS';
  }
  if (status === 'DONE') progress = 100;
  if (status !== existing.status) { data.status = status; changes.push(`Status: ${BUCKETS[bucketOf(status)].label}`); }
  if (progress !== existing.percentComplete) { data.percentComplete = progress; changes.push(`Progress ${existing.percentComplete}% to ${progress}%`); }

  if (b.dueDate !== undefined) {
    const next = b.dueDate ? new Date(`${b.dueDate}T00:00:00Z`) : null;
    const prev = existing.dueDate?.toISOString().slice(0, 10) ?? null;
    if (b.dueDate !== prev) {
      data.dueDate = next;
      if (prev && b.dueDate && b.dueDate > prev) data.rescheduleCount = existing.rescheduleCount + 1;
      changes.push(`Due date: ${b.dueDate ?? 'none'}`);
    }
  }
  if (b.govStatus !== undefined && b.govStatus !== existing.govStatus) {
    data.govStatus = b.govStatus;
    data.govReviewRequired = b.govStatus !== 'NOT_REQUIRED';
    changes.push(`Governance: ${GOV[b.govStatus as GovStatus].label}`);
  }
  if (b.govNote !== undefined) data.govNote = b.govNote || null;

  const desc: Record<string, unknown> = {};
  if (b.points !== undefined) { const p = b.points.filter(Boolean); desc.bulletSummary = p.length ? p.join('\n') : null; }
  if (b.narrative !== undefined) desc.narrativeSummary = b.narrative || null;
  if (Object.keys(desc).length) {
    desc.lastEditedById = user.id;
    data.description = { upsert: { create: desc, update: desc } };
  }
  if (b.note) changes.push(b.note);

  const order = await prisma.order.update({ where: { id: existing.id }, data, select: DET_ORDER_SELECT });

  if (changes.length) {
    await audit({
      action: data.status ? 'STATUS_CHANGE' : 'UPDATE', module: 'orders', user,
      recordId: existing.id, recordCode: existing.orderCode, orderId: existing.id, notes: changes.join(' · '),
    });
  }
  return NextResponse.json({ data: toDetOrder(order as never) });
}
