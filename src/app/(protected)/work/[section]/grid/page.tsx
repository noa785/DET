// src/app/(protected)/work/[section]/grid/page.tsx: edit cells directly
export const dynamic = 'force-dynamic';
import { notFound } from 'next/navigation';
import { sectionFromSlug } from '@/lib/det/shared';
import { loadOrders, loadOwnerSuggestions, loadUnits } from '@/lib/det/server';
import GridClient from './GridClient';

export default async function GridPage({ params }: { params: { section: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  const [orders, owners, units] = await Promise.all([loadOrders(section), loadOwnerSuggestions(), loadUnits()]);
  return <GridClient section={section} initial={orders} owners={owners} units={units} />;
}
