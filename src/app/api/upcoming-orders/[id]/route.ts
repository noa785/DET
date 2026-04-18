// src/app/api/upcoming-orders/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth } from '@/lib/auth/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAuth();
  const body = await req.json().catch(() => ({}));
  const item = await prisma.upcomingOrder.update({
    where: { id: params.id },
    data: {
      ...body,
      expectedStartDate: body.expectedStartDate ? new Date(body.expectedStartDate) : undefined,
      deadline:          body.deadline          ? new Date(body.deadline)          : undefined,
      updatedAt:         new Date(),
    },
  });
  return NextResponse.json({ data: item });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  await requireAuth();
  await prisma.upcomingOrder.delete({ where: { id: params.id } });
  return NextResponse.json({ ok: true });
}
