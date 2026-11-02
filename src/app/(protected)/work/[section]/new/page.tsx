// src/app/(protected)/work/[section]/new/page.tsx: Add Order
export const dynamic = 'force-dynamic';
import { notFound, redirect } from 'next/navigation';
import { SECTIONS, canEditSection, editableSections, sectionFromSlug } from '@/lib/det/shared';
import { loadOwnerSuggestions, loadProjects, loadUnits } from '@/lib/det/server';
import { requireAuth } from '@/lib/auth/session';
import NewOrderClient from './NewOrderClient';

export default async function NewOrderPage({ params }: { params: { section: string } }) {
  const section = sectionFromSlug(params.section);
  if (!section) notFound();
  const user = await requireAuth();
  // Only the section's own team adds orders; everyone else is sent to the read-only list.
  if (!canEditSection(user.role, section)) redirect(`/work/${SECTIONS[section].slug}`);
  const [owners, units, projects] = await Promise.all([loadOwnerSuggestions(), loadUnits(), loadProjects()]);
  return <NewOrderClient section={section} sections={editableSections(user.role)} owners={owners} units={units} projects={projects} me={user.name} />;
}
