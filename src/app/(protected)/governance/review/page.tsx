// src/app/(protected)/governance/review/page.tsx
// Governance Review Dashboard — لوحة مراجعة الحوكمة
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import GovernanceReviewClient from './GovernanceReviewClient';

export const metadata: Metadata = { title: 'Governance Review — DGCC PES' };

export default async function GovernanceReviewPage() {
  const user = await requireAuth();
  if (!can(user, 'governance:view')) redirect('/dashboard');

  const canApprove = can(user, 'governance:approve');

  const [
    awaitingApproval,
    overdueTasks,
    pendingUpdateLogs,
    govItemsNeedingReview,
    recentlyUpdatedItems,
    govStats,
    ordersForGovReview,
  ] = await Promise.all([

    // Gov tasks pending approval (approvalRequired but not yet approved)
    prisma.governanceTask.findMany({
      where: { isDeleted: false, approvalRequired: true, approvedAt: null, status: { notIn: ['DONE', 'CANCELLED'] } },
      include: {
        govItem:  { select: { id: true, govCode: true, title: true } },
        assignee: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),

    // Overdue tasks
    prisma.governanceTask.findMany({
      where: { isDeleted: false, isOverdue: true, status: { notIn: ['DONE','CANCELLED'] } },
      include: {
        govItem:  { select: { id: true, govCode: true, title: true } },
        assignee: { select: { name: true } },
      },
      orderBy: { dueDate: 'asc' },
      take: 50,
    }),

    // Update logs pending governance review
    prisma.updateLog.findMany({
      where: { requiresGovReview: true, govReviewStatus: 'PENDING' },
      include: {
        order:   { select: { id: true, orderCode: true, name: true } },
        govItem: { select: { id: true, govCode: true, title: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 50,
    }),

    // Governance items needing review cycle
    prisma.governanceItem.findMany({
      where: {
        isDeleted: false,
        status: { in: ['ACTIVE','UNDER_REVIEW'] },
        OR: [
          { nextReviewDate: { lt: new Date() } },
          { nextReviewDate: null, reviewCycleDays: { not: null } },
        ],
      },
      include: {
        unit:  { select: { code: true, colorHex: true } },
        owner: { select: { name: true } },
      },
      orderBy: { nextReviewDate: 'asc' },
      take: 30,
    }),

    // Recently updated governance items (last 7 days)
    prisma.governanceItem.findMany({
      where: {
        isDeleted: false,
        updatedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
      },
      include: {
        unit:  { select: { code: true, colorHex: true } },
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 20,
    }),

    // Overall stats
    prisma.$transaction([
      prisma.governanceItem.count({ where: { isDeleted: false } }),
      prisma.governanceItem.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
      prisma.governanceItem.count({ where: { isDeleted: false, status: 'UNDER_REVIEW' } }),
      prisma.governanceTask.count({ where: { isDeleted: false, status: { notIn: ['DONE','CANCELLED'] } } }),
      prisma.governanceTask.count({ where: { isDeleted: false, isOverdue: true } }),
      prisma.governanceTask.count({ where: { isDeleted: false, approvalRequired: true, approvedAt: null } }),
      prisma.updateLog.count({ where: { requiresGovReview: true, govReviewStatus: 'PENDING' } }),
    ]),

    // Orders flagged for governance team review
    prisma.order.findMany({
      where: { isDeleted: false, govReviewRequired: true },
      include: {
        unit:  { select: { code: true, colorHex: true } },
        owner: { select: { name: true } },
      },
      orderBy: { updatedAt: 'desc' },
      take: 50,
    }),
  ]);

  const [
    totalItems, activeItems, underReview,
    openTasks, overdueCt, awaitingCt, pendingLogsCt,
  ] = govStats;

  function serializeTask(t: any) {
    return {
      id: t.id, taskCode: t.taskCode, title: t.title, type: t.type,
      status: t.status, priority: t.priority,
      govItemId: t.govItemId,
      govCode:   t.govItem?.govCode ?? null,
      govTitle:  t.govItem?.title  ?? null,
      govItemDbId: t.govItem?.id   ?? null,
      assigneeName: t.assignee?.name ?? null,
      approverName: t.approver?.name ?? null,
      dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : null,
      approvalRequired: t.approvalRequired,
      isOverdue: t.isOverdue,
    };
  }

  function serializeLog(l: any) {
    return {
      id: l.id, logCode: l.logCode, updateType: l.updateType, title: l.title,
      description: l.description,
      orderId:    l.order?.id ?? null,
      orderCode:  l.order?.orderCode ?? null,
      orderName:  l.order?.name ?? null,
      govItemId:  l.govItem?.id ?? null,
      govCode:    l.govItem?.govCode ?? null,
      createdByName: l.createdBy?.name ?? null,
      createdAt: l.createdAt.toISOString(),
      requiresGovReview: l.requiresGovReview,
      govReviewStatus: l.govReviewStatus,
    };
  }

  function serializeGovItem(g: any) {
    return {
      id: g.id, govCode: g.govCode, title: g.title, type: g.type,
      status: g.status, riskLevel: g.riskLevel ?? 'LOW',
      unitCode:  g.unit?.code ?? null,
      unitColor: g.unit?.colorHex ?? null,
      ownerName: g.owner?.name ?? null,
      updatedByName: null,
      nextReviewDate: g.nextReviewDate ? g.nextReviewDate.toISOString().slice(0, 10) : null,
      updatedAt: g.updatedAt.toISOString(),
    };
  }

  return (
    <GovernanceReviewClient
      stats={{ totalItems, activeItems, underReview, openTasks, overdueCt, awaitingCt, pendingLogsCt }}
      awaitingApproval={awaitingApproval.map(serializeTask)}
      overdueTasks={overdueTasks.map(serializeTask)}
      pendingUpdateLogs={pendingUpdateLogs.map(serializeLog)}
      govItemsNeedingReview={govItemsNeedingReview.map(serializeGovItem)}
      recentlyUpdatedItems={recentlyUpdatedItems.map(serializeGovItem)}
      ordersForGovReview={ordersForGovReview.map(o => ({
        id: o.id,
        orderCode: o.orderCode,
        name: o.name,
        status: o.status,
        priority: o.priority,
        dueDate: o.dueDate ? o.dueDate.toISOString().slice(0, 10) : null,
        unitCode: o.unit?.code ?? null,
        unitColor: o.unit?.colorHex ?? null,
        ownerName: o.owner?.name ?? null,
      }))}
      canApprove={canApprove}
      currentUserName={user.name}
    />
  );
}
