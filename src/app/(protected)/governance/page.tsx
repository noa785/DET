// src/app/(protected)/governance/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Governance Registry — DGCC PES' };

const STATUS_C: Record<string, string> = {
  DRAFT: '#6b7280', ACTIVE: '#10b981', UNDER_REVIEW: '#f59e0b',
  SUPERSEDED: '#9ca3af', ARCHIVED: '#374151',
};
const RISK_C: Record<string, string> = {
  CRITICAL: '#ef4444', HIGH: '#f87171', MEDIUM: '#f59e0b', LOW: '#10b981',
};
const TYPE_LABELS: Record<string, string> = {
  POLICY: 'Policy', PROCEDURE: 'Procedure', STANDARD: 'Standard',
  GUIDELINE: 'Guideline', COMMITTEE_DECISION: 'Committee', CONTROL: 'Control',
  COMPLIANCE_REQUIREMENT: 'Compliance', UPDATE_ITEM: 'Update Item',
};

export default async function GovernancePage({
  searchParams,
}: {
  searchParams?: { type?: string; status?: string; unitId?: string };
}) {
  const user = await requireAuth();

  const where: any = { isDeleted: false };
  if (searchParams?.type)   where.type   = searchParams.type;
  if (searchParams?.status) where.status = searchParams.status;
  if (searchParams?.unitId) where.unitId = searchParams.unitId;

  const [items, units, totals] = await Promise.all([
    prisma.governanceItem.findMany({
      where,
      include: {
        unit:     { select: { id: true, code: true, colorHex: true } },
        owner:    { select: { name: true } },
        govTasks: { where: { isDeleted: false, status: { notIn: ['DONE','CANCELLED'] } }, select: { id: true, status: true, isOverdue: true } },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      take: 200,
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    // Stats
    prisma.governanceItem.groupBy({
      by: ['status'],
      where: { isDeleted: false },
      _count: { id: true },
    }),
  ]);

  const now = new Date();
  const overdueReviews = items.filter(i =>
    i.nextReviewDate && new Date(i.nextReviewDate) < now &&
    i.status !== 'ARCHIVED' && i.status !== 'SUPERSEDED'
  ).length;

  const activeCount   = totals.find(t => t.status === 'ACTIVE')?._count.id ?? 0;
  const reviewCount   = totals.find(t => t.status === 'UNDER_REVIEW')?._count.id ?? 0;
  const draftCount    = totals.find(t => t.status === 'DRAFT')?._count.id ?? 0;
  const totalOpen = items.reduce((sum, i) => sum + i.govTasks.length, 0);

  const canCreate = can(user, 'governance:create');

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">🛡 Governance Registry</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{items.length} items shown</p>
        </div>
        <div className="flex gap-2">
          <Link href="/gov-tasks">
            <button className="pes-btn-ghost text-xs">📋 All Tasks</button>
          </Link>
          {canCreate && (
            <Link href="/governance/new">
              <button className="pes-btn-primary text-xs" style={{ background: '#7c3aed' }}>+ New Gov. Item</button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Active',        value: activeCount,   color: '#10b981' },
          { label: 'Under Review',  value: reviewCount,   color: '#f59e0b' },
          { label: 'Draft',         value: draftCount,    color: '#6b7280' },
          { label: 'Overdue Reviews', value: overdueReviews, color: overdueReviews > 0 ? '#ef4444' : '#10b981' },
        ].map(s => (
          <div key={s.label} className="pes-card p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-3)] mb-1">{s.label}</div>
            <div className="font-display font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 items-center bg-[var(--surface)] rounded-lg border border-[var(--border)] px-3 py-2">
        <select name="status" defaultValue={searchParams?.status ?? ''}
          className="pes-input py-1 text-[12px] w-[130px]">
          <option value="">All Statuses</option>
          {['DRAFT','ACTIVE','UNDER_REVIEW','SUPERSEDED','ARCHIVED'].map(s => (
            <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
          ))}
        </select>
        <select name="type" defaultValue={searchParams?.type ?? ''}
          className="pes-input py-1 text-[12px] w-[150px]">
          <option value="">All Types</option>
          {Object.entries(TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <select name="unitId" defaultValue={searchParams?.unitId ?? ''}
          className="pes-input py-1 text-[12px] w-[130px]">
          <option value="">All Units</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
        </select>
        <button type="submit" className="pes-btn-ghost text-[11.5px] py-1 px-3">Filter</button>
        {(searchParams?.status || searchParams?.type || searchParams?.unitId) && (
          <Link href="/governance" className="text-[11.5px] text-red-400 hover:text-red-300">✕ Clear</Link>
        )}
        {totalOpen > 0 && (
          <span className="ml-auto text-[11px] text-amber-400">{totalOpen} open tasks across all items</span>
        )}
      </form>

      {/* Table */}
      <div className="pes-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              {['Code','Title','Type','Unit','Status','Risk','Priority','Owner','Open Tasks','Next Review'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {items.map(item => {
              const unitColor = item.unit?.colorHex && item.unit.colorHex.length <= 9 ? item.unit.colorHex : '#8b5cf6';
              const sc  = STATUS_C[item.status] ?? '#6b7280';
              const rc  = RISK_C[item.riskLevel] ?? '#6b7280';
              const isOverdueReview = item.nextReviewDate && new Date(item.nextReviewDate) < now
                && item.status !== 'ARCHIVED' && item.status !== 'SUPERSEDED';
              const openTasks = item.govTasks.length;
              const overdueTask = item.govTasks.some(t => t.isOverdue);

              return (
                <tr key={item.id}
                  className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors ${isOverdueReview ? 'border-l-2 border-l-red-500' : ''}`}>

                  <td className="px-4 py-2.5">
                    <Link href={`/governance/${item.id}`}
                      className="font-mono text-[12px] text-purple-400 hover:text-purple-300 font-bold">
                      {item.govCode}
                    </Link>
                  </td>

                  <td className="px-4 py-2.5 max-w-[220px]">
                    <Link href={`/governance/${item.id}`} className="text-[var(--text)] hover:text-[var(--text)] truncate block text-[12.5px]">
                      {item.title}
                    </Link>
                    {isOverdueReview && (
                      <span className="text-[10px] text-red-400 font-semibold">⚠ Review overdue</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-[11.5px] text-[var(--text-2)] whitespace-nowrap">
                    {TYPE_LABELS[item.type] ?? item.type.replace(/_/g,' ')}
                  </td>

                  <td className="px-4 py-2.5">
                    {item.unit?.code ? (
                      <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                        style={{ borderLeft: `2px solid ${unitColor}`, background: `${unitColor}18`, color: unitColor }}>
                        {item.unit.code}
                      </span>
                    ) : <span className="text-[var(--text-3)] text-[11px]">—</span>}
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc }}>
                      {item.status.replace(/_/g,' ')}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-semibold" style={{ color: rc }}>
                      ● {item.riskLevel}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 text-[11.5px] text-[var(--text-2)]">{item.priority}</td>

                  <td className="px-4 py-2.5 text-[12px] text-[var(--text-2)] whitespace-nowrap">
                    {item.owner?.name ?? '—'}
                  </td>

                  <td className="px-4 py-2.5">
                    {openTasks > 0 ? (
                      <Link href={`/governance/${item.id}?tab=gov-tasks`}>
                        <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded cursor-pointer hover:opacity-80
                          ${overdueTask ? 'bg-red-500/15 text-red-400' : 'bg-amber-500/15 text-amber-400'}`}>
                          {openTasks} {overdueTask ? '⚠' : ''}
                        </span>
                      </Link>
                    ) : (
                      <span className="text-[var(--text-3)] text-[11px]">—</span>
                    )}
                  </td>

                  <td className="px-4 py-2.5 text-[11.5px] whitespace-nowrap"
                    style={{ color: isOverdueReview ? '#ef4444' : '#8b97b5' }}>
                    {item.nextReviewDate
                      ? new Date(item.nextReviewDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
                      : '—'}
                  </td>
                </tr>
              );
            })}

            {items.length === 0 && (
              <tr>
                <td colSpan={10} className="py-16 text-center">
                  <div className="text-4xl mb-3 opacity-20">🛡</div>
                  <div className="text-[14px] text-[var(--text-3)] mb-2">No governance items found</div>
                  {canCreate && (
                    <Link href="/governance/new">
                      <button className="pes-btn-primary text-xs mt-2" style={{ background: '#7c3aed' }}>
                        + Add First Governance Item
                      </button>
                    </Link>
                  )}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
