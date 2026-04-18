// src/app/api/governance/[id]/update-logs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const Schema = z.object({
  updateType:         z.enum(['PROGRESS_UPDATE','SCOPE_CHANGE','DATE_CHANGE','OWNER_CHANGE','GOVERNANCE_UPDATE','POLICY_CHANGE','EVIDENCE_ADDED','NOTE','SYSTEM_CHANGE']).default('GOVERNANCE_UPDATE'),
  title:              z.string().min(1).max(300).trim(),
  description:        z.string().optional().nullable(),
  fieldChanged:       z.string().optional().nullable(),
  oldValue:           z.string().optional().nullable(),
  newValue:           z.string().optional().nullable(),
  changeReason:       z.string().optional().nullable(),
  requiresGovReview:  z.boolean().default(true),
  evidenceLinks:      z.string().optional().nullable(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:edit');
  if (isErrorResponse(user)) return user;

  const item = await prisma.governanceItem.findUnique({ where: { id: params.id, isDeleted: false }, select: { id: true, govCode: true } });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });

  const data = parsed.data;
  const seq = await prisma.sequence.update({ where: { id: 'update_log' }, data: { current: { increment: 1 } } });
  const logCode = `UL-${String(seq.current).padStart(seq.padding, '0')}`;

  const log = await prisma.updateLog.create({
    data: {
      logCode,
      govItemId:         params.id,
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
  });

  await audit({ action: 'CREATE', module: 'update_logs', user, recordId: log.id, recordCode: logCode, govItemId: params.id, notes: `Update log on ${item.govCode}: "${data.title}"` });
  return NextResponse.json({ data: log }, { status: 201 });
}

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;
  const logs = await prisma.updateLog.findMany({ where: { govItemId: params.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { createdBy: { select: { name: true, initials: true } }, govReviewedBy: { select: { name: true } } } });
  return NextResponse.json({ data: logs });
}
