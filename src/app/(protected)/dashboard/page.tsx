// src/app/(protected)/dashboard/page.tsx
// The dashboard is now the Performance KPIs page.
import { redirect } from 'next/navigation';
export default function DashboardRedirect() { redirect('/kpis'); }
