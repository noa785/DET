// src/app/(protected)/work/[section]/page.tsx: All Orders for one section
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { canEditSection, sectionFromSlug } from '@/lib/det/shared';
import { requireAuth } from '@/lib/auth/session';
import { loadOrders, loadOwnerSuggestions, loadUnits } from '@/lib/det/server';
import OrdersClient from './OrdersClient';

export default async function SectionOrdersPage({ params, searchParams }: { params: { section: string }; searchParams: { open?: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  const user = await requireAuth();
  const [orders, owners, units] = await Promise.all([loadOrders(section), loadOwnerSuggestions(), loadUnits()]);
  return <OrdersClient section={section} initial={orders} owners={owners} units={units} openId={searchParams.open ?? null}
    canEdit={canEditSection(user.role, section)} />;
}
