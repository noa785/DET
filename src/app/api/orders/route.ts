// src/app/api/orders/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { computeRAG, computePlannedPercent, shouldIncrementReschedule } from '@/lib/business-logic/orders';

// ── Zod schema ─────────────────────────────────────────────────
const CreateOrderSchema = z.object({
  type:            z.enum(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']).default('TASK'),
  name:            z.string().min(1).max(500).trim(),
  unitId:          z.string().optional().nullable(),
  projectId:       z.string().optional().nullable(),
  parentId:        z.string().optional().nullable(),
  ownerId:         z.string().optional().nullable(),
  priority:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  status:          z.enum(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']).default('NOT_STARTED'),
  startDate:       z.string().optional().nullable(),
  dueDate:         z.string().optional().nullable(),
  percentComplete: z.number().int().min(0).max(100).default(0),
  dependencies:    z.string().optional().nullable(),
  links:           z.string().optional().nullable(),
  notes:           z.string().optional().nullable(),
  govReviewRequired: z.boolean().optional().default(false),
  projectType: z.enum(['SYSTEM_BUILD', 'DATA_ANALYSIS', 'OTHER']).nullable().optional(),
});

// ── GET /api/orders ────────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const page     = parseInt(searchParams.get('page') ?? '1');
  const pageSize = parseInt(searchParams.get('pageSize') ?? '20');

  const where: any = { isDeleted: false };
  if (searchParams.get('status'))    where.status    = searchParams.get('status');
  if (searchParams.get('priority'))  where.priority  = searchParams.get('priority');
  if (searchParams.get('unitId'))    where.unitId    = searchParams.get('unitId');
  if (searchParams.get('projectId')) where.projectId = searchParams.get('projectId');

  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        unit:    { select: { code: true, name: true, colorHex: true } },
        project: { select: { code: true, name: true } },
        owner:   { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.order.count({ where }),
  ]);

  return NextResponse.json({ data: orders, total, page, pageSize, totalPages: Math.ceil(total / pageSize) });
}

// ── POST /api/orders ───────────────────────────────────────────
export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:create');
  if (isErrorResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = CreateOrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  // Generate next order code
  const seq = await prisma.sequence.update({
    where: { id: 'order' },
    data:  { current: { increment: 1 } },
  });
  const orderCode = `${seq.prefix}-${String(seq.current).padStart(seq.padding, '0')}`;

  // Compute RAG
  const ragAuto = computeRAG({
    status: data.status,
    percentComplete: data.percentComplete,
    dueDate: data.dueDate ?? undefined,
  });

  const order = await prisma.order.create({
    data: {
      orderCode,
      type:            data.type,
      name:            data.name,
      unitId:          data.unitId ?? null,
      projectId:       data.projectId ?? null,
      parentId:        data.parentId ?? null,
      ownerId:         data.ownerId ?? null,
      priority:        data.priority,
      status:          data.status,
      startDate:       data.startDate ? new Date(data.startDate) : null,
      dueDate:         data.dueDate   ? new Date(data.dueDate)   : null,
      percentComplete: data.percentComplete,
      plannedPercent:  computePlannedPercent(data.startDate, data.dueDate),
      ragAuto,
      dependencies:    data.dependencies ?? null,
      links:           data.links ?? null,
      notes:           data.notes ?? null,
      govReviewRequired: data.govReviewRequired ?? false,
      projectType:       data.projectType ?? null,
      createdById:     user.id,
      updatedById:     user.id,
    },
    include: {
      unit:    { select: { code: true, name: true } },
      project: { select: { code: true, name: true } },
    },
  });

  await audit({ action: 'CREATE', module: 'orders', user, recordId: order.id, recordCode: orderCode, notes: `Created "${data.name}"` });

  return NextResponse.json({ data: order }, { status: 201 });
}
