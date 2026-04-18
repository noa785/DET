// src/app/api/gov-tasks/[id]/approve/route.ts
// POST = approve or reject a governance task
// Only GOVERNANCE_ADMIN, ADMIN, SUPER_ADMIN can approve

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const Schema = z.object({
  action:  z.enum(['APPROVE', 'REJECT', 'REQUEST_CHANGES']),
  notes:   z.string().max(1000).optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:approve');
  if (isErrorResponse(user)) return user;

  const task = await prisma.governanceTask.findUnique({
    where: { id: params.id, isDeleted: false },
    include: { govItem: { select: { govCode: true } } },
  });
  if (!task) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  if (!task.approvalRequired) {
    return NextResponse.json({ error: 'This task does not require approval' }, { status: 400 });
  }
  if (task.status === 'DONE') {
    return NextResponse.json({ error: 'Task is already completed' }, { status: 400 });
  }
  if (task.status !== 'AWAITING_APPROVAL') {
    return NextResponse.json({ error: 'Task must be in AWAITING_APPROVAL status to approve' }, { status: 400 });
  }

  const body   = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed' }, { status: 422 });

  const newStatus = parsed.data.action === 'APPROVE'
    ? 'DONE'
    : parsed.data.action === 'REJECT'
    ? 'CANCELLED'
    : 'IN_PROGRESS'; // REQUEST_CHANGES = send back to in progress

  const updated = await prisma.governanceTask.update({
    where: { id: params.id },
    data: {
      status:      newStatus,
      approverId:  parsed.data.action === 'APPROVE' ? user.id : task.approverId,
      approvedAt:  parsed.data.action === 'APPROVE' ? new Date() : null,
      completionDate: parsed.data.action === 'APPROVE' ? new Date() : null,
    },
  });

  await audit({
    action:     parsed.data.action === 'APPROVE' ? 'APPROVE' : 'REJECT',
    module:     'gov_tasks',
    user,
    recordId:   params.id,
    recordCode: task.taskCode,
    govItemId:  task.govItemId,
    field:      'status',
    oldValue:   task.status,
    newValue:   newStatus,
    notes:      `${parsed.data.action}${parsed.data.notes ? ': ' + parsed.data.notes : ''}`,
  });

  return NextResponse.json({ data: updated });
}
