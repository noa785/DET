// src/app/api/weekly-briefs/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth } from '@/lib/auth/session';

async function nextBriefCode(): Promise<string> {
  const seq = await prisma.sequence.upsert({
    where: { id: 'brief' },
    update: { current: { increment: 1 } },
    create: { id: 'brief', prefix: 'WB', padding: 4, current: 1 },
  });
  return `${seq.prefix}-${String(seq.current).padStart(seq.padding, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const user = await requireAuth();
    const body = await req.json();
    const { title, unitId, weekStart, weekEnd, narrative, bullets, orderIds } = body;

    if (!title?.trim()) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const briefCode = await nextBriefCode();

    const content = {
      narrative: narrative || '',
      bullets: (bullets || '').split('\n').filter((b: string) => b.trim()),
      orderIds: orderIds || [],
    };

    const brief = await prisma.weeklyBrief.create({
      data: {
        briefCode,
        title: title.trim(),
        status: 'DRAFT',
        unitId: unitId || null,
        weekStart: weekStart ? new Date(weekStart) : null,
        weekEnd: weekEnd ? new Date(weekEnd) : null,
        content,
        preparedById: user.id,
        createdById: user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        module: 'weekly-briefs',
        recordId: brief.id,
        recordCode: brief.briefCode,
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
      },
    });

    return NextResponse.json(brief, { status: 201 });
  } catch (error: any) {
    console.error('Create brief error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
