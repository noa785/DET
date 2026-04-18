// src/app/(protected)/orders/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { computeRAG, isOverdue } from '@/lib/business-logic/orders';
import OrdersClient from './OrdersClient';

export const metadata: Metadata = { title: 'Orders — DGCC PES' };

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: { status?: string; priority?: string; unit?: string; overdue?: string; page?: string };
}) {
  const user = await requireAuth();

  const page     = parseInt(searchParams.page ?? '1');
  const pageSize = 20;

  // Build where clause
  const where: any = { isDeleted: false };
  if (searchParams.status)   where.status   = searchParams.status;
  if (searchParams.priority) where.priority = searchParams.priority;
  if (searchParams.unit)     where.unit     = { code: searchParams.unit };

  const [rawOrders, total, units, projects] = await Promise.all([
    prisma.order.findMany({
      where,
      include: {
        unit:    { select: { code: true, name: true, colorHex: true } },
        project: { select: { code: true, name: true } },
        owner:   { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      skip:  (page - 1) * pageSize,
      take:  pageSize,
    }),
    prisma.order.count({ where }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
  ]);

  const orders = rawOrders.map(o => ({
    id:               o.id,
    orderCode:        o.orderCode,
    type:             o.type,
    name:             o.name,
    unitCode:         o.unit?.code ?? null,
    unitName:         o.unit?.name ?? null,
    unitColor:        o.unit?.colorHex ?? null,
    projectCode:      o.project?.code ?? null,
    projectName:      o.project?.name ?? null,
    ownerId:          o.owner?.id ?? null,
    ownerName:        o.owner?.name ?? null,
    priority:         o.priority,
    status:           o.status,
    startDate:        o.startDate?.toISOString() ?? null,
    dueDate:          o.dueDate?.toISOString() ?? null,
    percentComplete:  o.percentComplete,
    rescheduleCount:  o.rescheduleCount,
    createdAt:        o.createdAt.toISOString(),
    updatedAt:        o.updatedAt.toISOString(),
    govReviewRequired: o.govReviewRequired ?? false,
    projectType:       (o as any).projectType ?? null,
    effectiveRAG: computeRAG({
      status:           o.status as any,
      percentComplete:  o.percentComplete,
      dueDate:          o.dueDate?.toISOString(),
      ragOverride:      o.ragOverride as any,
    }),
    isOverdue: isOverdue({
      status:          o.status as any,
      percentComplete: o.percentComplete,
      dueDate:         o.dueDate?.toISOString(),
    }),
  }));

  // Filter overdue client-side if requested
  const filtered = searchParams.overdue === '1'
    ? orders.filter(o => o.isOverdue)
    : orders;

  return (
    <OrdersClient
      orders={filtered}
      total={total}
      page={page}
      pageSize={pageSize}
      units={units}
      projects={projects}
      userRole={user.role}
    />
  );
}
