// src/app/(protected)/orders/[id]/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { computeRAG, isOverdue } from '@/lib/business-logic/orders';
import OrderDetailClient from './OrderDetailClient';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const o = await prisma.order.findUnique({ where: { id: params.id }, select: { orderCode: true, name: true } });
  return { title: o ? `${o.orderCode} — ${o.name}` : 'Order Not Found' };
}

export default async function OrderDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();

  const order = await prisma.order.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      unit:        { select: { code: true, name: true, colorHex: true } },
      project:     { select: { id: true, code: true, name: true, phase: true } },
      owner:       { select: { id: true, name: true, email: true } },
      createdBy:   { select: { name: true } },
      description: true,
      // Update logs — ordered newest first
      updateLogs: {
        orderBy: { createdAt: 'desc' },
        take: 50,
        include: {
          createdBy:      { select: { name: true, initials: true } },
          govReviewedBy:  { select: { name: true } },
        },
      },
      // Governance tasks linked to this order's unit
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true, initials: true } } },
      },
      children: {
        where: { isDeleted: false },
        include: { owner: { select: { name: true } } },
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!order) notFound();

  // Governance items linked to this unit
  const govItems = order.unitId
    ? await prisma.governanceItem.findMany({
        where: { unitId: order.unitId, isDeleted: false, status: { not: 'ARCHIVED' } },
        select: { id: true, govCode: true, title: true, type: true, status: true, priority: true },
        take: 10,
      })
    : [];

  const serialized = {
    id:              order.id,
    orderCode:       order.orderCode,
    type:            order.type,
    name:            order.name,
    unitCode:        order.unit?.code ?? null,
    unitName:        order.unit?.name ?? null,
    unitColor:       order.unit?.colorHex ?? null,
    projectId:       order.project?.id ?? null,
    projectCode:     order.project?.code ?? null,
    projectName:     order.project?.name ?? null,
    projectPhase:    order.project?.phase ?? null,
    ownerId:         order.owner?.id ?? null,
    ownerName:       order.owner?.name ?? null,
    priority:        order.priority,
    status:          order.status,
    startDate:       order.startDate?.toISOString() ?? null,
    dueDate:         order.dueDate?.toISOString() ?? null,
    percentComplete: order.percentComplete,
    rescheduleCount: order.rescheduleCount,
    dependencies:    order.dependencies,
    links:           order.links,
    notes:           order.notes,
    createdAt:       order.createdAt.toISOString(),
    updatedAt:       order.updatedAt.toISOString(),
    createdByName:   order.createdBy?.name ?? null,
    effectiveRAG: computeRAG({
      status: order.status as any,
      percentComplete: order.percentComplete,
      dueDate: order.dueDate?.toISOString(),
      ragOverride: order.ragOverride as any,
    }),
    isOverdue: isOverdue({
      status: order.status as any,
      percentComplete: order.percentComplete,
      dueDate: order.dueDate?.toISOString(),
    }),
    description: order.description ? {
      id:                 order.description.id,
      objective:          order.description.objective,
      scope:              order.description.scope,
      rationale:          order.description.rationale,
      governanceImpact:   order.description.governanceImpact,
      affectedUnit:       order.description.affectedUnit,
      relatedPolicies:    order.description.relatedPolicies,
      requiredEvidence:   order.description.requiredEvidence,
      risks:              order.description.risks,
      updatedAt:          order.description.updatedAt.toISOString(),
      lastEditedByName:   null,
    } : null,
    updateLogs: order.updateLogs.map(u => ({
      id:                  u.id,
      logCode:             u.logCode,
      updateType:          u.updateType,
      title:               u.title,
      description:         u.description,
      fieldChanged:        u.fieldChanged,
      oldValue:            u.oldValue,
      newValue:            u.newValue,
      changeReason:        u.changeReason,
      requiresGovReview:   u.requiresGovReview,
      govReviewStatus:     u.govReviewStatus,
      govReviewedByName:   u.govReviewedBy?.name ?? null,
      govReviewedAt:       u.govReviewedAt?.toISOString() ?? null,
      govReviewNotes:      u.govReviewNotes,
      evidenceLinks:       u.evidenceLinks,
      createdByName:       u.createdBy?.name ?? null,
      createdByInitials:   u.createdBy?.initials ?? null,
      createdAt:           u.createdAt.toISOString(),
    })),
    auditLogs: order.auditLogs.map(a => ({
      id:          a.id,
      action:      a.action,
      field:       a.field,
      oldValue:    a.oldValue,
      newValue:    a.newValue,
      notes:       a.notes,
      userName:    a.user?.name ?? a.userName ?? 'System',
      initials:    a.user?.initials ?? null,
      createdAt:   a.createdAt.toISOString(),
    })),
    children: order.children.map(c => ({
      id: c.id, orderCode: c.orderCode, name: c.name,
      status: c.status, percentComplete: c.percentComplete,
      priority: c.priority, ownerName: c.owner?.name ?? null,
      dueDate: c.dueDate?.toISOString() ?? null,
    })),
    govItems: govItems.map(g => ({
      id: g.id, govCode: g.govCode, title: g.title,
      type: g.type, status: g.status, priority: g.priority,
    })),
  };

  const canEdit = can(user, 'orders:edit');
  return <OrderDetailClient order={serialized} canEdit={canEdit} currentUserId={user.id} />;
}
