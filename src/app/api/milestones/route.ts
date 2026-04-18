// src/app/api/milestones/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

// GET /api/milestones?orderId=xxx
export async function GET(req: NextRequest) {
  const auth = await requirePermission('orders:view');
  if (isErrorResponse(auth)) return auth;

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const milestones = await prisma.milestone.findMany({
    where: { orderId },
    orderBy: { sortOrder: 'asc' },
  });

  return NextResponse.json(milestones);
}

// POST /api/milestones
export async function POST(req: NextRequest) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const { orderId, title, description, status, plannedDate, actualDate, plannedPercent, actualPercent, note, sortOrder } = body;

  if (!orderId || !title) {
    return NextResponse.json({ error: 'orderId and title required' }, { status: 400 });
  }

  // Calculate variance
  let varianceDays: number | null = null;
  if (plannedDate && actualDate) {
    const planned = new Date(plannedDate);
    const actual = new Date(actualDate);
    varianceDays = Math.round((actual.getTime() - planned.getTime()) / (1000 * 60 * 60 * 24));
  }

  const milestone = await prisma.milestone.create({
    data: {
      orderId,
      title,
      description: description || null,
      status: status || 'NOT_STARTED',
      plannedDate: plannedDate ? new Date(plannedDate) : null,
      actualDate: actualDate ? new Date(actualDate) : null,
      plannedPercent: plannedPercent ?? null,
      actualPercent: actualPercent ?? null,
      varianceDays,
      note: note || null,
      sortOrder: sortOrder ?? 0,
      createdById: auth.id,
    },
  });

  return NextResponse.json(milestone, { status: 201 });
}
