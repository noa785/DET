// src/app/(protected)/gov-tasks/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Governance Tasks — DGCC PES' };

const STATUS_C: Record<string, string> = {
  NOT_STARTED: '#6b7280', IN_PROGRESS: '#3b82f6', UNDER_REVIEW: '#f59e0b',
  DONE: '#10b981', CANCELLED: '#374151',
};
const PRIO_C: Record<string, string> = {
  LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
};
const TYPE_LABELS: Record<string, string> = {
  REVIEW: 'Review', APPROVAL: 'Approval',
  DOCUMENTATION_UPDATE: 'Doc Update', COMPLIANCE_CHECK: 'Compliance Check',
  POLICY_REVISION: 'Policy Revision', EVIDENCE_COLLECTION: 'Evidence',
  COMMUNICATION: 'Communication', TRAINING: 'Training',
  IMPLEMENTATION_CHECK: 'Implementation',
};

export default async function GovTasksPage({
  searchParams,
}: {
  searchParams?: { status?: string; priority?: string };
}) {
  const user = await requireAuth();

  const where: any = { isDeleted: false };
  if (searchParams?.status)   where.status   = searchParams.status;
  if (searchParams?.priority) where.priority = searchParams.priority;

  const tasks = await prisma.governanceTask.findMany({
    where,
    include: {
      govItem:  { select: { id: true, govCode: true, title: true } },
      assignee: { select: { name: true } },
      approver: { select: { name: true } },
    },
    orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
    take: 200,
  });

  const open       = tasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length;
  const overdue    = tasks.filter(t => t.isOverdue).length;
  const pendingApp = tasks.filter(t => t.approvalRequired && !t.approvedAt).length;
  const done       = tasks.filter(t => t.status === 'DONE').length;

  const canCreate = can(user, 'governance:edit');

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">📋 Governance Tasks</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{tasks.length} tasks shown</p>
        </div>
        <div className="flex gap-2">
          <Link href="/governance">
            <button className="pes-btn-ghost text-xs">🛡 Registry</button>
          </Link>
          {canCreate && (
            <Link href="/gov-tasks/new">
              <button className="pes-btn-primary text-xs" style={{ background: '#7c3aed' }}>+ New Task</button>
            </Link>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Open',              value: open,       color: '#3b82f6' },
          { label: 'Overdue',           value: overdue,    color: overdue > 0 ? '#ef4444' : '#10b981' },
          { label: 'Pending Approval',  value: pendingApp, color: pendingApp > 0 ? '#f59e0b' : '#10b981' },
          { label: 'Done',              value: done,       color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pes-card p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-3)] mb-1">{s.label}</div>
            <div className="font-display font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <form method="GET" className="flex flex-wrap gap-2 items-center bg-[var(--surface)] rounded-lg border border-[var(--border)] px-3 py-2">
        <select name="status" defaultValue={searchParams?.status ?? ''} className="pes-input py-1 text-[12px] w-[160px]">
          <option value="">All Statuses</option>
          {Object.entries(STATUS_C).map(([v]) => <option key={v} value={v}>{v.replace(/_/g,' ')}</option>)}
        </select>
        <select name="priority" defaultValue={searchParams?.priority ?? ''} className="pes-input py-1 text-[12px] w-[120px]">
          <option value="">All Priorities</option>
          {['LOW','MEDIUM','HIGH','CRITICAL'].map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button type="submit" className="pes-btn-ghost text-[11.5px] py-1 px-3">Filter</button>
        {(searchParams?.status || searchParams?.priority) && (
          <Link href="/gov-tasks" className="text-[11.5px] text-red-400 hover:text-red-300">✕ Clear</Link>
        )}
      </form>

      {/* Table */}
      <div className="pes-card overflow-hidden overflow-x-auto">
        <table className="w-full text-[13px] border-collapse min-w-[900px]">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              {['Code','Title','Type','Gov. Item','Status','Priority','Assignee','Due','Approval'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)] whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tasks.map(t => {
              const sc = STATUS_C[t.status] ?? '#6b7280';
              const pc = PRIO_C[t.priority] ?? '#6b7280';
              return (
                <tr key={t.id}
                  className={`border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors
                    ${t.isOverdue ? 'border-l-2 border-l-red-500' : ''}`}>

                  <td className="px-4 py-2.5">
                    <span className="font-mono text-[11.5px] text-purple-400 font-semibold">{t.taskCode}</span>
                  </td>

                  <td className="px-4 py-2.5 max-w-[200px]">
                    <div className="text-[var(--text)] truncate text-[12.5px]">{t.title}</div>
                    {t.isOverdue && <div className="text-[10px] text-red-400 font-semibold">⚠ Overdue</div>}
                  </td>

                  <td className="px-4 py-2.5 text-[11.5px] text-[var(--text-3)] whitespace-nowrap">
                    {TYPE_LABELS[t.type] ?? t.type.replace(/_/g,' ')}
                  </td>

                  <td className="px-4 py-2.5">
                    {t.govItem ? (
                      <Link href={`/governance/${t.govItem.id}?tab=gov-tasks`}
                        className="text-[11px] text-purple-400 hover:text-purple-300 font-mono">
                        {t.govItem.govCode}
                      </Link>
                    ) : <span className="text-[var(--text-3)]">—</span>}
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded whitespace-nowrap"
                      style={{ background: `${sc}18`, color: sc }}>
                      {t.status.replace(/_/g,' ')}
                    </span>
                  </td>

                  <td className="px-4 py-2.5">
                    <span className="text-[11.5px] font-semibold" style={{ color: pc }}>
                      ● {t.priority}
                    </span>
                  </td>

                  <td className="px-4 py-2.5 text-[12px] text-[var(--text-2)] whitespace-nowrap">
                    {t.assignee?.name ?? '—'}
                  </td>

                  <td className="px-4 py-2.5 text-[11.5px] whitespace-nowrap"
                    style={{ color: t.isOverdue ? '#ef4444' : '#8b97b5' }}>
                    {t.dueDate
                      ? new Date(t.dueDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' })
                      : '—'}
                  </td>

                  <td className="px-4 py-2.5">
                    {t.approvalRequired ? (
                      t.approvedAt ? (
                        <span className="text-[10.5px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-semibold">
                          ✅ Approved
                        </span>
                      ) : (
                        <span className="text-[10.5px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-semibold">
                          ⏳ Pending
                        </span>
                      )
                    ) : (
                      <span className="text-[var(--text-3)] text-[11px]">—</span>
                    )}
                  </td>
                </tr>
              );
            })}

            {tasks.length === 0 && (
              <tr>
                <td colSpan={9} className="py-16 text-center">
                  <div className="text-4xl mb-3 opacity-20">✅</div>
                  <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
                    No governance tasks yet
                  </div>
                  <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, maxWidth: 400, margin: '0 auto 16px' }}>
                    To get started, first add a <strong>Governance Item</strong> from the Gov. Review Dashboard,
                    then create tasks linked to it.
                  </div>
                  <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
                    <Link href="/governance/new">
                      <button className="pes-btn pes-btn-ghost" style={{ fontSize: 12, borderColor: '#8b5cf6', color: '#8b5cf6' }}>
                        ⬙ Add Governance Item
                      </button>
                    </Link>
                    {canCreate && (
                      <Link href="/gov-tasks/new">
                        <button className="pes-btn pes-btn-primary" style={{ fontSize: 12, background: '#7c3aed' }}>
                          + New Task
                        </button>
                      </Link>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
