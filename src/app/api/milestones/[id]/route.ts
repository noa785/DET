// src/app/api/milestones/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

// PATCH /api/milestones/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const { title, description, status, plannedDate, actualDate, plannedPercent, actualPercent, note, sortOrder } = body;

  // Calculate variance
  let varianceDays: number | undefined = undefined;
  if (plannedDate !== undefined && actualDate !== undefined) {
    if (plannedDate && actualDate) {
      const planned = new Date(plannedDate);
      const actual = new Date(actualDate);
      varianceDays = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
    } else {
      varianceDays = null as any;
    }
  }

  const milestone = await prisma.milestone.update({
    where: { id: params.id },
    data: {
      ...(title !== undefined && { title }),
      ...(description !== undefined && { description }),
      ...(status !== undefined && { status }),
      ...(plannedDate !== undefined && { plannedDate: plannedDate ? new Date(plannedDate) : null }),
      ...(actualDate !== undefined && { actualDate: actualDate ? new Date(actualDate) : null }),
      ...(plannedPercent !== undefined && { plannedPercent }),
      ...(actualPercent !== undefined && { actualPercent }),
      ...(varianceDays !== undefined && { varianceDays }),
      ...(note !== undefined && { note }),
      ...(sortOrder !== undefined && { sortOrder }),
    },
  });

  return NextResponse.json(milestone);
}

// DELETE /api/milestones/[id]
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  await prisma.milestone.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
