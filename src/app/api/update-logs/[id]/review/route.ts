// src/app/api/update-logs/[id]/review/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const Schema = z.object({
  govReviewStatus: z.enum(['APPROVED', 'REJECTED']),
  govReviewNotes:  z.string().optional().nullable(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:approve');
  if (isErrorResponse(user)) return user;

  const log = await prisma.updateLog.findUnique({ where: { id: params.id } });
  if (!log) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (!log.requiresGovReview) return NextResponse.json({ error: 'This log does not require governance review' }, { status: 400 });
  if (log.govReviewStatus !== 'PENDING') return NextResponse.json({ error: 'Already reviewed' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });

  const updated = await prisma.updateLog.update({
    where: { id: params.id },
    data: {
      govReviewStatus:  parsed.data.govReviewStatus,
      govReviewNotes:   parsed.data.govReviewNotes ?? null,
      govReviewedById:  user.id,
      govReviewedAt:    new Date(),
    },
  });

  await audit({
    action: parsed.data.govReviewStatus === 'APPROVED' ? 'APPROVE' : 'REJECT',
    module: 'update_logs', user, recordId: params.id, recordCode: log.logCode,
    orderId:   log.orderId   ?? undefined,
    govItemId: log.govItemId ?? undefined,
    notes: `${parsed.data.govReviewStatus} gov review${parsed.data.govReviewNotes ? `: ${parsed.data.govReviewNotes}` : ''}`,
  });

  return NextResponse.json({ data: updated });
}
