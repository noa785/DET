// src/app/api/work/orders/route.ts
// DET v2: create an order (Add Order page).

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { nextOrderCode, toDetOrder, DET_ORDER_SELECT } from '@/lib/det/server';
import { canEditSection, SECTIONS } from '@/lib/det/shared';

const CreateSchema = z.object({
  section:   z.enum(['SYSTEMS_ENGINEERING', 'AUTOMATION']),
  name:      z.string().trim().min(1, 'Please write the order').max(500),
  ownerName: z.string().trim().max(200).optional().default(''),
  unitCode:  z.string().trim().max(20).optional().nullable(),
  dueDate:   z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Please pick a due date'),
  points:    z.array(z.string().trim().max(1000)).max(100).optional().default([]),
  narrative: z.string().trim().max(10000).optional().default(''),
  govStatus: z.enum(['NOT_REQUIRED', 'PENDING', 'APPROVED']).optional().default('NOT_REQUIRED'),
  govNote:   z.string().trim().max(5000).optional().default(''),
});

export async function POST(req: NextRequest) {
  // Each team adds orders only in its own section (see canEditSection in lib/det/shared).
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const parsed = CreateSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 });
  }
  const b = parsed.data;
  if (!canEditSection(user.role, b.section)) {
    return NextResponse.json({ error: `You can view ${SECTIONS[b.section].name} but not add orders to it.` }, { status: 403 });
  }
  const unit = b.unitCode ? await prisma.unit.findUnique({ where: { code: b.unitCode }, select: { id: true } }) : null;
  const points = b.points.filter(Boolean);
  const orderCode = await nextOrderCode(b.section);

  const order = await prisma.order.create({
    data: {
      orderCode,
      section: b.section,
      name: b.name,
      ownerName: b.ownerName || user.name,
      unitId: unit?.id ?? null,
      dueDate: new Date(`${b.dueDate}T00:00:00Z`),
      status: 'NOT_STARTED',
      percentComplete: 0,
      govStatus: b.govStatus,
      govNote: b.govNote || null,
      govReviewRequired: b.govStatus !== 'NOT_REQUIRED',
      createdById: user.id,
      updatedById: user.id,
      description: {
        create: {
          bulletSummary: points.length ? points.join('\n') : null,
          narrativeSummary: b.narrative || null,
          lastEditedById: user.id,
        },
      },
    },
    select: DET_ORDER_SELECT,
  });

  await audit({ action: 'CREATE', module: 'orders', user, recordId: order.id, recordCode: orderCode, orderId: order.id, notes: 'Order created' });
  return NextResponse.json({ data: toDetOrder(order as never) }, { status: 201 });
}
