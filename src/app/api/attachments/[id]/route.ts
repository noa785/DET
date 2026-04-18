// src/app/api/attachments/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  await prisma.attachment.delete({ where: { id: params.id } });
  return NextResponse.json({ success: true });
}
