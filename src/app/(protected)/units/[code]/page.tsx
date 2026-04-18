// src/app/(protected)/units/[code]/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import UnitDashboardClient from './UnitDashboardClient';

export const metadata: Metadata = { title: 'Unit Dashboard — DGCC PES' };

export default async function UnitDashboardPage({ params }: { params: { code: string } }) {
  const user = await requireAuth();

  const unit = await prisma.unit.findUnique({ where: { code: params.code } });
  if (!unit) redirect('/dashboard');

  return <UnitDashboardClient unitCode={params.code} />;
}
