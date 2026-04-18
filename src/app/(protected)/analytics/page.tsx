// src/app/(protected)/analytics/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';

export const metadata: Metadata = { title: 'Analytics — DGCC PES' };

export default async function AnalyticsPage() {
  await requireAuth();

  const [orders, units, govItems] = await Promise.all([
    prisma.order.findMany({
      where: { isDeleted: false },
      select: { status: true, priority: true, percentComplete: true, unitId: true, type: true, dueDate: true },
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, colorHex: true } }),
    prisma.governanceItem.findMany({ where: { isDeleted: false }, select: { status: true, type: true } }),
  ]);

  // Status breakdown
  const statusCounts: Record<string, number> = {};
  const priorityCounts: Record<string, number> = {};
  const typeCounts: Record<string, number> = {};
  const unitCounts: Record<string, { code: string; color: string; count: number; completed: number }> = {};
  let totalPercent = 0;
  let overdueCount = 0;
  const now = new Date();

  for (const o of orders) {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
    priorityCounts[o.priority] = (priorityCounts[o.priority] || 0) + 1;
    typeCounts[o.type] = (typeCounts[o.type] || 0) + 1;
    totalPercent += o.percentComplete;
    if (o.dueDate && new Date(o.dueDate) < now && o.status !== 'DONE' && o.status !== 'CANCELLED') overdueCount++;

    if (o.unitId) {
      if (!unitCounts[o.unitId]) {
        const u = units.find(u => u.id === o.unitId);
        unitCounts[o.unitId] = { code: u?.code || '?', color: u?.colorHex || '#3b82f6', count: 0, completed: 0 };
      }
      unitCounts[o.unitId].count++;
      if (o.status === 'DONE') unitCounts[o.unitId].completed++;
    }
  }

  const avgCompletion = orders.length > 0 ? Math.round(totalPercent / orders.length) : 0;

  // Gov stats
  const govStatusCounts: Record<string, number> = {};
  for (const g of govItems) {
    govStatusCounts[g.status] = (govStatusCounts[g.status] || 0) + 1;
  }

  const STATUS_COLORS: Record<string, string> = {
    NOT_STARTED: '#6b7280', IN_PROGRESS: '#3b82f6', UNDER_REVIEW: '#f59e0b',
    BLOCKED: '#ef4444', ON_HOLD: '#8b5cf6', DONE: '#10b981', CANCELLED: '#374151',
  };
  const PRIO_COLORS: Record<string, string> = {
    LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display font-bold text-2xl text-[var(--text)]">📈 Analytics</h1>
        <p className="text-sm text-[var(--text-3)] mt-0.5">Portfolio performance overview</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total Orders', value: orders.length, color: '#3b82f6' },
          { label: 'Avg Completion', value: `${avgCompletion}%`, color: '#10b981' },
          { label: 'Overdue', value: overdueCount, color: overdueCount > 0 ? '#ef4444' : '#10b981' },
          { label: 'Gov Items', value: govItems.length, color: '#8b5cf6' },
        ].map(k => (
          <div key={k.label} className="pes-card p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-3)] mb-1">{k.label}</div>
            <div className="font-display font-bold text-2xl" style={{ color: k.color }}>{k.value}</div>
          </div>
        ))}
      </div>

      {/* Status Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="pes-card p-5">
          <h3 className="font-semibold text-[var(--text)] text-[14px] mb-4">Orders by Status</h3>
          <div className="space-y-2.5">
            {Object.entries(statusCounts).sort((a, b) => b[1] - a[1]).map(([status, count]) => (
              <div key={status}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[var(--text-2)]">{status.replace(/_/g, ' ')}</span>
                  <span className="text-[var(--text-2)] font-semibold">{count}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${(count / orders.length) * 100}%`,
                    background: STATUS_COLORS[status] || '#6b7280',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="pes-card p-5">
          <h3 className="font-semibold text-[var(--text)] text-[14px] mb-4">Orders by Priority</h3>
          <div className="space-y-2.5">
            {['CRITICAL','HIGH','MEDIUM','LOW'].map(p => (
              <div key={p}>
                <div className="flex justify-between text-[12px] mb-1">
                  <span className="text-[var(--text-2)]">{p}</span>
                  <span className="text-[var(--text-2)] font-semibold">{priorityCounts[p] || 0}</span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{
                    width: `${((priorityCounts[p] || 0) / Math.max(orders.length, 1)) * 100}%`,
                    background: PRIO_COLORS[p] || '#6b7280',
                  }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* By Unit */}
      <div className="pes-card p-5">
        <h3 className="font-semibold text-[var(--text)] text-[14px] mb-4">Orders by Unit</h3>
        {Object.keys(unitCounts).length === 0 ? (
          <p className="text-sm text-[var(--text-3)]">No unit data available</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Object.values(unitCounts).sort((a, b) => b.count - a.count).map(u => (
              <div key={u.code} className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-3 text-center">
                <div className="text-[11px] font-semibold mb-1" style={{ color: u.color }}>{u.code}</div>
                <div className="font-display font-bold text-xl text-[var(--text)]">{u.count}</div>
                <div className="text-[10px] text-[var(--text-3)]">{u.completed} done</div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* By Type */}
      <div className="pes-card p-5">
        <h3 className="font-semibold text-[var(--text)] text-[14px] mb-4">Orders by Type</h3>
        <div className="flex flex-wrap gap-3">
          {Object.entries(typeCounts).sort((a, b) => b[1] - a[1]).map(([type, count]) => (
            <div key={type} className="bg-[var(--surface)] rounded-lg border border-[var(--border)] px-4 py-2.5">
              <span className="text-[11px] text-[var(--text-3)] mr-2">{type.replace(/_/g, ' ')}</span>
              <span className="text-[var(--text)] font-bold">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Gov Breakdown */}
      {govItems.length > 0 && (
        <div className="pes-card p-5">
          <h3 className="font-semibold text-[var(--text)] text-[14px] mb-4">Governance Items by Status</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(govStatusCounts).map(([status, count]) => (
              <div key={status} className="bg-[var(--surface)] rounded-lg border border-[var(--border)] px-4 py-2.5">
                <span className="text-[11px] text-[var(--text-3)] mr-2">{status.replace(/_/g, ' ')}</span>
                <span className="text-[var(--text)] font-bold">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
