// src/app/api/gov-tasks/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const CreateSchema = z.object({
  govItemId:          z.string(),
  changeRequestId:    z.string().optional().nullable(),
  title:              z.string().min(1).max(400).trim(),
  type:               z.enum(['POLICY_REVIEW','PROCEDURE_UPDATE','COMPLIANCE_CHECK','TRAINING_REQUIRED','EVIDENCE_COLLECTION','SIGN_OFF_REQUIRED','IMPACT_ASSESSMENT','DOCUMENTATION']),
  description:        z.string().optional().nullable(),
  status:             z.enum(['TODO','IN_PROGRESS','AWAITING_APPROVAL','DONE','CANCELLED']).default('TODO'),
  priority:           z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  assigneeId:         z.string().optional().nullable(),
  dueDate:            z.string().optional().nullable(),
  requiredEvidence:   z.string().optional().nullable(),
  approvalRequired:   z.boolean().default(false),
  approverId:         z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;
  const tasks = await prisma.governanceTask.findMany({
    where: { isDeleted: false },
    include: { govItem: { select: { govCode: true, title: true } }, assignee: { select: { name: true } } },
    orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
  });
  return NextResponse.json({ data: tasks });
}

export async function POST(req: NextRequest) {
  const user = await requirePermission('governance:edit');
  if (isErrorResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });

  const data = parsed.data;
  const seq = await prisma.sequence.update({ where: { id: 'gov_task' }, data: { current: { increment: 1 } } });
  const taskCode = `GT-${String(seq.current).padStart(seq.padding, '0')}`;

  const task = await prisma.governanceTask.create({
    data: {
      taskCode,
      govItemId:        data.govItemId,
      changeRequestId:  data.changeRequestId ?? null,
      title:            data.title,
      type:             data.type,
      description:      data.description ?? null,
      status:           data.status,
      priority:         data.priority,
      assigneeId:       data.assigneeId  ?? null,
      approverId:       data.approverId  ?? null,
      dueDate:          data.dueDate     ? new Date(data.dueDate) : null,
      requiredEvidence: data.requiredEvidence ?? null,
      approvalRequired: data.approvalRequired,
      isOverdue:        false,
      createdById:      user.id,
      updatedById:      user.id,
    },
  });

  await audit({ action: 'CREATE', module: 'gov_tasks', user, recordId: task.id, recordCode: taskCode, govItemId: data.govItemId, notes: `Created task "${data.title}"` });
  return NextResponse.json({ data: task }, { status: 201 });
}
