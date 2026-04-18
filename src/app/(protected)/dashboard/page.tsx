// src/app/(protected)/dashboard/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { computeRAG, isOverdue, computeProjectRollup, computeProjectHealth } from '@/lib/business-logic/orders';
import DashboardClient from './DashboardClient';
import type { Order } from '@/types';

export const metadata: Metadata = { title: 'Dashboard — DGCC PES' };

export default async function DashboardPage() {
  const user = await requireAuth();

  // ── Fetch data server-side ──────────────────────────────────
  const [orders, govItems, govTasks, changes] = await Promise.all([
    prisma.order.findMany({
      where: { isDeleted: false },
      include: {
        unit:    { select: { code: true, name: true, colorHex: true } },
        project: { select: { code: true, name: true } },
        owner:   { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.governanceItem.count({ where: { isDeleted: false } }),
    prisma.governanceTask.count({ where: { isDeleted: false, status: { not: 'DONE' } } }),
    prisma.changeRequest.count({ where: { isDeleted: false, govReviewStatus: 'PENDING' } }),
  ]);

  // ── Compute stats ───────────────────────────────────────────
  const total    = orders.length;
  const done     = orders.filter(o => o.status === 'DONE' || o.status === 'CANCELLED').length;
  const active   = orders.filter(o => o.status === 'IN_PROGRESS').length;
  const review   = orders.filter(o => o.status === 'UNDER_REVIEW').length;
  const blocked  = orders.filter(o => o.status === 'BLOCKED').length;
  const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;

  const enriched = orders.map(o => ({
    ...o,
    unitCode:    o.unit?.code,
    unitName:    o.unit?.name,
    unitColor:   o.unit?.colorHex,
    projectName: o.project?.name,
    ownerName:   o.owner?.name,
    effectiveRAG: computeRAG({
      status: o.status as any,
      percentComplete: o.percentComplete,
      dueDate: o.dueDate?.toISOString(),
      ragOverride: o.ragOverride as any,
    }),
    isOverdue: isOverdue({
      status: o.status as any,
      percentComplete: o.percentComplete,
      dueDate: o.dueDate?.toISOString(),
    }),
  }));

  const overdueOrders   = enriched.filter(o => o.isOverdue).slice(0, 6);
  const activeOrders    = enriched.filter(o => o.status === 'IN_PROGRESS').slice(0, 6);

  // ── Project rollups ─────────────────────────────────────────
  const projectNames = [...new Set(orders.map(o => o.project?.name).filter(Boolean) as string[])];
  const projectHealth = projectNames.slice(0, 6).map(pn => {
    const tasks = enriched.filter(o => o.projectName === pn);
    const rollup = computeProjectRollup(tasks.map(t => ({ percentComplete: t.percentComplete, status: t.status as any })));
    return { name: pn, rollup, health: computeProjectHealth(rollup), taskCount: tasks.length };
  });

  // ── Status distribution ─────────────────────────────────────
  const statusDist = [
    { label: 'Done',        count: done,                                                    color: '#10b981' },
    { label: 'In Progress', count: active,                                                  color: '#3b82f6' },
    { label: 'Review',      count: review,                                                  color: '#f59e0b' },
    { label: 'Blocked',     count: blocked,                                                 color: '#ef4444' },
    { label: 'Not Started', count: orders.filter(o => o.status === 'NOT_STARTED').length,   color: '#374151' },
    { label: 'On Hold',     count: orders.filter(o => o.status === 'ON_HOLD').length,       color: '#6b7280' },
  ];

  // ── Unit distribution ────────────────────────────────────────
  const unitMap: Record<string, { count: number; color: string | null }> = {};
  orders.forEach(o => {
    if (!o.unit?.code) return;
    if (!unitMap[o.unit.code]) unitMap[o.unit.code] = { count: 0, color: o.unit.colorHex };
    unitMap[o.unit.code].count++;
  });
  const unitDist = Object.entries(unitMap)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 8)
    .map(([code, v]) => ({ code, ...v }));

  const stats = {
    total, done, active, review, blocked, completionRate,
    govItems, openGovTasks: govTasks, pendingChanges: changes,
  };

  return (
    <DashboardClient
      stats={stats}
      statusDist={statusDist}
      unitDist={unitDist}
      overdueOrders={overdueOrders as any}
      activeOrders={activeOrders as any}
      projectHealth={projectHealth}
      userName={user.name}
    />
  );
}
