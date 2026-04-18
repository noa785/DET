'use client';
// src/app/(protected)/governance/review/GovernanceReviewClient.tsx

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

// ── Types ──────────────────────────────────────────────────────
interface Stats {
  totalItems: number; activeItems: number; underReview: number;
  openTasks: number; overdueCt: number; awaitingCt: number; pendingLogsCt: number;
}

interface TaskItem {
  id: string; taskCode: string; title: string; type: string;
  status: string; priority: string;
  govCode: string | null; govTitle: string | null; govItemDbId: string | null;
  assigneeName: string | null; approverName: string | null;
  dueDate: string | null; approvalRequired: boolean; isOverdue: boolean;
}

interface LogItem {
  id: string; logCode: string; updateType: string; title: string;
  description: string | null;
  orderId: string | null; orderCode: string | null; orderName: string | null;
  govItemId: string | null; govCode: string | null;
  createdByName: string | null; createdAt: string;
  requiresGovReview: boolean; govReviewStatus: string;
}

interface GovItem {
  id: string; govCode: string; title: string; type: string;
  status: string; riskLevel: string;
  unitCode: string | null; unitColor: string | null;
  ownerName: string | null; updatedByName: string | null;
  nextReviewDate: string | null; updatedAt: string;
}

interface Props {
  stats: Stats;
  awaitingApproval: TaskItem[];
  overdueTasks: TaskItem[];
  pendingUpdateLogs: LogItem[];
  govItemsNeedingReview: GovItem[];
  recentlyUpdatedItems: GovItem[];
  canApprove: boolean;
  currentUserName: string;
}

// ── Constants ──────────────────────────────────────────────────
const PRIO_COLOR: Record<string, string> = {
  LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
};
const STATUS_C: Record<string, string> = {
  TODO: '#6b7280', IN_PROGRESS: '#3b82f6', AWAITING_APPROVAL: '#f59e0b',
  DONE: '#10b981', CANCELLED: '#4b5563',
};
const RISK_C: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
};
const LOG_TYPE_ICON: Record<string, string> = {
  PROGRESS_UPDATE: '📊', SCOPE_CHANGE: '🔄', DATE_CHANGE: '📅',
  OWNER_CHANGE: '👤', GOVERNANCE_UPDATE: '🛡', POLICY_CHANGE: '📄',
  EVIDENCE_ADDED: '📎', NOTE: '💬', SYSTEM_CHANGE: '⚙',
};

// ── Main Component ─────────────────────────────────────────────
export default function GovernanceReviewClient({
  stats, awaitingApproval, overdueTasks, pendingUpdateLogs,
  govItemsNeedingReview, recentlyUpdatedItems, canApprove, currentUserName,
}: Props) {
  type Tab = 'overview' | 'approvals' | 'overdue' | 'logs' | 'review_cycle';
  const [tab, setTab] = useState<Tab>('overview');
  const router = useRouter();

  // ── Approve / Reject task ────────────────────────────────────
  const [actionState, setActionState] = useState<Record<string, 'approving' | 'rejecting' | 'done' | 'error'>>({});
  const [notesModal, setNotesModal] = useState<{ id: string; action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES'; taskCode: string } | null>(null);
  const [notesValue, setNotesValue] = useState('');

  const handleTaskAction = useCallback(async (taskId: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES', notes?: string) => {
    setActionState(s => ({ ...s, [taskId]: action === 'APPROVE' ? 'approving' : 'rejecting' }));
    try {
      const r = await fetch(`/api/gov-tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes: notes || null }),
      });
      if (!r.ok) throw new Error('Failed');
      setActionState(s => ({ ...s, [taskId]: 'done' }));
      setTimeout(() => router.refresh(), 800);
    } catch {
      setActionState(s => ({ ...s, [taskId]: 'error' }));
    }
  }, [router]);

  // ── Approve / Reject update log ──────────────────────────────
  const [logActionState, setLogActionState] = useState<Record<string, 'approving' | 'rejecting' | 'done' | 'error'>>({});
  const [logNotesModal, setLogNotesModal] = useState<{ id: string; action: 'APPROVED' | 'REJECTED'; logCode: string } | null>(null);
  const [logNotesValue, setLogNotesValue] = useState('');

  const handleLogReview = useCallback(async (logId: string, govReviewStatus: 'APPROVED' | 'REJECTED', notes?: string) => {
    setLogActionState(s => ({ ...s, [logId]: govReviewStatus === 'APPROVED' ? 'approving' : 'rejecting' }));
    try {
      const r = await fetch(`/api/update-logs/${logId}/review`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ govReviewStatus, govReviewNotes: notes || null }),
      });
      if (!r.ok) throw new Error('Failed');
      setLogActionState(s => ({ ...s, [logId]: 'done' }));
      setTimeout(() => router.refresh(), 800);
    } catch {
      setLogActionState(s => ({ ...s, [logId]: 'error' }));
    }
  }, [router]);

  const urgentCount = stats.awaitingCt + stats.overdueCt + stats.pendingLogsCt;

  const TABS: { id: Tab; label: string; icon: string; badge?: number }[] = [
    { id: 'overview',      label: 'Overview',       icon: '🏛',  badge: urgentCount > 0 ? urgentCount : undefined },
    { id: 'approvals',     label: 'Awaiting Approval', icon: '✅', badge: stats.awaitingCt },
    { id: 'overdue',       label: 'Overdue Tasks',  icon: '⚠',   badge: stats.overdueCt },
    { id: 'logs',          label: 'Pending Reviews', icon: '🛡',  badge: stats.pendingLogsCt },
    { id: 'review_cycle',  label: 'Review Cycle',   icon: '🔄' },
  ];

  return (
    <div className="space-y-5">

      {/* Page header */}
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] mb-1">
            <Link href="/governance" className="hover:text-[var(--text-2)]">Governance</Link>
            <span>›</span>
            <span className="text-[var(--text)]">Review Dashboard</span>
          </div>
          <h1 className="font-display font-bold text-[22px] text-[var(--text)] flex items-center gap-2">
            🏛 Governance Review
            {urgentCount > 0 && (
              <span className="text-[13px] font-semibold px-2 py-0.5 rounded-full bg-red-500/15 text-red-400 border border-red-500/20">
                {urgentCount} urgent
              </span>
            )}
          </h1>
          <p className="text-[var(--text-3)] text-[13px] mt-0.5">
            Oversight dashboard for governance items, tasks, and change approvals
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/governance/new">
            <button className="pes-btn-ghost text-xs">+ New Item</button>
          </Link>
          <Link href="/gov-tasks/new">
            <button className="pes-btn-primary text-xs">+ New Task</button>
          </Link>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Total Items',        value: stats.totalItems,   color: '#3b82f6',  icon: '📋' },
          { label: 'Active',             value: stats.activeItems,  color: '#10b981',  icon: '✅' },
          { label: 'Under Review',       value: stats.underReview,  color: '#f59e0b',  icon: '🔍' },
          { label: 'Open Tasks',         value: stats.openTasks,    color: '#6366f1',  icon: '📌' },
          { label: 'Overdue',            value: stats.overdueCt,    color: stats.overdueCt > 0 ? '#ef4444' : '#6b7280', icon: '⚠' },
          { label: 'Awaiting Approval',  value: stats.awaitingCt,   color: stats.awaitingCt > 0 ? '#f59e0b' : '#6b7280', icon: '⏳' },
          { label: 'Pending Log Review', value: stats.pendingLogsCt,color: stats.pendingLogsCt > 0 ? '#8b5cf6' : '#6b7280', icon: '🛡' },
        ].map(s => (
          <div key={s.label} className="pes-card p-3">
            <div className="text-[11px] text-[var(--text-3)] mb-1">{s.icon} {s.label}</div>
            <div className="text-[22px] font-display font-bold" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium
              border-b-2 -mb-px transition-all whitespace-nowrap
              ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}
            `}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.badge !== undefined && t.badge > 0 && (
              <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center ${t.id === 'overdue' ? 'bg-red-500/15 text-red-400' : t.id === 'approvals' ? 'bg-amber-500/15 text-amber-400' : 'bg-purple-500/15 text-purple-400'}`}>
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Overview ─────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-5">

          {/* Quick links */}
          {urgentCount === 0 ? (
            <div className="pes-card p-6 text-center border-green-500/20">
              <div className="text-3xl mb-2">✅</div>
              <div className="text-[var(--text)] font-semibold">All Clear</div>
              <div className="text-[var(--text-3)] text-[13px] mt-1">No pending approvals, overdue tasks, or pending reviews</div>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.awaitingCt > 0 && (
                <button onClick={() => setTab('approvals')} className="pes-card p-4 text-left hover:border-amber-500/30 transition-colors">
                  <div className="text-amber-400 text-[22px] font-display font-bold">{stats.awaitingCt}</div>
                  <div className="text-[13px] text-[var(--text)] font-medium mt-1">Tasks Awaiting Approval</div>
                  <div className="text-[11.5px] text-amber-400 mt-1">→ Review now</div>
                </button>
              )}
              {stats.overdueCt > 0 && (
                <button onClick={() => setTab('overdue')} className="pes-card p-4 text-left hover:border-red-500/30 transition-colors">
                  <div className="text-red-400 text-[22px] font-display font-bold">{stats.overdueCt}</div>
                  <div className="text-[13px] text-[var(--text)] font-medium mt-1">Overdue Tasks</div>
                  <div className="text-[11.5px] text-red-400 mt-1">→ Escalate</div>
                </button>
              )}
              {stats.pendingLogsCt > 0 && (
                <button onClick={() => setTab('logs')} className="pes-card p-4 text-left hover:border-purple-500/30 transition-colors">
                  <div className="text-purple-400 text-[22px] font-display font-bold">{stats.pendingLogsCt}</div>
                  <div className="text-[13px] text-[var(--text)] font-medium mt-1">Update Logs Pending Review</div>
                  <div className="text-[11.5px] text-purple-400 mt-1">→ Review</div>
                </button>
              )}
            </div>
          )}

          {/* Recently updated */}
          <div>
            <div className="text-[11px] uppercase tracking-wider text-[var(--text-3)] font-semibold mb-3">Recent Governance Activity (Last 7 Days)</div>
            {recentlyUpdatedItems.length === 0 ? (
              <div className="text-[var(--text-3)] text-[13px] italic">No recent updates</div>
            ) : (
              <div className="space-y-1">
                {recentlyUpdatedItems.map(item => (
                  <Link key={item.id} href={`/governance/${item.id}`}>
                    <div className="pes-card px-4 py-2.5 hover:border-[var(--border-2)] transition-colors flex items-center gap-3">
                      <GovCode code={item.govCode} color={item.unitColor} />
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] text-[var(--text)] truncate">{item.title}</div>
                        <div className="text-[11px] text-[var(--text-3)]">
                          Updated by {item.updatedByName ?? '—'} · {new Date(item.updatedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                        </div>
                      </div>
                      <StatusPill status={item.status} />
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Tab: Awaiting Approval ────────────────────────────── */}
      {tab === 'approvals' && (
        <div className="space-y-3">
          {awaitingApproval.length === 0 ? (
            <EmptyState icon="✅" title="No pending approvals" sub="All governance tasks are up to date" />
          ) : awaitingApproval.map(task => {
            const state = actionState[task.id];
            return (
              <div key={task.id} className={`pes-card p-4 border-amber-500/20 ${state === 'done' ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-amber-400">{task.taskCode}</span>
                      {task.govCode && (
                        <Link href={task.govItemDbId ? `/governance/${task.govItemDbId}` : '#'}>
                          <span className="text-[11px] text-blue-400 hover:underline">{task.govCode}</span>
                        </Link>
                      )}
                      <span className="text-[11px] px-1.5 py-0.5 rounded text-[var(--text-2)] bg-[var(--surface-3)]">{task.type.replace(/_/g,' ')}</span>
                      <PriorityPill priority={task.priority} />
                    </div>
                    <div className="text-[13.5px] text-[var(--text)] font-medium">{task.title}</div>
                    {task.govTitle && (
                      <div className="text-[12px] text-[var(--text-3)] mt-0.5">📋 {task.govTitle}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11.5px] text-[var(--text-3)]">
                      {task.assigneeName && <span>👤 {task.assigneeName}</span>}
                      {task.approverName && <span>✍ Approver: {task.approverName}</span>}
                      {task.dueDate && (
                        <span className={task.isOverdue ? 'text-red-400 font-semibold' : ''}>
                          📅 {task.dueDate}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action buttons */}
                  {canApprove && state !== 'done' && (
                    <div className="flex gap-2 flex-shrink-0">
                      {state === 'approving' || state === 'rejecting' ? (
                        <Spinner size={16} />
                      ) : state === 'error' ? (
                        <span className="text-red-400 text-[12px]">Failed — retry</span>
                      ) : (
                        <>
                          <button
                            onClick={() => setNotesModal({ id: task.id, action: 'APPROVE', taskCode: task.taskCode })}
                            className="px-3 py-1.5 rounded bg-green-500/15 text-green-400 text-[12px] font-medium hover:bg-green-500/25 border border-green-500/20 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => setNotesModal({ id: task.id, action: 'REQUEST_CHANGES', taskCode: task.taskCode })}
                            className="px-3 py-1.5 rounded bg-amber-500/10 text-amber-400 text-[12px] font-medium hover:bg-amber-500/20 border border-amber-500/20 transition-colors"
                          >
                            ↩ Changes
                          </button>
                          <button
                            onClick={() => setNotesModal({ id: task.id, action: 'REJECT', taskCode: task.taskCode })}
                            className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 text-[12px] font-medium hover:bg-red-500/20 border border-red-500/20 transition-colors"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {state === 'done' && (
                    <span className="text-green-400 text-[12px] font-medium flex-shrink-0">✓ Done</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Overdue ──────────────────────────────────────── */}
      {tab === 'overdue' && (
        <div className="space-y-3">
          {overdueTasks.length === 0 ? (
            <EmptyState icon="🎉" title="No overdue tasks" sub="All governance tasks are within deadline" />
          ) : overdueTasks.map(task => (
            <div key={task.id} className="pes-card p-4 border-red-500/15">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[11px] font-mono text-red-400">{task.taskCode}</span>
                    {task.govCode && task.govItemDbId && (
                      <Link href={`/governance/${task.govItemDbId}`}>
                        <span className="text-[11px] text-blue-400 hover:underline">{task.govCode}</span>
                      </Link>
                    )}
                    <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-red-500/10 text-red-400 border border-red-500/20">OVERDUE</span>
                    <PriorityPill priority={task.priority} />
                  </div>
                  <div className="text-[13.5px] text-[var(--text)] font-medium">{task.title}</div>
                  <div className="flex items-center gap-3 mt-1 text-[11.5px] text-[var(--text-3)]">
                    {task.assigneeName && <span>👤 {task.assigneeName}</span>}
                    {task.dueDate && <span className="text-red-400 font-semibold">Due: {task.dueDate}</span>}
                    <span className="text-[11px] px-1.5 py-0.5 rounded bg-[var(--surface-3)]" style={{ color: STATUS_C[task.status] ?? '#6b7280' }}>
                      {task.status.replace(/_/g, ' ')}
                    </span>
                  </div>
                </div>
                {task.govItemDbId && (
                  <Link href={`/governance/${task.govItemDbId}`}>
                    <button className="pes-btn-ghost text-xs flex-shrink-0">→ Item</button>
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Pending Log Reviews ──────────────────────────── */}
      {tab === 'logs' && (
        <div className="space-y-3">
          {pendingUpdateLogs.length === 0 ? (
            <EmptyState icon="🛡" title="No pending log reviews" sub="All update logs have been reviewed" />
          ) : pendingUpdateLogs.map(log => {
            const state = logActionState[log.id];
            return (
              <div key={log.id} className={`pes-card p-4 border-purple-500/15 ${state === 'done' ? 'opacity-50' : ''}`}>
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[11px] font-mono text-purple-400">{log.logCode}</span>
                      <span className="text-[11px] px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-400">
                        {LOG_TYPE_ICON[log.updateType] ?? '📝'} {log.updateType.replace(/_/g,' ')}
                      </span>
                      <span className="text-[10.5px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-400">PENDING REVIEW</span>
                    </div>
                    <div className="text-[13.5px] text-[var(--text)] font-medium">{log.title}</div>
                    {log.description && (
                      <div className="text-[12px] text-[var(--text-3)] mt-0.5 line-clamp-2">{log.description}</div>
                    )}
                    <div className="flex items-center gap-3 mt-1 text-[11.5px] text-[var(--text-3)]">
                      {log.orderCode && (
                        <Link href={`/orders/${log.orderId}`}>
                          <span className="text-blue-400 hover:underline">{log.orderCode} — {log.orderName}</span>
                        </Link>
                      )}
                      {log.govCode && log.govItemId && (
                        <Link href={`/governance/${log.govItemId}`}>
                          <span className="text-blue-400 hover:underline">{log.govCode}</span>
                        </Link>
                      )}
                      {log.createdByName && <span>By: {log.createdByName}</span>}
                      <span>{new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                    </div>
                  </div>

                  {canApprove && state !== 'done' && (
                    <div className="flex gap-2 flex-shrink-0">
                      {state === 'approving' || state === 'rejecting' ? (
                        <Spinner size={16} />
                      ) : state === 'error' ? (
                        <span className="text-red-400 text-[12px]">Failed</span>
                      ) : (
                        <>
                          <button
                            onClick={() => setLogNotesModal({ id: log.id, action: 'APPROVED', logCode: log.logCode })}
                            className="px-3 py-1.5 rounded bg-green-500/15 text-green-400 text-[12px] font-medium hover:bg-green-500/25 border border-green-500/20 transition-colors"
                          >
                            ✓ Approve
                          </button>
                          <button
                            onClick={() => setLogNotesModal({ id: log.id, action: 'REJECTED', logCode: log.logCode })}
                            className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 text-[12px] font-medium hover:bg-red-500/20 border border-red-500/20 transition-colors"
                          >
                            ✕ Reject
                          </button>
                        </>
                      )}
                    </div>
                  )}
                  {state === 'done' && <span className="text-green-400 text-[12px] flex-shrink-0">✓ Reviewed</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Tab: Review Cycle ────────────────────────────────── */}
      {tab === 'review_cycle' && (
        <div className="space-y-3">
          <div className="text-[12.5px] text-[var(--text-3)] mb-2">
            Governance items that are overdue for their periodic review cycle
          </div>
          {govItemsNeedingReview.length === 0 ? (
            <EmptyState icon="🔄" title="All review cycles up to date" sub="No governance items are overdue for review" />
          ) : govItemsNeedingReview.map(item => (
            <Link key={item.id} href={`/governance/${item.id}`}>
              <div className="pes-card p-4 hover:border-[var(--border-2)] transition-colors flex items-start gap-3">
                <GovCode code={item.govCode} color={item.unitColor} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] text-[var(--text)] font-medium truncate">{item.title}</span>
                    <StatusPill status={item.status} />
                  </div>
                  <div className="flex items-center gap-3 text-[11.5px] text-[var(--text-3)]">
                    <span className="text-[11px] bg-[var(--surface-3)] px-1.5 py-0.5 rounded">{item.type.replace(/_/g,' ')}</span>
                    {item.ownerName && <span>👤 {item.ownerName}</span>}
                    {item.nextReviewDate ? (
                      <span className="text-red-400 font-semibold">Review due: {item.nextReviewDate}</span>
                    ) : (
                      <span className="text-amber-400">No review date set</span>
                    )}
                    <span style={{ color: RISK_C[item.riskLevel] }}>
                      Risk: {item.riskLevel}
                    </span>
                  </div>
                </div>
                <span className="text-[11px] text-blue-400 flex-shrink-0">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {/* ── Task Action Modal ─────────────────────────────────── */}
      {notesModal && (
        <Modal
          title={
            notesModal.action === 'APPROVE'
              ? `✓ Approve ${notesModal.taskCode}`
              : notesModal.action === 'REJECT'
              ? `✕ Reject ${notesModal.taskCode}`
              : `↩ Request Changes — ${notesModal.taskCode}`
          }
          onClose={() => setNotesModal(null)}
          onConfirm={async () => {
            const { id, action } = notesModal;
            setNotesModal(null);
            await handleTaskAction(id, action, notesValue);
            setNotesValue('');
          }}
          confirmLabel={notesModal.action === 'APPROVE' ? 'Approve' : notesModal.action === 'REJECT' ? 'Reject' : 'Send Back'}
          confirmDanger={notesModal.action === 'REJECT'}
        >
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--text-2)]">
              {notesModal.action === 'APPROVE'
                ? 'Approving will mark this task as Done.'
                : notesModal.action === 'REJECT'
                ? 'Rejecting will cancel this task.'
                : 'This will return the task to In Progress for revision.'}
            </p>
            <div>
              <label className="pes-label">Notes (optional)</label>
              <textarea
                value={notesValue}
                onChange={e => setNotesValue(e.target.value)}
                rows={3}
                placeholder="Add review notes or reason…"
                className="pes-input w-full mt-1 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}

      {/* ── Log Review Modal ──────────────────────────────────── */}
      {logNotesModal && (
        <Modal
          title={
            logNotesModal.action === 'APPROVED'
              ? `✓ Approve Update Log ${logNotesModal.logCode}`
              : `✕ Reject Update Log ${logNotesModal.logCode}`
          }
          onClose={() => setLogNotesModal(null)}
          onConfirm={async () => {
            const { id, action } = logNotesModal;
            setLogNotesModal(null);
            await handleLogReview(id, action, logNotesValue);
            setLogNotesValue('');
          }}
          confirmLabel={logNotesModal.action === 'APPROVED' ? 'Approve' : 'Reject'}
          confirmDanger={logNotesModal.action === 'REJECTED'}
        >
          <div className="space-y-3">
            <p className="text-[13px] text-[var(--text-2)]">
              {logNotesModal.action === 'APPROVED'
                ? 'Approve this change log entry. This confirms the change has been reviewed.'
                : 'Reject this entry. It will be marked as rejected with your notes.'}
            </p>
            <div>
              <label className="pes-label">Review Notes</label>
              <textarea
                value={logNotesValue}
                onChange={e => setLogNotesValue(e.target.value)}
                rows={3}
                placeholder="Add review notes…"
                className="pes-input w-full mt-1 resize-none"
              />
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-components ─────────────────────────────────────────────
function GovCode({ code, color }: { code: string; color: string | null }) {
  const c = color && color.length <= 9 ? color : '#3b82f6';
  return (
    <span
      className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap flex-shrink-0"
      style={{ borderLeft: `2px solid ${c}`, background: `${c}15`, color: c }}
    >
      {code}
    </span>
  );
}

function StatusPill({ status }: { status: string }) {
  const STATUS_C: Record<string, string> = {
    DRAFT: '#6b7280', ACTIVE: '#10b981', UNDER_REVIEW: '#f59e0b',
    SUPERSEDED: '#4b5563', ARCHIVED: '#374151',
  };
  const c = STATUS_C[status] ?? '#6b7280';
  return (
    <span
      className="text-[10.5px] font-semibold px-1.5 py-0.5 rounded flex-shrink-0"
      style={{ background: `${c}18`, color: c }}
    >
      {status.replace(/_/g, ' ')}
    </span>
  );
}

function PriorityPill({ priority }: { priority: string }) {
  const PRIO_COLOR: Record<string, string> = {
    LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
  };
  const c = PRIO_COLOR[priority] ?? '#6b7280';
  return (
    <span className="inline-flex items-center gap-1 text-[11px] font-semibold" style={{ color: c }}>
      <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
      {priority}
    </span>
  );
}

function EmptyState({ icon, title, sub }: { icon: string; title: string; sub: string }) {
  return (
    <div className="pes-card p-10 text-center">
      <div className="text-4xl mb-3">{icon}</div>
      <div className="text-[var(--text)] font-semibold text-[15px]">{title}</div>
      <div className="text-[var(--text-3)] text-[13px] mt-1">{sub}</div>
    </div>
  );
}

interface ModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
  onConfirm: () => void;
  confirmLabel: string;
  confirmDanger?: boolean;
}

function Modal({ title, children, onClose, onConfirm, confirmLabel, confirmDanger }: ModalProps) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="pes-card w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-display font-bold text-[16px] text-[var(--text)]">{title}</h2>
          <button onClick={onClose} className="text-[var(--text-3)] hover:text-[var(--text-2)] text-[20px]">✕</button>
        </div>
        {children}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onConfirm}
            className={confirmDanger ? 'pes-btn-danger flex-1' : 'pes-btn-primary flex-1'}
          >
            {confirmLabel}
          </button>
          <button onClick={onClose} className="pes-btn-ghost flex-1">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
