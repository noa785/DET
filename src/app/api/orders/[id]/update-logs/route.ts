// src/app/api/orders/[id]/update-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const CreateUpdateLogSchema = z.object({
  updateType:         z.enum(['PROGRESS_UPDATE','SCOPE_CHANGE','DATE_CHANGE','OWNER_CHANGE','GOVERNANCE_UPDATE','POLICY_CHANGE','EVIDENCE_ADDED','NOTE','SYSTEM_CHANGE']),
  title:              z.string().min(1).max(300).trim(),
  description:        z.string().optional().nullable(),
  fieldChanged:       z.string().optional().nullable(),
  oldValue:           z.string().optional().nullable(),
  newValue:           z.string().optional().nullable(),
  changeReason:       z.string().optional().nullable(),
  requiresGovReview:  z.boolean().default(false),
  evidenceLinks:      z.string().optional().nullable(),
});

// ── POST /api/orders/[id]/update-logs ─────────────────────────
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const order = await prisma.order.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { id: true, orderCode: true, name: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = CreateUpdateLogSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  // Generate log code
  const seq = await prisma.sequence.update({
    where: { id: 'update_log' },
    data:  { current: { increment: 1 } },
  });
  const logCode = `UL-${String(seq.current).padStart(seq.padding, '0')}`;

  const log = await prisma.updateLog.create({
    data: {
      logCode,
      orderId:           params.id,
      updateType:        data.updateType,
      title:             data.title,
      description:       data.description ?? null,
      fieldChanged:      data.fieldChanged ?? null,
      oldValue:          data.oldValue ?? null,
      newValue:          data.newValue ?? null,
      changeReason:      data.changeReason ?? null,
      requiresGovReview: data.requiresGovReview,
      govReviewStatus:   data.requiresGovReview ? 'PENDING' : 'N/A',
      evidenceLinks:     data.evidenceLinks ?? null,
      createdById:       user.id,
    },
    include: {
      createdBy: { select: { name: true, initials: true } },
    },
  });

  await audit({
    action: 'CREATE', module: 'update_logs', user,
    recordId: log.id, recordCode: logCode,
    orderId: params.id,
    notes: `Update log: "${data.title}" on order ${order.orderCode}`,
  });

  return NextResponse.json({ data: log }, { status: 201 });
}

// ── GET /api/orders/[id]/update-logs ──────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const logs = await prisma.updateLog.findMany({
    where: { orderId: params.id },
    orderBy: { createdAt: 'desc' },
    take: 100,
    include: {
      createdBy:     { select: { name: true, initials: true } },
      govReviewedBy: { select: { name: true } },
    },
  });

  return NextResponse.json({ data: logs });
}
