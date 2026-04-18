// src/app/api/orders/bulk/route.ts
// Bulk operations: PATCH (multi-update) from Grid Editor
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';
import { computeRAG, computePlannedPercent, shouldIncrementReschedule } from '@/lib/business-logic/orders';

const BulkItemSchema = z.object({
  id:              z.string(),                          // existing id
  name:            z.string().min(1).max(500).trim().optional(),
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).optional(),
  unitId:          z.string().nullable().optional(),
  projectId:       z.string().nullable().optional(),
  ownerId:         z.string().nullable().optional(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).optional(),
  startDate:       z.string().nullable().optional(),
  dueDate:         z.string().nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  notes:           z.string().nullable().optional(),
});

const BulkCreateItemSchema = z.object({
  _isNew:          z.literal(true),
  name:            z.string().min(1).max(500).trim(),
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).default('TASK'),
  unitId:          z.string().nullable().optional(),
  projectId:       z.string().nullable().optional(),
  ownerId:         z.string().nullable().optional(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).default('NOT_STARTED'),
  startDate:       z.string().nullable().optional(),
  dueDate:         z.string().nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).default(0),
  notes:           z.string().nullable().optional(),
  _tempId:         z.string().optional(), // client-side temp id for matching response
});

const BulkPayloadSchema = z.object({
  updates: z.array(BulkItemSchema).max(100).optional().default([]),
  creates: z.array(BulkCreateItemSchema).max(50).optional().default([]),
  deletes: z.array(z.string()).max(50).optional().default([]),
});

// ── POST /api/orders/bulk ──────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const body   = await req.json().catch(() => null);
  const parsed = BulkPayloadSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { updates, creates, deletes } = parsed.data;
  const results: { updated: number; created: unknown[]; deleted: number; errors: string[] } = {
    updated: 0, created: [], deleted: 0, errors: [],
  };

  // ── 1. UPDATES ─────────────────────────────────────────────
  await Promise.allSettled(updates.map(async item => {
    try {
      const existing = await prisma.order.findUnique({
        where: { id: item.id, isDeleted: false },
      });
      if (!existing) { results.errors.push(`Not found: ${item.id}`); return; }

      const rescheduleIncrement =
        item.dueDate !== undefined &&
        shouldIncrementReschedule(existing.dueDate?.toISOString(), item.dueDate ?? undefined)
          ? 1 : 0;

      const newStatus = item.status ?? existing.status;
      const newPct    = item.percentComplete ?? existing.percentComplete;
      const newDue    = item.dueDate ?? existing.dueDate?.toISOString();
      const ragAuto   = computeRAG({ status: newStatus, percentComplete: newPct, dueDate: newDue });

      await prisma.order.update({
        where: { id: item.id },
        data: {
          ...(item.name            !== undefined && { name: item.name }),
          ...(item.type            !== undefined && { type: item.type }),
          ...(item.unitId          !== undefined && { unitId:    item.unitId }),
          ...(item.projectId       !== undefined && { projectId: item.projectId }),
          ...(item.ownerId         !== undefined && { ownerId:   item.ownerId }),
          ...(item.priority        !== undefined && { priority:  item.priority }),
          ...(item.status          !== undefined && { status:    item.status }),
          ...(item.startDate       !== undefined && { startDate: item.startDate ? new Date(item.startDate) : null }),
          ...(item.dueDate         !== undefined && { dueDate:   item.dueDate   ? new Date(item.dueDate)   : null }),
          ...(item.percentComplete !== undefined && { percentComplete: item.percentComplete }),
          ...(item.notes           !== undefined && { notes: item.notes }),
          ragAuto,
          plannedPercent: computePlannedPercent(
            (item.startDate ?? existing.startDate?.toISOString()) ?? undefined,
            (item.dueDate   ?? existing.dueDate?.toISOString())   ?? undefined,
          ),
          rescheduleCount: { increment: rescheduleIncrement },
          updatedById: user.id,
        },
      });

      // Audit diff
      const oldObj = { name: existing.name, status: existing.status, priority: existing.priority, percentComplete: existing.percentComplete };
      const newObj = { name: item.name ?? existing.name, status: newStatus, priority: item.priority ?? existing.priority, percentComplete: newPct };
      const diffs  = diffObjects(oldObj, newObj, Object.keys(oldObj));
      for (const d of diffs) {
        await audit({
          action: d.field === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
          module: 'orders', user, recordId: item.id,
          recordCode: existing.orderCode,
          field: d.field, oldValue: d.oldValue, newValue: d.newValue,
          notes: 'Bulk grid update', orderId: item.id,
        });
      }

      results.updated++;
    } catch (e) {
      results.errors.push(`Update failed: ${item.id}`);
    }
  }));

  // ── 2. CREATES ─────────────────────────────────────────────
  const canCreate = await requirePermission('orders:create');
  if (!isErrorResponse(canCreate)) {
    await Promise.allSettled(creates.map(async item => {
      try {
        const seq = await prisma.sequence.update({
          where: { id: 'order' },
          data:  { current: { increment: 1 } },
        });
        const orderCode = `${seq.prefix}-${String(seq.current).padStart(seq.padding, '0')}`;
        const ragAuto = computeRAG({
          status: item.status, percentComplete: item.percentComplete,
          dueDate: item.dueDate ?? undefined,
        });
        const order = await prisma.order.create({
          data: {
            orderCode, type: item.type, name: item.name,
            unitId: item.unitId ?? null, projectId: item.projectId ?? null,
            ownerId: item.ownerId ?? null, priority: item.priority,
            status: item.status,
            startDate: item.startDate ? new Date(item.startDate) : null,
            dueDate:   item.dueDate   ? new Date(item.dueDate)   : null,
            percentComplete: item.percentComplete,
            plannedPercent: computePlannedPercent(item.startDate ?? undefined, item.dueDate ?? undefined),
            ragAuto, createdById: user.id, updatedById: user.id,
            notes: item.notes ?? null,
          },
        });
        await audit({ action: 'CREATE', module: 'orders', user, recordId: order.id, recordCode: orderCode, notes: `Bulk grid create: "${item.name}"` });
        results.created.push({ ...order, _tempId: item._tempId });
      } catch (e) {
        results.errors.push(`Create failed: ${item.name}`);
      }
    }));
  }

  // ── 3. DELETES (soft) ───────────────────────────────────────
  if (deletes.length > 0) {
    const canDelete = await requirePermission('orders:delete');
    if (!isErrorResponse(canDelete)) {
      await Promise.allSettled(deletes.map(async id => {
        try {
          const existing = await prisma.order.findUnique({ where: { id, isDeleted: false }, select: { orderCode: true, name: true } });
          if (!existing) return;
          await prisma.order.update({ where: { id }, data: { isDeleted: true, deletedAt: new Date(), updatedById: user.id } });
          await audit({ action: 'DELETE', module: 'orders', user, recordId: id, recordCode: existing.orderCode, notes: `Bulk delete: "${existing.name}"` });
          results.deleted++;
        } catch {
          results.errors.push(`Delete failed: ${id}`);
        }
      }));
    }
  }

  return NextResponse.json({ data: results });
}
