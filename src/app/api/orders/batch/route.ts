// src/app/api/orders/batch/route.ts
// POST /api/orders/batch
// Body: { updates: [{ id, ...fields }] }
// Validates each, runs updates in parallel, returns summary.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';
import { computeRAG, computePlannedPercent, shouldIncrementReschedule } from '@/lib/business-logic/orders';

const ItemSchema = z.object({
  id:              z.string().cuid(),
  name:            z.string().min(1).max(500).optional(),
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).optional(),
  unitId:          z.string().nullable().optional(),
  projectId:       z.string().nullable().optional(),
  ownerId:         z.string().nullable().optional(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).optional(),
  startDate:       z.string().nullable().optional(),
  dueDate:         z.string().nullable().optional(),
  percentComplete: z.number().int().min(0).max(100).optional(),
  ragOverride:     z.enum(['RED','AMBER','GREEN','BLUE','GREY']).nullable().optional(),
  notes:           z.string().nullable().optional(),
}).strict();

const BatchSchema = z.object({
  updates: z.array(ItemSchema).min(1).max(200),
});

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const body   = await req.json().catch(() => null);
  const parsed = BatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const { updates } = parsed.data;

  // Fetch all existing records in one query
  const ids = updates.map(u => u.id);
  const existing = await prisma.order.findMany({
    where: { id: { in: ids }, isDeleted: false },
    select: {
      id: true, orderCode: true, name: true, status: true, priority: true,
      percentComplete: true, dueDate: true, startDate: true,
      unitId: true, ownerId: true, projectId: true, ragOverride: true,
      rescheduleCount: true,
    },
  });

  const existingMap = new Map(existing.map(e => [e.id, e]));

  const results: { id: string; success: boolean; error?: string }[] = [];

  await Promise.all(updates.map(async (update) => {
    const ex = existingMap.get(update.id);
    if (!ex) {
      results.push({ id: update.id, success: false, error: 'Not found' });
      return;
    }

    try {
      const newStatus  = update.status          ?? ex.status;
      const newPct     = update.percentComplete  ?? ex.percentComplete;
      const newDue     = update.dueDate          ?? ex.dueDate?.toISOString();
      const newOverride= update.ragOverride      ?? ex.ragOverride;
      const ragAuto    = computeRAG({ status: newStatus, percentComplete: newPct, dueDate: newDue, ragOverride: newOverride as any });
      const reschedule = (update.dueDate !== undefined && shouldIncrementReschedule(ex.dueDate?.toISOString(), update.dueDate ?? undefined)) ? 1 : 0;

      await prisma.order.update({
        where: { id: update.id },
        data: {
          ...(update.name            !== undefined && { name: update.name }),
          ...(update.type            !== undefined && { type: update.type }),
          ...(update.unitId          !== undefined && { unitId: update.unitId }),
          ...(update.projectId       !== undefined && { projectId: update.projectId }),
          ...(update.ownerId         !== undefined && { ownerId: update.ownerId }),
          ...(update.priority        !== undefined && { priority: update.priority }),
          ...(update.status          !== undefined && { status: update.status }),
          ...(update.startDate       !== undefined && { startDate: update.startDate ? new Date(update.startDate) : null }),
          ...(update.dueDate         !== undefined && { dueDate: update.dueDate ? new Date(update.dueDate) : null }),
          ...(update.percentComplete !== undefined && { percentComplete: update.percentComplete }),
          ...(update.ragOverride     !== undefined && { ragOverride: update.ragOverride }),
          ...(update.notes           !== undefined && { notes: update.notes }),
          ragAuto,
          plannedPercent: computePlannedPercent(
            (update.startDate ?? ex.startDate?.toISOString()) ?? undefined,
            (update.dueDate   ?? ex.dueDate?.toISOString())   ?? undefined,
          ),
          rescheduleCount: { increment: reschedule },
          updatedById: user.id,
        },
      });

      // Audit significant changes
      const oldObj = { name: ex.name, status: ex.status, priority: ex.priority, percentComplete: ex.percentComplete };
      const newObj = {
        name: update.name ?? ex.name,
        status: update.status ?? ex.status,
        priority: update.priority ?? ex.priority,
        percentComplete: update.percentComplete ?? ex.percentComplete,
      };
      const diffs = diffObjects(oldObj, newObj, Object.keys(oldObj));
      for (const diff of diffs) {
        await audit({
          action: diff.field === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
          module: 'orders', user,
          recordId: update.id, recordCode: ex.orderCode,
          field: diff.field, oldValue: diff.oldValue, newValue: diff.newValue,
          notes: 'Batch grid update',
          orderId: update.id,
        });
      }

      results.push({ id: update.id, success: true });
    } catch (e: any) {
      results.push({ id: update.id, success: false, error: e.message });
    }
  }));

  const failed  = results.filter(r => !r.success);
  const success = results.filter(r => r.success);

  return NextResponse.json({
    updated:  success.length,
    failed:   failed.length,
    total:    updates.length,
    errors:   failed.length > 0 ? failed : undefined,
  }, { status: failed.length === updates.length ? 400 : 200 });
}
