// src/app/api/raid/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const item = await prisma.rAIDItem.update({
    where: { id: params.id },
    data: {
      ...(body.category !== undefined && { category: body.category }),
      ...(body.title !== undefined && { title: body.title }),
      ...(body.description !== undefined && { description: body.description }),
      ...(body.severity !== undefined && { severity: body.severity }),
      ...(body.status !== undefined && { status: body.status }),
      ...(body.ownerId !== undefined && { ownerId: body.ownerId || null }),
      ...(body.dueDate !== undefined && { dueDate: body.dueDate ? new Date(body.dueDate) : null }),
      ...(body.mitigationPlan !== undefined && { mitigationPlan: body.mitigationPlan }),
      ...(body.resolutionNote !== undefined && { resolutionNote: body.resolutionNote }),
    },
    include: { owner: { select: { id: true, name: true, initials: true } } },
  });

  return NextResponse.json(item);
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  await prisma.rAIDItem.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
