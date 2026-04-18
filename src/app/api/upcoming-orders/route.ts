// src/app/api/upcoming-orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requireAuth } from '@/lib/auth/session';

const Schema = z.object({
  unitName:             z.string().min(1),
  contactName:          z.string().min(1),
  contactEmail:         z.string().email().optional().nullable(),
  contactPhone:         z.string().optional().nullable(),
  serviceTypes:         z.string().optional().nullable(),
  helpTypes:            z.string().optional().nullable(),
  description:          z.string().min(1),
  expectedOutput:       z.string().optional().nullable(),
  internalNotes:        z.string().optional().nullable(),
  priority:             z.enum(['URGENT','HIGH','NORMAL']).default('NORMAL'),
  expectedStartDate:    z.string().optional().nullable(),
  deadline:             z.string().optional().nullable(),
  businessJustification:z.string().optional().nullable(),
  dataClassification:   z.enum(['PUBLIC','INTERNAL','CONFIDENTIAL']).optional().nullable(),
  hasPersonalData:      z.boolean().default(false),
  preferredDay:         z.string().optional().nullable(),
  preferredTime:        z.string().optional().nullable(),
  assignedToId:         z.string().optional().nullable(),
});

// GET — list all
export async function GET(req: NextRequest) {
  await requireAuth();
  const { searchParams } = req.nextUrl;
  const status = searchParams.get('status');
  const where: any = {};
  if (status) where.status = status;

  const items = await prisma.upcomingOrder.findMany({
    where,
    include: { assignedTo: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  return NextResponse.json({ data: items });
}

// POST — create new
export async function POST(req: NextRequest) {
  await requireAuth();
  const body = await req.json().catch(() => null);
  const parsed = Schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }
  const d = parsed.data;

  // Generate ref code
  const count = await prisma.upcomingOrder.count();
  const refCode = `SRF-${String(count + 1).padStart(4, '0')}`;

  const item = await prisma.upcomingOrder.create({
    data: {
      refCode,
      unitName:              d.unitName,
      contactName:           d.contactName,
      contactEmail:          d.contactEmail ?? null,
      contactPhone:          d.contactPhone ?? null,
      serviceTypes:          d.serviceTypes ?? null,
      helpTypes:             d.helpTypes ?? null,
      description:           d.description,
      expectedOutput:        d.expectedOutput ?? null,
      internalNotes:         d.internalNotes ?? null,
      priority:              d.priority,
      expectedStartDate:     d.expectedStartDate ? new Date(d.expectedStartDate) : null,
      deadline:              d.deadline ? new Date(d.deadline) : null,
      businessJustification: d.businessJustification ?? null,
      dataClassification:    d.dataClassification ?? null,
      hasPersonalData:       d.hasPersonalData,
      preferredDay:          d.preferredDay ?? null,
      preferredTime:         d.preferredTime ?? null,
      assignedToId:          d.assignedToId ?? null,
      status:                'PENDING',
    },
  });
  return NextResponse.json({ data: item }, { status: 201 });
}
