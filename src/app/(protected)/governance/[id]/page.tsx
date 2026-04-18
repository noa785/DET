// src/app/(protected)/governance/[id]/page.tsx
import { Metadata } from 'next';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import GovernanceDetailClient from './GovernanceDetailClient';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const g = await prisma.governanceItem.findUnique({ where: { id: params.id }, select: { govCode: true, title: true } });
  return { title: g ? `${g.govCode} — ${g.title}` : 'Governance Item' };
}

export default async function GovernanceDetailPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();

  const item = await prisma.governanceItem.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      unit:       { select: { id: true, code: true, name: true, colorHex: true } },
      owner:      { select: { id: true, name: true, email: true } },
      reviewer:   { select: { id: true, name: true } },
      govTasks: {
        where: { isDeleted: false },
        include: {
          assignee: { select: { name: true } },
          approver: { select: { name: true } },
        },
        orderBy: { createdAt: 'desc' },
      },
      updateLogs: {
        orderBy: { createdAt: 'desc' },
        take: 30,
        include: { createdBy: { select: { name: true, initials: true } } },
      },
      auditLogs: {
        orderBy: { createdAt: 'desc' },
        take: 20,
        include: { user: { select: { name: true, initials: true } } },
      },
    },
  });

  if (!item) notFound();

  // Orders from the same unit
  const relatedOrders = item.unitId
    ? await prisma.order.findMany({
        where: { unitId: item.unitId, isDeleted: false },
        select: { id: true, orderCode: true, name: true, status: true, percentComplete: true, priority: true, dueDate: true },
        orderBy: { updatedAt: 'desc' },
        take: 15,
      })
    : [];

  const canEdit   = can(user, 'governance:edit');
  const canApprove = can(user, 'governance:approve');

  return (
    <GovernanceDetailClient
      item={{
        id:               item.id,
        govCode:          item.govCode,
        title:            item.title,
        type:             item.type,
        status:           item.status,
        priority:         item.priority,
        riskLevel:        item.riskLevel,
        complianceImpact: item.complianceImpact,
        version:          item.version,
        source:           item.source,
        notes:            item.notes,
        evidenceLinks:    item.evidenceLinks,
        effectiveDate:    item.effectiveDate?.toISOString() ?? null,
        nextReviewDate:   item.nextReviewDate?.toISOString() ?? null,
        reviewCycleDays:  item.reviewCycleDays,
        unitCode:         item.unit?.code ?? null,
        unitName:         item.unit?.name ?? null,
        unitColor:        item.unit?.colorHex ?? null,
        ownerName:        item.owner?.name ?? null,
        reviewerName:     item.reviewer?.name ?? null,
        createdByName:    null,
        createdAt:        item.createdAt.toISOString(),
        updatedAt:        item.updatedAt.toISOString(),
        govTasks: item.govTasks.map(t => ({
          id:             t.id,
          taskCode:       t.taskCode,
          title:          t.title,
          type:           t.type,
          status:         t.status,
          priority:       t.priority,
          assigneeName:   t.assignee?.name ?? null,
          dueDate:        t.dueDate?.toISOString() ?? null,
          isOverdue:      t.isOverdue,
          approvalRequired: t.approvalRequired,
          approverName:   t.approver?.name ?? null,
          approvedAt:     t.approvedAt?.toISOString() ?? null,
          description:    t.description,
          requiredEvidence: t.requiredEvidence,
          completionEvidence: t.completionEvidence,
        })),
        updateLogs: item.updateLogs.map(u => ({
          id:              u.id,
          logCode:         u.logCode,
          updateType:      u.updateType,
          title:           u.title,
          description:     u.description,
          fieldChanged:    u.fieldChanged,
          oldValue:        u.oldValue,
          newValue:        u.newValue,
          changeReason:    u.changeReason,
          requiresGovReview: u.requiresGovReview,
          govReviewStatus: u.govReviewStatus,
          createdByName:   u.createdBy?.name ?? null,
          createdByInitials: u.createdBy?.initials ?? null,
          createdAt:       u.createdAt.toISOString(),
        })),
        auditLogs: item.auditLogs.map(a => ({
          id:        a.id,
          action:    a.action,
          field:     a.field,
          oldValue:  a.oldValue,
          newValue:  a.newValue,
          userName:  a.user?.name ?? a.userName ?? 'System',
          createdAt: a.createdAt.toISOString(),
        })),
        relatedOrders: relatedOrders.map(o => ({
          id: o.id, orderCode: o.orderCode, name: o.name,
          status: o.status, percentComplete: o.percentComplete,
          priority: o.priority,
          dueDate: o.dueDate?.toISOString() ?? null,
        })),
      }}
      canEdit={canEdit}
      canApprove={canApprove}
    />
  );
}
