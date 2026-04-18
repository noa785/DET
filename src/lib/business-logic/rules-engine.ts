// src/lib/business-logic/rules-engine.ts
// Phase 4: Automated Business Rules Engine

import { prisma } from "@/lib/prisma/client";

interface RuleResult {
  ordersDelayed: number;
  ordersDueSoon: number;
  govReviewOverdue: number;
  govReviewSoon: number;
  notificationsCreated: number;
}

/**
 * Run all business rules:
 * 1. Auto-delay overdue orders
 * 2. Notify about orders due soon (7 days)
 * 3. Notify about overdue governance reviews
 * 4. Notify about upcoming governance reviews (14 days)
 */
export async function runBusinessRules(): Promise<RuleResult> {
  const now = new Date();
  let notificationsCreated = 0;

  // ── Rule 1: Auto-delay overdue orders ──
  const overdueOrders = await prisma.order.findMany({
    where: {
      dueDate: { lt: now },
      status: { notIn: ["COMPLETED", "CANCELLED", "DELAYED"] },
      isDeleted: false,
    },
    include: {
      unit: { select: { code: true, name: true } },
      owner: { select: { id: true, name: true } },
    },
  });

  for (const order of overdueOrders) {
    // Update status to DELAYED
    await prisma.order.update({
      where: { id: order.id },
      data: { status: "DELAYED" },
    });

    const daysOverdue = Math.ceil(
      (now.getTime() - new Date(order.dueDate!).getTime()) / 86400000
    );

    // Create notification
    await prisma.notification.create({
      data: {
        type: "AUTO_DELAYED",
        title: `Order auto-delayed: ${order.orderCode}`,
        message: `"${order.name}" is ${daysOverdue} day(s) overdue. Status changed to DELAYED automatically.`,
        severity: daysOverdue > 14 ? "critical" : "warning",
        entityType: "order",
        entityId: order.id,
        entityCode: order.orderCode,
        userId: order.owner?.id || null,
      },
    });
    notificationsCreated++;
  }

  // ── Rule 2: Orders due soon (within 7 days) ──
  const sevenDays = new Date(now.getTime() + 7 * 86400000);
  const dueSoonOrders = await prisma.order.findMany({
    where: {
      dueDate: { gte: now, lte: sevenDays },
      status: { notIn: ["COMPLETED", "CANCELLED"] },
      isDeleted: false,
    },
    include: {
      owner: { select: { id: true, name: true } },
    },
  });

  // Check for existing recent notifications to avoid duplicates
  const recentDueSoonIds = await prisma.notification.findMany({
    where: {
      type: "ORDER_DUE_SOON",
      createdAt: { gte: new Date(now.getTime() - 24 * 3600000) },
    },
    select: { entityId: true },
  });
  const recentDueSoonSet = new Set(recentDueSoonIds.map((n) => n.entityId));

  for (const order of dueSoonOrders) {
    if (recentDueSoonSet.has(order.id)) continue;

    const daysLeft = Math.ceil(
      (new Date(order.dueDate!).getTime() - now.getTime()) / 86400000
    );

    await prisma.notification.create({
      data: {
        type: "ORDER_DUE_SOON",
        title: `Order due in ${daysLeft} day(s): ${order.orderCode}`,
        message: `"${order.name}" is due on ${new Date(order.dueDate!).toLocaleDateString("en-SA")}. Current progress: ${order.percentComplete}%.`,
        severity: daysLeft <= 2 ? "critical" : "warning",
        entityType: "order",
        entityId: order.id,
        entityCode: order.orderCode,
        userId: order.owner?.id || null,
      },
    });
    notificationsCreated++;
  }

  // ── Rule 3: Overdue governance reviews ──
  const govOverdue = await prisma.governanceItem.findMany({
    where: {
      nextReviewDate: { lt: now },
      status: { notIn: ["ARCHIVED", "RETIRED"] },
    },
    include: {
      owner: { select: { id: true } },
    },
  });

  const recentGovOverdueIds = await prisma.notification.findMany({
    where: {
      type: "GOV_REVIEW_OVERDUE",
      createdAt: { gte: new Date(now.getTime() - 24 * 3600000) },
    },
    select: { entityId: true },
  });
  const recentGovOverdueSet = new Set(recentGovOverdueIds.map((n) => n.entityId));

  for (const item of govOverdue) {
    if (recentGovOverdueSet.has(item.id)) continue;

    const daysOverdue = Math.ceil(
      (now.getTime() - new Date(item.nextReviewDate!).getTime()) / 86400000
    );

    await prisma.notification.create({
      data: {
        type: "GOV_REVIEW_OVERDUE",
        title: `Governance review overdue: ${item.govCode}`,
        message: `"${item.title}" review is ${daysOverdue} day(s) overdue. Was due on ${new Date(item.nextReviewDate!).toLocaleDateString("en-SA")}.`,
        severity: daysOverdue > 30 ? "critical" : "warning",
        entityType: "governance",
        entityId: item.id,
        entityCode: item.govCode,
        userId: item.owner?.id || null,
      },
    });
    notificationsCreated++;
  }

  // ── Rule 4: Governance reviews due soon (within 14 days) ──
  const fourteenDays = new Date(now.getTime() + 14 * 86400000);
  const govDueSoon = await prisma.governanceItem.findMany({
    where: {
      nextReviewDate: { gte: now, lte: fourteenDays },
      status: { notIn: ["ARCHIVED", "RETIRED"] },
    },
    include: {
      owner: { select: { id: true } },
    },
  });

  const recentGovSoonIds = await prisma.notification.findMany({
    where: {
      type: "GOV_REVIEW_SOON",
      createdAt: { gte: new Date(now.getTime() - 24 * 3600000) },
    },
    select: { entityId: true },
  });
  const recentGovSoonSet = new Set(recentGovSoonIds.map((n) => n.entityId));

  for (const item of govDueSoon) {
    if (recentGovSoonSet.has(item.id)) continue;

    const daysLeft = Math.ceil(
      (new Date(item.nextReviewDate!).getTime() - now.getTime()) / 86400000
    );

    await prisma.notification.create({
      data: {
        type: "GOV_REVIEW_SOON",
        title: `Governance review in ${daysLeft} day(s): ${item.govCode}`,
        message: `"${item.title}" review is due on ${new Date(item.nextReviewDate!).toLocaleDateString("en-SA")}.`,
        severity: "info",
        entityType: "governance",
        entityId: item.id,
        entityCode: item.govCode,
        userId: item.owner?.id || null,
      },
    });
    notificationsCreated++;
  }

  return {
    ordersDelayed: overdueOrders.length,
    ordersDueSoon: dueSoonOrders.length - recentDueSoonSet.size,
    govReviewOverdue: govOverdue.length - recentGovOverdueSet.size,
    govReviewSoon: govDueSoon.length - recentGovSoonSet.size,
    notificationsCreated,
  };
}
