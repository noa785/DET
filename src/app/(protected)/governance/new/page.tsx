// src/app/(protected)/governance/new/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import GovItemForm from '../_components/GovItemForm';

export const metadata: Metadata = { title: 'New Governance Item — DGCC PES' };

export default async function NewGovItemPage({
  searchParams,
}: {
  searchParams: { fromOrder?: string; orderCode?: string; orderName?: string };
}) {
  const user = await requireAuth();
  if (!can(user, 'governance:create')) redirect('/governance');

  const [units, users] = await Promise.all([
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  // Pre-fill title from order if coming from Gov. Review Dashboard
  const prefillTitle = searchParams.orderName
    ? `Gov. Review — ${decodeURIComponent(searchParams.orderName)}`
    : undefined;
  const prefillNotes = searchParams.orderCode
    ? `Linked to order: ${decodeURIComponent(searchParams.orderCode)}${searchParams.orderName ? ' — ' + decodeURIComponent(searchParams.orderName) : ''}`
    : undefined;

  return (
    <GovItemForm
      mode="create"
      units={units.map(u => ({ id: u.id, code: u.code ?? '', name: u.name }))}
      users={users.map(u => ({ id: u.id, name: u.name }))}
      prefillTitle={prefillTitle}
      prefillNotes={prefillNotes}
      fromOrderCode={searchParams.orderCode}
    />
  );
}
