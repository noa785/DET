// src/lib/notifications/governance.ts
// Helpers for creating governance-related notifications
// Used when an Order is created/updated and requires governance review.

import { prisma } from "@/lib/prisma/client";

/**
 * Roles that should be notified when an order needs governance review.
 * Anyone with governance:view OR governance:edit permission.
 * Listed explicitly to match Prisma enum values exactly.
 *
 * NOTE: DATA_ANALYST is intentionally excluded — it exists in the local
 * Prisma schema but is not yet present in the production Postgres enum.
 * Adding it would cause `findMany` to fail with error 22P02.
 */
const GOVERNANCE_NOTIFIABLE_ROLES = [
  "SUPER_ADMIN",
  "ADMIN",
  "GOVERNANCE_ADMIN",
  "TECH_ADMIN",
  "GOV_EDITOR",
  "UNIT_MANAGER",
  "PROJECT_OWNER",
  "EDITOR",
  "VIEWER",
  "IMPORT_VIEWER",
] as const;

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

  console.log(`[notifyGov] START orderCode=${orderCode} triggeredBy=${triggeredByUserId} action=${action}`);

  // Find all active users with eligible roles
  let recipients: Array<{ id: string; email: string; role: string }> = [];
  try {
    recipients = await prisma.user.findMany({
      where: {
        role: { in: GOVERNANCE_NOTIFIABLE_ROLES as any },
        isActive: true,
        ...(triggeredByUserId ? { id: { not: triggeredByUserId } } : {}),
      },
      select: { id: true, email: true, role: true },
    });
  } catch (err) {
    console.error('[notifyGov] findMany users FAILED:', err);
    throw err;
  }

  console.log(`[notifyGov] found ${recipients.length} recipients:`,
    recipients.map((r) => `${r.email}(${r.role})`).join(', '));

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

  // Create notifications one by one — same proven pattern as rules-engine.ts
  // (avoids createMany / $transaction issues on Supabase serverless)
  let createdCount = 0;
  for (const recipient of recipients) {
    try {
      await prisma.notification.create({
        data: {
          type: "GOV_REVIEW_REQUESTED",
          title,
          message,
          severity: "info",
          entityType: "order",
          entityId: orderId,
          entityCode: orderCode,
          userId: recipient.id,
        },
      });
      createdCount++;
    } catch (err) {
      console.error(`[notifyGov] create failed for ${recipient.email}:`, err);
      // Keep going — one bad recipient shouldn't block others
    }
  }

  console.log(`[notifyGov] SUCCESS — created ${createdCount}/${recipients.length} notifications`);
  return createdCount;
}
