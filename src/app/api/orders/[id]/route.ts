// src/app/api/orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';
import { computeRAG, computePlannedPercent, shouldIncrementReschedule } from '@/lib/business-logic/orders';

const PatchOrderSchema = z.object({
  name:            z.string().min(1).max(500).trim().optional(),
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).optional(),
  unitId:          z.string().nullable().optional(),
  projectId:       z.string().nullable().optional(),
  parentId:        z.string().nullable().optional(),
  ownerId:         z.string().nullable().optional(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).optional(),
  startDate:       z.string().nullable().optional(),
  dueDate:         z.string().nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  ragOverride:     z.enum(['RED','AMBER','GREEN','BLUE','GREY']).nullable().optional(),
  ragOverrideNote: z.string().nullable().optional(),
  dependencies:    z.string().nullable().optional(),
  links:           z.string().nullable().optional(),
  notes:           z.string().nullable().optional(),
  govReviewRequired: z.boolean().optional(),
  projectType: z.enum(['SYSTEM_BUILD', 'DATA_ANALYSIS', 'OTHER']).nullable().optional(),
});

// ── GET /api/orders/[id] ───────────────────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const order = await prisma.order.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      unit:        { select: { code: true, name: true, colorHex: true } },
      project:     { select: { code: true, name: true, phase: true } },
      owner:       { select: { id: true, name: true, email: true } },
      description: true,
      updateLogs:  { orderBy: { createdAt: 'desc' }, take: 50, include: { createdBy: { select: { name: true, initials: true } } } },
      children:    { where: { isDeleted: false }, include: { owner: { select: { name: true } } } },
    },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: order });
}

// ── PATCH /api/orders/[id] ─────────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.order.findUnique({ where: { id: params.id, isDeleted: false } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  // Detect reschedule
  const rescheduleIncrement =
    data.dueDate !== undefined &&
    shouldIncrementReschedule(existing.dueDate?.toISOString(), data.dueDate ?? undefined)
    ? 1 : 0;

  // Recompute RAG
  const newStatus  = data.status ?? existing.status;
  const newPct     = data.percentComplete ?? existing.percentComplete;
  const newDue     = data.dueDate ?? existing.dueDate?.toISOString();
  const newOverride= data.ragOverride ?? existing.ragOverride;
  const ragAuto = computeRAG({ status: newStatus, percentComplete: newPct, dueDate: newDue, ragOverride: newOverride as any });

  const updated = await prisma.order.update({
    where: { id: params.id },
    data: {
      ...(data.name            !== undefined && { name: data.name }),
      ...(data.type            !== undefined && { type: data.type }),
      ...(data.unitId          !== undefined && { unitId: data.unitId }),
      ...(data.projectId       !== undefined && { projectId: data.projectId }),
      ...(data.ownerId         !== undefined && { ownerId: data.ownerId }),
      ...(data.priority        !== undefined && { priority: data.priority }),
      ...(data.status          !== undefined && { status: data.status }),
      ...(data.startDate       !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.dueDate         !== undefined && { dueDate:   data.dueDate   ? new Date(data.dueDate)   : null }),
      ...(data.percentComplete !== undefined && { percentComplete: data.percentComplete }),
      ...(data.ragOverride     !== undefined && { ragOverride: data.ragOverride }),
      ...(data.ragOverrideNote !== undefined && { ragOverrideNote: data.ragOverrideNote }),
      ...(data.dependencies    !== undefined && { dependencies: data.dependencies }),
      ...(data.links           !== undefined && { links: data.links }),
      ...(data.notes           !== undefined && { notes: data.notes }),
      ...(data.govReviewRequired !== undefined && { govReviewRequired: data.govReviewRequired }),
      ...(data.projectType !== undefined && { projectType: data.projectType }),
      ragAuto,
      plannedPercent: computePlannedPercent(
        (data.startDate ?? existing.startDate?.toISOString()) ?? undefined,
        (data.dueDate   ?? existing.dueDate?.toISOString())   ?? undefined,
      ),
      rescheduleCount: { increment: rescheduleIncrement },
      updatedById: user.id,
    },
  });

  // Audit — log each changed field
  const oldObj = {
    name: existing.name, status: existing.status, priority: existing.priority,
    percentComplete: existing.percentComplete, dueDate: existing.dueDate?.toISOString(),
    ownerId: existing.ownerId,
  };
  const newObj = { name: updated.name, status: updated.status, priority: updated.priority,
    percentComplete: updated.percentComplete, dueDate: updated.dueDate?.toISOString(),
    ownerId: updated.ownerId,
  };
  const diffs = diffObjects(oldObj, newObj, Object.keys(oldObj));

  for (const diff of diffs) {
    const action = diff.field === 'status' ? 'STATUS_CHANGE' : 'UPDATE';
    await audit({
      action: action as any, module: 'orders', user,
      recordId: params.id, recordCode: existing.orderCode,
      field: diff.field, oldValue: diff.oldValue, newValue: diff.newValue,
      orderId: params.id,
    });
  }

  if (diffs.length === 0) {
    await audit({ action: 'UPDATE', module: 'orders', user, recordId: params.id, recordCode: existing.orderCode, notes: 'No field changes' });
  }

  return NextResponse.json({ data: updated });
}

// ── DELETE /api/orders/[id] (soft delete) ─────────────────────
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:delete');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.order.findUnique({ where: { id: params.id, isDeleted: false }, select: { orderCode: true, name: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.order.update({
    where: { id: params.id },
    data: { isDeleted: true, deletedAt: new Date(), updatedById: user.id },
  });

  await audit({ action: 'DELETE', module: 'orders', user, recordId: params.id, recordCode: existing.orderCode, notes: `Deleted "${existing.name}"` });

  return NextResponse.json({ message: `Order ${existing.orderCode} deleted` });
}
