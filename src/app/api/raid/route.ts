// src/app/api/raid/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

// GET /api/raid?orderId=xxx
export async function GET(req: NextRequest) {
  const auth = await requirePermission('orders:view');
  if (isErrorResponse(auth)) return auth;

  const orderId = req.nextUrl.searchParams.get('orderId');
  if (!orderId) return NextResponse.json({ error: 'orderId required' }, { status: 400 });

  const items = await prisma.rAIDItem.findMany({
    where: { orderId },
    include: { owner: { select: { id: true, name: true, initials: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(items);
}

// POST /api/raid
export async function POST(req: NextRequest) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const { orderId, category, title, description, severity, status, ownerId, dueDate, mitigationPlan, resolutionNote } = body;

  if (!orderId || !category || !title) {
    return NextResponse.json({ error: 'orderId, category, and title required' }, { status: 400 });
  }

  const item = await prisma.rAIDItem.create({
    data: {
      orderId,
      category,
      title,
      description: description || null,
      severity: severity || 'MEDIUM',
      status: status || 'OPEN',
      ownerId: ownerId || null,
      dueDate: dueDate ? new Date(dueDate) : null,
      mitigationPlan: mitigationPlan || null,
      resolutionNote: resolutionNote || null,
      createdById: auth.id,
    },
    include: { owner: { select: { id: true, name: true, initials: true } } },
  });

  return NextResponse.json(item, { status: 201 });
}
