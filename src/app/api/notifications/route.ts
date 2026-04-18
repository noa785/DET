// src/app/api/notifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getSession } from "@/lib/auth/session";
import { runBusinessRules } from "@/lib/business-logic/rules-engine";

// GET: Fetch notifications for current user
export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = parseInt(searchParams.get("limit") || "20");

    const where: any = {
      OR: [
        { userId: user.id },
        { userId: null }, // broadcasts
      ],
    };
    if (unreadOnly) where.isRead = false;

    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
      }),
      prisma.notification.count({
        where: {
          ...where,
          isRead: false,
        },
      }),
    ]);

    return NextResponse.json({ data: notifications, unreadCount });
  } catch (error: any) {
    console.error("Notifications GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// PATCH: Mark notification(s) as read
export async function PATCH(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { id, markAll } = body;

    if (markAll) {
      await prisma.notification.updateMany({
        where: {
          OR: [{ userId: user.id }, { userId: null }],
          isRead: false,
        },
        data: { isRead: true, readAt: new Date() },
      });
    } else if (id) {
      await prisma.notification.update({
        where: { id },
        data: { isRead: true, readAt: new Date() },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Notifications PATCH error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Manually trigger business rules
export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    // Only admins can trigger rules manually
    if (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }

    const result = await runBusinessRules();
    return NextResponse.json({ success: true, result });
  } catch (error: any) {
    console.error("Business rules error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
