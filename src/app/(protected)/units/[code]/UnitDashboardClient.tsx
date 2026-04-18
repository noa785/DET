'use client';
// src/app/(protected)/units/[code]/UnitDashboardClient.tsx

import { useState, useEffect } from 'react';
import Link from 'next/link';

interface UnitData {
  unit: { id: string; code: string; name: string; colorHex: string | null };
  stats: { total: number; done: number; inProgress: number; blocked: number; overdue: number; avgCompletion: number; govItems: number; govTasksOpen: number };
  statusDist: { label: string; count: number; color: string }[];
  priorityDist: { label: string; count: number; color: string }[];
  orders: { id: string; orderCode: string; name: string; type: string; status: string; priority: string; percentComplete: number; ownerName: string | null; projectName: string | null; dueDate: string | null; isOverdue: boolean }[];
  upcomingDue: { id: string; orderCode: string; name: string; dueDate: string | null; percentComplete: number }[];
  critical: { id: string; orderCode: string; name: string; status: string; percentComplete: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-slate-500/15 text-[var(--text-2)]', IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  UNDER_REVIEW: 'bg-amber-500/15 text-amber-400', BLOCKED: 'bg-red-500/15 text-red-400',
  ON_HOLD: 'bg-slate-500/15 text-[var(--text-3)]', DONE: 'bg-green-500/15 text-green-400', CANCELLED: 'bg-slate-500/15 text-[var(--text-3)]',
};

export default function UnitDashboardClient({ unitCode }: { unitCode: string }) {
  const [data, setData] = useState<UnitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'all' | 'overdue' | 'upcoming' | 'critical'>('all');

  useEffect(() => {
    fetch(`/api/dashboard/unit?code=${unitCode}`)
      .then(r => r.json())
      .then(d => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, [unitCode]);

  if (loading) return <div className="text-[var(--text-3)] p-8 text-center">Loading unit dashboard...</div>;
  if (!data) return <div className="text-red-400 p-8 text-center">Failed to load unit data</div>;

  const { unit, stats, statusDist, priorityDist, orders, upcomingDue, critical } = data;
  const color = unit.colorHex || '#3b82f6';
  const overdueOrders = orders.filter(o => o.isOverdue);

  const displayOrders = tab === 'all' ? orders
    : tab === 'overdue' ? overdueOrders
    : tab === 'upcoming' ? orders.filter(o => upcomingDue.some(u => u.id === o.id))
    : orders.filter(o => critical.some(c => c.id === o.id));

  return (
    <div className="space-y-5 max-w-6xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-[var(--text-3)] hover:text-[var(--text-2)] text-sm">&larr; Back</Link>
        <div className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-[var(--text)] text-sm" style={{ background: color }}>
          {unit.code.slice(0, 2)}
        </div>
        <div>
          <h1 className="font-display font-bold text-xl text-[var(--text)]">{unit.name}</h1>
          <span className="text-xs text-[var(--text-3)]">Unit Code: {unit.code}</span>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
        <KPI label="Total Orders" value={stats.total} color="#3b82f6" />
        <KPI label="Completed" value={stats.done} color="#10b981" />
        <KPI label="In Progress" value={stats.inProgress} color="#3b82f6" />
        <KPI label="Blocked" value={stats.blocked} color="#ef4444" />
        <KPI label="Overdue" value={stats.overdue} color="#ef4444" highlight={stats.overdue > 0} />
        <KPI label="Avg Completion" value={`${stats.avgCompletion}%`} color="#8b5cf6" />
        <KPI label="Gov Items" value={stats.govItems} color="#10b981" />
        <KPI label="Open Gov Tasks" value={stats.govTasksOpen} color="#f59e0b" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Status Distribution */}
        <div className="pes-card p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-4">Orders by Status</div>
          <div className="space-y-2">
            {statusDist.filter(s => s.count > 0).map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--text-2)] w-24">{s.label}</span>
                <div className="flex-1 bg-[#1a2236] rounded-full h-5 overflow-hidden">
                  <div className="h-full rounded-full transition-all flex items-center pl-2" style={{ width: `${Math.max((s.count / Math.max(stats.total, 1)) * 100, 8)}%`, background: s.color }}>
                    <span className="text-[10px] font-bold text-[var(--text)]">{s.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Priority Distribution */}
        <div className="pes-card p-5">
          <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-4">Orders by Priority</div>
          <div className="space-y-2">
            {priorityDist.filter(p => p.count > 0).map(p => (
              <div key={p.label} className="flex items-center gap-3">
                <span className="text-[12px] text-[var(--text-2)] w-24">{p.label}</span>
                <div className="flex-1 bg-[#1a2236] rounded-full h-5 overflow-hidden">
                  <div className="h-full rounded-full transition-all flex items-center pl-2" style={{ width: `${Math.max((p.count / Math.max(stats.total, 1)) * 100, 8)}%`, background: p.color }}>
                    <span className="text-[10px] font-bold text-[var(--text)]">{p.count}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Orders Table */}
      <div className="pes-card p-5">
        {/* Sub-tabs */}
        <div className="flex gap-2 mb-4 flex-wrap">
          {[
            { id: 'all' as const, label: `All Orders (${orders.length})` },
            { id: 'overdue' as const, label: `Overdue (${overdueOrders.length})`, warn: overdueOrders.length > 0 },
            { id: 'upcoming' as const, label: `Due Soon (${upcomingDue.length})` },
            { id: 'critical' as const, label: `Critical (${critical.length})`, warn: critical.length > 0 },
          ].map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${
                tab === t.id ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                : t.warn ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                : 'bg-[#1a2236] text-[var(--text-2)] hover:text-[var(--text)]'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        {displayOrders.length === 0 ? (
          <div className="text-center py-8 text-[var(--text-3)] text-sm">No orders in this view</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wider text-[var(--text-3)] border-b border-[var(--border)]">
                  <th className="text-left py-2 px-2">Code</th>
                  <th className="text-left py-2 px-2">Name</th>
                  <th className="text-left py-2 px-2">Status</th>
                  <th className="text-left py-2 px-2">Priority</th>
                  <th className="text-left py-2 px-2">Progress</th>
                  <th className="text-left py-2 px-2">Owner</th>
                  <th className="text-left py-2 px-2">Due</th>
                </tr>
              </thead>
              <tbody>
                {displayOrders.map(o => (
                  <tr key={o.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                    <td className="py-2.5 px-2">
                      <Link href={`/orders/${o.id}`} className="text-blue-400 hover:text-blue-300 font-mono font-bold text-[11px]">{o.orderCode}</Link>
                    </td>
                    <td className="py-2.5 px-2 text-[var(--text)] max-w-[250px] truncate">{o.name}</td>
                    <td className="py-2.5 px-2">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[o.status] || ''}`}>
                        {o.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-2.5 px-2 text-[var(--text-2)]">{o.priority}</td>
                    <td className="py-2.5 px-2">
                      <div className="flex items-center gap-2">
                        <div className="w-16 bg-[#1a2236] rounded-full h-1.5">
                          <div className="h-full rounded-full bg-blue-500" style={{ width: `${o.percentComplete}%` }} />
                        </div>
                        <span className="text-[var(--text-2)] text-[11px]">{o.percentComplete}%</span>
                      </div>
                    </td>
                    <td className="py-2.5 px-2 text-[var(--text-2)]">{o.ownerName || '—'}</td>
                    <td className={`py-2.5 px-2 ${o.isOverdue ? 'text-red-400 font-semibold' : 'text-[var(--text-2)]'}`}>
                      {o.dueDate ? new Date(o.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KPI({ label, value, color, highlight }: { label: string; value: string | number; color: string; highlight?: boolean }) {
  return (
    <div className={`pes-card p-3 text-center ${highlight ? 'border-red-500/30 bg-red-500/5' : ''}`}>
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-3)] mb-1">{label}</div>
      <div className="text-xl font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
