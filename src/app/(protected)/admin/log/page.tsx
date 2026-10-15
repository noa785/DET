// src/app/(protected)/admin/log/page.tsx: Admin Log (who did what, and when)
export const dynamic = 'force-dynamic';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { hasPermission } from '@/types';
import { logOverview } from '@/lib/det/adminlog';
import AdminLogClient from './AdminLogClient';

export default async function AdminLogPage() {
  const user = await requireAuth();
  if (!hasPermission(user.role, 'audit:view')) redirect('/kpis');
  const overview = await logOverview();
  return <AdminLogClient overview={overview} canDownload={hasPermission(user.role, 'audit:export')} />;
}
