// src/app/api/units/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, colorHex: true },
    orderBy: { code: 'asc' },
  });
  return NextResponse.json({ data: units });
}
