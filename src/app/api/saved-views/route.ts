import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import { getSession } from "@/lib/auth/session";

// GET: List saved views for current user
export async function GET(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const views = await prisma.savedView.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ data: views });
  } catch (error: any) {
    console.error("Saved views GET error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// POST: Create saved view
export async function POST(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { name, filters } = body;

    if (!name || !filters) {
      return NextResponse.json({ error: "Name and filters required" }, { status: 400 });
    }

    const view = await prisma.savedView.create({
      data: {
        name,
        filters: JSON.stringify(filters),
        userId: user.id,
      },
    });

    return NextResponse.json({ data: view });
  } catch (error: any) {
    console.error("Saved views POST error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// DELETE: Delete saved view
export async function DELETE(req: NextRequest) {
  try {
    const user = await getSession();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    await prisma.savedView.delete({
      where: { id, userId: user.id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Saved views DELETE error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
