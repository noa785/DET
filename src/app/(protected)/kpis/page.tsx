// src/app/(protected)/kpis/page.tsx
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { loadOrders, loadSystems } from '@/lib/det/server';
import KpiClient from './KpiClient';

export const metadata: Metadata = { title: 'Performance KPIs | DTC Enterprise Tracker' };

export default async function KpisPage() {
  const user = await requireAuth();
  const [orders, systems] = await Promise.all([loadOrders(), loadSystems()]);
  return <KpiClient orders={orders} systems={systems} userName={user.name} />;
}
