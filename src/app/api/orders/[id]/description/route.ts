// src/app/api/orders/[id]/description/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const DescriptionSchema = z.object({
  objective:         z.string().optional().nullable(),
  scope:             z.string().optional().nullable(),
  rationale:         z.string().optional().nullable(),
  governanceImpact:  z.string().optional().nullable(),
  affectedUnit:      z.string().optional().nullable(),
  relatedPolicies:   z.string().optional().nullable(),
  requiredEvidence:  z.string().optional().nullable(),
  risks:             z.string().optional().nullable(),
});

// ── GET /api/orders/[id]/description ──────────────────────────
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const desc = await prisma.orderDescription.findUnique({ where: { orderId: params.id } });
  if (!desc) return NextResponse.json({ data: null });
  return NextResponse.json({ data: desc });
}

// ── PUT /api/orders/[id]/description (upsert) ─────────────────
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const order = await prisma.order.findUnique({
    where: { id: params.id, isDeleted: false },
    select: { orderCode: true },
  });
  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = DescriptionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;
  const desc = await prisma.orderDescription.upsert({
    where:  { orderId: params.id },
    create: { orderId: params.id, ...data, lastEditedById: user.id },
    update: { ...data, lastEditedById: user.id },
  });

  await audit({
    action: 'UPDATE', module: 'order_descriptions', user,
    recordId: params.id, recordCode: order.orderCode,
    notes: 'Description updated',
    orderId: params.id,
  });

  return NextResponse.json({ data: desc });
}
