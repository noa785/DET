// src/app/(protected)/work/[section]/page.tsx: All Orders for one section
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { sectionFromSlug } from '@/lib/det/shared';
import { loadOrders, loadOwnerSuggestions, loadUnits } from '@/lib/det/server';
import OrdersClient from './OrdersClient';

export default async function SectionOrdersPage({ params, searchParams }: { params: { section: string }; searchParams: { open?: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  const [orders, owners, units] = await Promise.all([loadOrders(section), loadOwnerSuggestions(), loadUnits()]);
  return <OrdersClient section={section} initial={orders} owners={owners} units={units} openId={searchParams.open ?? null} />;
}
