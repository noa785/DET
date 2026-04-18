// src/app/(protected)/gov-tasks/new/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import GovTaskForm from '../_components/GovTaskForm';

export const metadata: Metadata = { title: 'New Governance Task — DGCC PES' };

export default async function NewGovTaskPage({
  searchParams,
}: {
  searchParams: { govItemId?: string };
}) {
  const user = await requireAuth();
  if (!can(user, 'governance:edit')) redirect('/gov-tasks');

  const [govItems, users] = await Promise.all([
    prisma.governanceItem.findMany({
      where: { isDeleted: false, status: { not: 'ARCHIVED' } },
      select: { id: true, govCode: true, title: true },
      orderBy: { govCode: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <GovTaskForm
      mode="create"
      govItems={govItems}
      users={users}
      defaultGovItemId={searchParams.govItemId}
    />
  );
}
