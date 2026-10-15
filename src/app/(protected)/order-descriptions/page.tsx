// src/app/(protected)/order-descriptions/page.tsx
// List all orders with their description content — searchable, filterable, exportable.
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import OrderDescriptionsClient from './OrderDescriptionsClient';

export const metadata: Metadata = { title: 'Order Descriptions — DGCC DET' };

export default async function OrderDescriptionsPage() {
  await requireAuth();

  // Fetch all active orders + their description (LEFT JOIN — show all orders)
  const [rawOrders, units] = await Promise.all([
    prisma.order.findMany({
      where: { isDeleted: false },
      include: {
        unit:        { select: { code: true, name: true, colorHex: true } },
        project:     { select: { code: true, name: true } },
        description: true,
      },
      orderBy: { orderCode: 'asc' },
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  const rows = rawOrders.map(o => ({
    id:           o.id,
    orderCode:    o.orderCode,
    name:         o.name,
    status:       o.status,
    unitCode:     o.unit?.code ?? null,
    unitName:     o.unit?.name ?? null,
    unitColor:    o.unit?.colorHex ?? null,
    projectCode:  o.project?.code ?? null,
    projectName:  o.project?.name ?? null,
    description: o.description ? {
      objective:        o.description.objective         ?? null,
      scope:            o.description.scope             ?? null,
      rationale:        o.description.rationale         ?? null,
      governanceImpact: o.description.governanceImpact  ?? null,
      affectedUnit:     o.description.affectedUnit      ?? null,
      relatedPolicies:  o.description.relatedPolicies   ?? null,
      requiredEvidence: o.description.requiredEvidence  ?? null,
      risks:            o.description.risks             ?? null,
      updatedAt:        o.description.updatedAt.toISOString(),
    } : null,
  }));

  return <OrderDescriptionsClient rows={rows} units={units} />;
}
