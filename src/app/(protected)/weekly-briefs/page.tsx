// src/app/(protected)/weekly-briefs/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import WeeklyBriefsClient from './WeeklyBriefsClient';

export const metadata: Metadata = { title: 'Weekly Briefs - DGCC PES' };

export default async function WeeklyBriefsPage() {
  const user = await requireAuth();

  const [briefs, units, orders] = await Promise.all([
    prisma.weeklyBrief.findMany({
      where: { isDeleted: false },
      include: {
        unit: { select: { code: true, name: true, colorHex: true } },
        preparedBy: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.order.findMany({
      where: { isDeleted: false, status: { not: 'CANCELLED' } },
      select: { id: true, orderCode: true, name: true, status: true },
      orderBy: { orderCode: 'asc' },
      take: 500,
    }),
  ]);

  return (
    <WeeklyBriefsClient
      briefs={JSON.parse(JSON.stringify(briefs))}
      units={units}
      orders={orders}
    />
  );
}
