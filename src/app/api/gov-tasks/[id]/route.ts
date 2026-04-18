// src/app/api/gov-tasks/[id]/route.ts
// GET, PATCH, DELETE a single GovernanceTask
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';

const PatchSchema = z.object({
  title:              z.string().min(1).max(400).trim().optional(),
  type:               z.enum(['POLICY_REVIEW','PROCEDURE_UPDATE','COMPLIANCE_CHECK','TRAINING_REQUIRED','EVIDENCE_COLLECTION','SIGN_OFF_REQUIRED','IMPACT_ASSESSMENT','DOCUMENTATION']).optional(),
  description:        z.string().nullable().optional(),
  status:             z.enum(['TODO','IN_PROGRESS','AWAITING_APPROVAL','DONE','CANCELLED']).optional(),
  priority:           z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  assigneeId:         z.string().nullable().optional(),
  approverId:         z.string().nullable().optional(),
  dueDate:            z.string().nullable().optional(),
  requiredEvidence:   z.string().nullable().optional(),
  completionEvidence: z.string().nullable().optional(),
  approvalRequired:   z.boolean().optional(),
  notes:              z.string().nullable().optional(),
});

// ── GET /api/gov-tasks/[id] ────────────────────────────────────
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('gov_tasks:view');
  if (isErrorResponse(user)) return user;

  const task = await prisma.governanceTask.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      govItem:  { select: { id: true, govCode: true, title: true } },
      assignee: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      createdBy:{ select: { name: true } },
    },
  });

  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: task });
}

// ── PATCH /api/gov-tasks/[id] ──────────────────────────────────
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('gov_tasks:edit');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.governanceTask.findUnique({
    where: { id: params.id, isDeleted: false },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body   = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });

  const d = parsed.data;

  // Compute isOverdue
  const newDue = d.dueDate !== undefined
    ? (d.dueDate ? new Date(d.dueDate) : null)
    : existing.dueDate;
  const newStatus = d.status ?? existing.status;
  const isOverdue = !!(newDue && newDue < new Date() && !['DONE','CANCELLED'].includes(newStatus));

  const updated = await prisma.governanceTask.update({
    where: { id: params.id },
    data: {
      ...(d.title              !== undefined && { title: d.title }),
      ...(d.type               !== undefined && { type: d.type }),
      ...(d.description        !== undefined && { description: d.description }),
      ...(d.status             !== undefined && { status: d.status }),
      ...(d.priority           !== undefined && { priority: d.priority }),
      ...(d.assigneeId         !== undefined && { assigneeId: d.assigneeId }),
      ...(d.approverId         !== undefined && { approverId: d.approverId }),
      ...(d.dueDate            !== undefined && { dueDate: d.dueDate ? new Date(d.dueDate) : null }),
      ...(d.requiredEvidence   !== undefined && { requiredEvidence: d.requiredEvidence }),
      ...(d.completionEvidence !== undefined && { completionEvidence: d.completionEvidence }),
      ...(d.approvalRequired   !== undefined && { approvalRequired: d.approvalRequired }),
      isOverdue,
    },
    include: {
      govItem:  { select: { govCode: true, title: true } },
      assignee: { select: { name: true } },
    },
  });

  // Audit diff
  const oldObj = { status: existing.status, priority: existing.priority, title: existing.title };
  const newObj = { status: newStatus, priority: d.priority ?? existing.priority, title: d.title ?? existing.title };
  const diffs  = diffObjects(oldObj, newObj, ['status','priority','title']);
  for (const diff of diffs) {
    await audit({
      action:    diff.field === 'status' ? 'STATUS_CHANGE' : 'UPDATE',
      module:    'gov_tasks',
      user,
      recordId:  params.id,
      recordCode: existing.taskCode,
      govItemId:  existing.govItemId,
      field:     diff.field,
      oldValue:  diff.oldValue,
      newValue:  diff.newValue,
    });
  }

  return NextResponse.json({ data: updated });
}

// ── DELETE /api/gov-tasks/[id] ─────────────────────────────────
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('gov_tasks:delete');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.governanceTask.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { taskCode: true, title: true, govItemId: true },
  });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.governanceTask.update({
    where: { id: params.id },
    data: { isDeleted: true },
  });

  await audit({
    action: 'DELETE', module: 'gov_tasks', user,
    recordId: params.id, recordCode: existing.taskCode,
    govItemId: existing.govItemId,
    notes: `Deleted task "${existing.title}"`,
  });

  return NextResponse.json({ message: 'Deleted' });
}
