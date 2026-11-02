// src/app/(protected)/kpis/page.tsx
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { loadGovItems, loadOrders, loadSystems, loadUnits } from '@/lib/det/server';
import { downloadableSections } from '@/lib/det/shared';
import KpiClient from './KpiClient';

export const metadata: Metadata = { title: 'Performance KPIs | Digital Enterprise Tracker' };

export default async function KpisPage() {
  const user = await requireAuth();
  const [orders, systems, gov, units] = await Promise.all([loadOrders(), loadSystems(), loadGovItems(), loadUnits()]);
  return <KpiClient orders={orders} systems={systems} gov={gov} unitCount={units.length} userName={user.name} reportSections={downloadableSections(user.role)} />;
}
