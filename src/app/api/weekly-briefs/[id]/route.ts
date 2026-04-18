// src/app/api/weekly-briefs/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth } from '@/lib/auth/session';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { title, unitId, weekStart, weekEnd, narrative, bullets, orderIds, status } = body;

    const existing = await prisma.weeklyBrief.findUnique({ where: { id: params.id } });
    if (!existing || existing.isDeleted) {
      return NextResponse.json({ error: 'Brief not found' }, { status: 404 });
    }

    const content = {
      narrative: narrative ?? '',
      bullets: typeof bullets === 'string' ? bullets.split('\n').filter((b: string) => b.trim()) : (bullets || []),
      orderIds: orderIds || [],
    };

    const brief = await prisma.weeklyBrief.update({
      where: { id: params.id },
      data: {
        ...(title !== undefined && { title: title.trim() }),
        ...(unitId !== undefined && { unitId: unitId || null }),
        ...(weekStart !== undefined && { weekStart: weekStart ? new Date(weekStart) : null }),
        ...(weekEnd !== undefined && { weekEnd: weekEnd ? new Date(weekEnd) : null }),
        ...(status !== undefined && { status }),
        ...(status === 'PUBLISHED' && { publishedAt: new Date() }),
        content,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        module: 'weekly-briefs',
        recordId: brief.id,
        recordCode: brief.briefCode,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      },
    });

    return NextResponse.json(brief);
  } catch (error: any) {
    console.error('Update brief error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const user = await requireAuth();

    await prisma.weeklyBrief.update({
      where: { id: params.id },
      data: { isDeleted: true },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        module: 'weekly-briefs',
        recordId: params.id,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
