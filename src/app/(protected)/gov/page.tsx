// src/app/(protected)/gov/page.tsx: Governance register (projects and ELI units)
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { loadGovItems, loadOwnerSuggestions, loadProjects, loadUnits } from '@/lib/det/server';
import { canEditGovernance } from '@/lib/det/shared';
import { getT } from '@/lib/i18n/server';
import GovClient from './GovClient';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: `${t('Governance')} | ${t('Digital Enterprise Tracker')}` };
}

export default async function GovPage() {
  const user = await requireAuth();
  const [items, projects, units, owners] = await Promise.all([loadGovItems(), loadProjects(), loadUnits(), loadOwnerSuggestions()]);
  return <GovClient initial={items} projects={projects} units={units} owners={owners} canEdit={canEditGovernance(user.role)} />;
}
