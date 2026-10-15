// src/app/(protected)/work/[section]/new/page.tsx: Add Order
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { sectionFromSlug } from '@/lib/det/shared';
import { loadOwnerSuggestions, loadUnits } from '@/lib/det/server';
import { requireAuth } from '@/lib/auth/session';
import NewOrderClient from './NewOrderClient';

export default async function NewOrderPage({ params }: { params: { section: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  const user = await requireAuth();
  const [owners, units] = await Promise.all([loadOwnerSuggestions(), loadUnits()]);
  return <NewOrderClient section={section} owners={owners} units={units} me={user.name} />;
}
