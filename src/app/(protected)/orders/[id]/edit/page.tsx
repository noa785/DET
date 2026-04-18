// src/app/(protected)/orders/[id]/edit/page.tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import OrderForm from '../../_components/OrderForm';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const o = await prisma.order.findUnique({ where: { id: params.id }, select: { orderCode: true, name: true } });
  return { title: o ? `Edit ${o.orderCode} — DGCC PES` : 'Edit Order' };
}

export default async function EditOrderPage({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { tab?: string };
}) {
  const user = await requireAuth();
  if (!can(user, 'orders:edit')) redirect(`/orders/${params.id}`);

  const [order, units, projects, users] = await Promise.all([
    prisma.order.findUnique({
      where: { id: params.id, isDeleted: false },
      include: { description: true },
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!order) notFound();

  const initialValues = {
    type:            order.type as any,
    name:            order.name,
    unitId:          order.unitId,
    projectId:       order.projectId,
    parentId:        order.parentId,
    ownerId:         order.ownerId,
    priority:        order.priority as any,
    status:          order.status as any,
    percentComplete: order.percentComplete,
    startDate:       order.startDate ? order.startDate.toISOString().slice(0, 10) : null,
    dueDate:         order.dueDate   ? order.dueDate.toISOString().slice(0, 10)   : null,
    ragOverride:     (order.ragOverride as any) ?? null,
    ragOverrideNote: order.ragOverrideNote ?? null,
    dependencies:    order.dependencies ?? null,
    links:           order.links ?? null,
    notes:           order.notes ?? null,
  };

  const initialDescription = order.description ? {
    objective:         order.description.objective ?? '',
    scope:             order.description.scope ?? '',
    rationale:         order.description.rationale ?? '',
    governanceImpact:  order.description.governanceImpact ?? '',
    affectedUnit:      order.description.affectedUnit ?? '',
    relatedPolicies:   order.description.relatedPolicies ?? '',
    requiredEvidence:  order.description.requiredEvidence ?? '',
    risks:             order.description.risks ?? '',
  } : undefined;

  const defaultTab = searchParams.tab as any ?? 'core';

  return (
    <OrderForm
      mode="edit"
      orderId={order.id}
      orderCode={order.orderCode}
      initialValues={initialValues}
      initialDescription={initialDescription}
      units={units.map(u => ({ id: u.id, label: `${u.code} — ${u.name}` }))}
      projects={projects.map(p => ({ id: p.id, label: `${p.code} — ${p.name}` }))}
      users={users.map(u => ({ id: u.id, label: u.name }))}
      defaultTab={defaultTab}
    />
  );
}
