// src/app/(protected)/work/[section]/grid/page.tsx: edit cells directly
export const dynamic = 'force-dynamic';
import { notFound, redirect } from 'next/navigation';
import { SECTIONS, canEditSection, sectionFromSlug } from '@/lib/det/shared';
import { loadOrders, loadOwnerSuggestions, loadUnits } from '@/lib/det/server';
import { requireAuth } from '@/lib/auth/session';
import GridClient from './GridClient';

export default async function GridPage({ params }: { params: { section: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  // Only the section's own team edits it; everyone else is sent to the read-only list.
  const user = await requireAuth();
  if (!canEditSection(user.role, section)) redirect(`/work/${SECTIONS[section].slug}`);
  const [orders, owners, units] = await Promise.all([loadOrders(section), loadOwnerSuggestions(), loadUnits()]);
  return <GridClient section={section} initial={orders} owners={owners} units={units} />;
}
