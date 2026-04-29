// src/lib/notifications/governance.ts
// Helpers for creating governance-related notifications
// Used when an Order is created/updated and requires governance review.

import { prisma } from "@/lib/prisma/client";
import { ROLE_PERMISSIONS, type Role } from "@/types";

/**
 * Returns all roles that have governance:view OR governance:edit permission.
 * These are the users who should be notified when a new governance review
 * is requested.
 */
function getGovernanceNotifiableRoles(): Role[] {
  const roles: Role[] = [];
  for (const [role, perms] of Object.entries(ROLE_PERMISSIONS)) {
    if (perms.includes("governance:view") || perms.includes("governance:edit")) {
      roles.push(role as Role);
    }
  }
  return roles;
}

interface NotifyGovernanceArgs {
  orderId: string;
  orderCode: string;
  orderName: string;
  /** ID of the user who created/triggered this — they will NOT be notified themselves */
  triggeredByUserId?: string | null;
  /** Optional: distinguishes "created" vs "flagged later" */
  action?: "created" | "flagged";
}

/**
 * Notify all governance-eligible users that an order requires governance review.
 * Creates one Notification row per eligible user (so each user sees it in their bell).
 *
 * Excludes the user who triggered the action (no point notifying yourself).
 * Skips users who are inactive or deleted.
 *
 * Returns the number of notifications created.
 */
export async function notifyGovernanceOfOrder(args: NotifyGovernanceArgs): Promise<number> {
  const { orderId, orderCode, orderName, triggeredByUserId, action = "created" } = args;

  console.log(`[notifyGov] START — orderCode=${orderCode}, triggeredBy=${triggeredByUserId}, action=${action}`);

  const eligibleRoles = getGovernanceNotifiableRoles();
  console.log(`[notifyGov] eligible roles (${eligibleRoles.length}):`, eligibleRoles);

  // Find all active users with eligible roles
  const recipients = await prisma.user.findMany({
    where: {
      role: { in: eligibleRoles as any },
      isActive: true,
      ...(triggeredByUserId ? { id: { not: triggeredByUserId } } : {}),
    },
    select: { id: true, email: true, role: true },
  });

  console.log(`[notifyGov] found ${recipients.length} recipients:`,
    recipients.map((r: any) => `${r.email}(${r.role})`).join(', '));

  if (recipients.length === 0) {
    console.warn('[notifyGov] No recipients — nothing to do');
    return 0;
  }

  const title =
    action === "created"
      ? `New order needs governance review: ${orderCode}`
      : `Order flagged for governance review: ${orderCode}`;

  const message =
    action === "created"
      ? `Order "${orderName}" was created and is marked for governance review. Please review and add the relevant policy.`
      : `Order "${orderName}" has been flagged for governance review. Please review and add the relevant policy.`;

  // Create one notification per recipient (so unread counts work per-user)
  try {
    const result = await prisma.notification.createMany({
      data: recipients.map((u: { id: string }) => ({
        type: "GOV_REVIEW_REQUESTED",
        title,
        message,
        severity: "info",
        entityType: "order",
        entityId: orderId,
        entityCode: orderCode,
        userId: u.id,
      })),
    });

    console.log(`[notifyGov] SUCCESS — created ${result.count} notifications`);
    return result.count;
  } catch (err) {
    console.error('[notifyGov] createMany FAILED:', err);
    throw err;
  }
}
