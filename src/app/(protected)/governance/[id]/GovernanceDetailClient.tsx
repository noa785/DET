'use client';
// src/app/(protected)/governance/[id]/GovernanceDetailClient.tsx

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

// ── Types ──────────────────────────────────────────────────────
interface GovTask {
  id: string; taskCode: string; title: string; type: string; status: string;
  priority: string; assigneeName: string | null; dueDate: string | null;
  isOverdue: boolean; approvalRequired: boolean; approverName: string | null;
  approvedAt: string | null; description: string | null;
  requiredEvidence: string | null; completionEvidence: string | null;
}
interface UpdateLogEntry {
  id: string; logCode: string; updateType: string; title: string;
  description: string | null; fieldChanged: string | null; oldValue: string | null;
  newValue: string | null; changeReason: string | null;
  requiresGovReview: boolean; govReviewStatus: string | null;
  createdByName: string | null; createdByInitials: string | null; createdAt: string;
}
interface GovItem {
  id: string; govCode: string; title: string; type: string; status: string;
  priority: string; riskLevel: string; complianceImpact: string | null;
  version: string; source: string | null; notes: string | null; evidenceLinks: string | null;
  effectiveDate: string | null; nextReviewDate: string | null; reviewCycleDays: number | null;
  unitCode: string | null; unitName: string | null; unitColor: string | null;
  ownerName: string | null; reviewerName: string | null; createdByName: string | null;
  createdAt: string; updatedAt: string;
  govTasks: GovTask[];
  updateLogs: UpdateLogEntry[];
  auditLogs: { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; userName: string; createdAt: string }[];
  relatedOrders: { id: string; orderCode: string; name: string; status: string; percentComplete: number; priority: string; dueDate: string | null }[];
}

type Tab = 'overview' | 'gov-tasks' | 'update-log' | 'orders' | 'audit';

const TYPE_COLORS: Record<string, string> = {
  POLICY:'#ef4444', PROCEDURE:'#3b82f6', STANDARD:'#8b5cf6',
  GUIDELINE:'#06b6d4', COMMITTEE_DECISION:'#f59e0b',
  CONTROL:'#10b981', COMPLIANCE_REQUIREMENT:'#f97316', UPDATE_ITEM:'#6b7280',
};
const TYPE_LABELS: Record<string, string> = {
  POLICY:'Policy', PROCEDURE:'Procedure', STANDARD:'Standard',
  GUIDELINE:'Guideline', COMMITTEE_DECISION:'Committee Decision',
  CONTROL:'Control', COMPLIANCE_REQUIREMENT:'Compliance Req.', UPDATE_ITEM:'Update Item',
};
const STATUS_COLORS: Record<string, string> = {
  ACTIVE:'#10b981', DRAFT:'#6b7280', UNDER_REVIEW:'#f59e0b', SUPERSEDED:'#6b7280', ARCHIVED:'#374151',
};
const RISK_COLORS: Record<string, string> = { CRITICAL:'#ef4444', HIGH:'#f87171', MEDIUM:'#f59e0b', LOW:'#10b981' };
const TASK_STATUS_COLORS: Record<string, string> = {
  TODO:'#6b7280', IN_PROGRESS:'#3b82f6', AWAITING_APPROVAL:'#f59e0b', DONE:'#10b981', CANCELLED:'#374151',
};
const UPDATE_TYPE_STYLES: Record<string, { color: string; icon: string }> = {
  PROGRESS_UPDATE: { color:'#3b82f6', icon:'📊' }, SCOPE_CHANGE: { color:'#8b5cf6', icon:'🗺' },
  DATE_CHANGE:     { color:'#f59e0b', icon:'📅' }, OWNER_CHANGE: { color:'#06b6d4', icon:'👤' },
  GOVERNANCE_UPDATE:{ color:'#10b981', icon:'🛡' }, POLICY_CHANGE:{ color:'#a855f7', icon:'📄' },
  EVIDENCE_ADDED:  { color:'#10b981', icon:'📎' }, NOTE:         { color:'#6b7280', icon:'📝' },
  SYSTEM_CHANGE:   { color:'#f59e0b', icon:'⚙' },
};
const GOV_REVIEW_COLORS: Record<string, string> = { PENDING:'#f59e0b', APPROVED:'#10b981', REJECTED:'#ef4444', 'N/A':'#6b7280' };

// ── Main ───────────────────────────────────────────────────────
export default function GovernanceDetailClient({ item, canEdit, canApprove = false }: { item: GovItem; canEdit: boolean; canApprove?: boolean }) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [taskActionState, setTaskActionState] = useState<Record<string, 'loading' | 'done' | 'error'>>({});

  const handleTaskApprove = async (taskId: string, action: 'APPROVE' | 'REJECT') => {
    setTaskActionState(s => ({ ...s, [taskId]: 'loading' }));
    try {
      const r = await fetch(`/api/gov-tasks/${taskId}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!r.ok) throw new Error('Failed');
      setTaskActionState(s => ({ ...s, [taskId]: 'done' }));
      setTimeout(() => router.refresh(), 600);
    } catch {
      setTaskActionState(s => ({ ...s, [taskId]: 'error' }));
    }
  };
  const color = TYPE_COLORS[item.type] ?? '#6b7280';
  const unitColor = item.unitColor && item.unitColor.length <= 9 ? item.unitColor : '#3b82f6';
  const now = new Date();
  const isOverdueReview = item.nextReviewDate && new Date(item.nextReviewDate) < now;
  const pendingReviewCount = item.updateLogs.filter(u => u.requiresGovReview && u.govReviewStatus === 'PENDING').length;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'gov-tasks',   label: 'Gov. Tasks',   count: item.govTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length },
    { id: 'update-log',  label: 'Update Log',   count: pendingReviewCount > 0 ? pendingReviewCount : item.updateLogs.length },
    { id: 'orders',      label: 'Related Orders', count: item.relatedOrders.length },
    { id: 'audit',       label: 'Audit Trail',  count: item.auditLogs.length },
  ];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)]">
        <Link href="/governance" className="hover:text-[var(--text-2)]">Governance Registry</Link>
        <span>›</span>
        <span className="text-[var(--text)] font-medium">{item.govCode}</span>
      </div>

      {/* Header */}
      <div className="pes-card p-5" style={{ borderTop: `2px solid ${color}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className="font-display font-bold text-[12px] text-purple-400">{item.govCode}</span>
              <span className="text-[11px] text-[var(--text-3)]">·</span>
              <span className="text-[11px] font-semibold px-1.5 py-0.5 rounded"
                style={{ background: `${color}18`, color }}>
                {TYPE_LABELS[item.type] ?? item.type}
              </span>
              <span className="text-[11px] font-mono text-[var(--text-3)]">v{item.version}</span>
              {item.unitCode && (
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                  style={{ borderLeft: `2px solid ${unitColor}`, background: `${unitColor}18`, color: unitColor }}>
                  {item.unitCode}
                </span>
              )}
              {isOverdueReview && (
                <span className="text-[11px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-semibold">⚠ Review Overdue</span>
              )}
              {pendingReviewCount > 0 && (
                <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded font-semibold">⏳ {pendingReviewCount} Pending Review</span>
              )}
            </div>
            <h1 className="font-display font-bold text-xl text-[var(--text)] leading-tight">{item.title}</h1>
          </div>
          {canEdit && (
            <Link href={`/governance/${item.id}/edit`}>
              <button className="pes-btn-ghost text-xs flex-shrink-0">✏ Edit</button>
            </Link>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          <MetaCell label="Status">
            <span className="text-[11.5px] font-semibold" style={{ color: STATUS_COLORS[item.status] }}>● {item.status.replace(/_/g,' ')}</span>
          </MetaCell>
          <MetaCell label="Priority">
            <span className="text-[11.5px] font-semibold" style={{ color: RISK_COLORS[item.priority] }}>● {item.priority}</span>
          </MetaCell>
          <MetaCell label="Risk Level">
            <span className="text-[11.5px] font-semibold" style={{ color: RISK_COLORS[item.riskLevel] }}>● {item.riskLevel}</span>
          </MetaCell>
          <MetaCell label="Owner">
            <span className="text-[12.5px]">{item.ownerName ?? '—'}</span>
          </MetaCell>
          <MetaCell label="Effective Date">
            <span className="text-[12.5px]">
              {item.effectiveDate ? new Date(item.effectiveDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }) : '—'}
            </span>
          </MetaCell>
          <MetaCell label="Next Review">
            <span className={`text-[12.5px] ${isOverdueReview ? 'text-red-400 font-semibold' : ''}`}>
              {isOverdueReview && '⚠ '}
              {item.nextReviewDate ? new Date(item.nextReviewDate).toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'2-digit' }) : '—'}
            </span>
          </MetaCell>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`px-4 py-2 text-[13px] font-medium transition-all border-b-2 -mb-px ${tab === t.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t.label}
            {t.count !== undefined && t.count > 0 && (
              <span className="ml-1.5 text-[11px] bg-[var(--surface-3)] text-[var(--text-2)] px-1.5 py-0.5 rounded-full">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'overview'   && <OverviewTab item={item} />}
      {tab === 'gov-tasks'  && <GovTasksTab item={item} canEdit={canEdit} canApprove={canApprove} handleTaskApprove={handleTaskApprove} taskActionState={taskActionState} />}
      {tab === 'update-log' && <UpdateLogTab item={item} canEdit={canEdit} />}
      {tab === 'orders'     && <RelatedOrdersTab item={item} />}
      {tab === 'audit'      && <AuditTab item={item} />}
    </div>
  );
}

// ── Tabs ───────────────────────────────────────────────────────

function OverviewTab({ item }: { item: GovItem }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <div className="pes-card p-5 space-y-3.5">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Details</div>
        {[
          ['Gov Code',        item.govCode],
          ['Type',            TYPE_LABELS[item.type] ?? item.type],
          ['Version',         item.version],
          ['Unit',            item.unitName ?? '—'],
          ['Owner',           item.ownerName ?? '—'],
          ['Reviewer',        item.reviewerName ?? '—'],
          ['Source',          item.source ?? '—'],
          ['Review Cycle',    item.reviewCycleDays ? `Every ${item.reviewCycleDays} days` : '—'],
          ['Created By',      item.createdByName ?? '—'],
          ['Created',         new Date(item.createdAt).toLocaleDateString('en-GB')],
          ['Last Updated',    new Date(item.updatedAt).toLocaleDateString('en-GB')],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[13px] border-b border-[var(--border)]/30 pb-2">
            <span className="text-[var(--text-3)]">{k}</span>
            <span className="text-[var(--text)] text-right max-w-[200px] truncate">{v}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {item.notes && (
          <div className="pes-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">Notes</div>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{item.notes}</p>
          </div>
        )}
        {item.complianceImpact && (
          <div className="pes-card p-5 border-purple-500/20 bg-purple-500/3">
            <div className="text-[11px] font-bold uppercase tracking-wider text-purple-400 mb-3">🛡 Compliance Impact</div>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed">{item.complianceImpact}</p>
          </div>
        )}
        {item.evidenceLinks && (
          <div className="pes-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">📎 Evidence Links</div>
            {item.evidenceLinks.split(',').map((l, i) => (
              <a key={i} href={l.trim()} target="_blank" rel="noopener noreferrer"
                className="block text-[13px] text-blue-400 hover:text-blue-300 truncate mb-1">{l.trim()}</a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GovTasksTab({ item, canEdit, canApprove, handleTaskApprove, taskActionState }: { item: GovItem; canEdit: boolean; canApprove: boolean; handleTaskApprove: (id: string, action: 'APPROVE'|'REJECT') => void; taskActionState: Record<string, string> }) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const open   = item.govTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const closed = item.govTasks.filter(t => t.status === 'DONE' || t.status === 'CANCELLED');

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[12.5px] text-[var(--text-3)]">{open.length} open · {closed.length} completed</span>
        {canEdit && (
          <Link href={`/gov-tasks/new?govItemId=${item.id}`}>
            <button className="pes-btn-primary text-xs">+ New Task</button>
          </Link>
        )}
      </div>

      {item.govTasks.length === 0 ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">✅</div>
          <div className="text-[13.5px] text-[var(--text-3)]">No governance tasks yet</div>
        </div>
      ) : (
        <div className="space-y-2">
          {item.govTasks.map(t => {
            const tColor = TASK_STATUS_COLORS[t.status] ?? '#6b7280';
            const isExp  = expanded === t.id;
            return (
              <div key={t.id} className="pes-card overflow-hidden" style={{ borderLeft: `2px solid ${tColor}` }}>
                <div
                  className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[var(--surface-2)] transition-colors"
                  onClick={() => setExpanded(isExp ? null : t.id)}
                >
                  <span className="font-mono text-[11px] text-purple-400 flex-shrink-0">{t.taskCode}</span>
                  <span className="text-[13px] text-[var(--text)] flex-1">{t.title}</span>
                  <span className="text-[11px] font-semibold flex-shrink-0 hidden sm:block" style={{ color: tColor }}>● {t.status.replace(/_/g,' ')}</span>
                  {t.approvalRequired && !t.approvedAt && (
                    <span className="text-[10.5px] bg-amber-500/15 text-amber-400 px-1.5 py-0.5 rounded font-semibold">⏳ Needs Approval</span>
                  )}
                  {t.approvedAt && (
                    <span className="text-[10.5px] bg-green-500/15 text-green-400 px-1.5 py-0.5 rounded font-semibold">✅ Approved</span>
                  )}
                  {t.isOverdue && (
                    <span className="text-[10.5px] bg-red-500/15 text-red-400 px-1.5 py-0.5 rounded font-semibold">⚠ Overdue</span>
                  )}
                  <span className="text-[var(--text-3)] text-[12px] flex-shrink-0">{isExp ? '▲' : '▼'}</span>
                </div>

                {isExp && (
                  <div className="px-4 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[12.5px]">
                      <div><span className="text-[var(--text-3)] block text-[11px] uppercase tracking-wide mb-0.5">Type</span><span className="text-[var(--text-2)]">{t.type.replace(/_/g,' ')}</span></div>
                      <div><span className="text-[var(--text-3)] block text-[11px] uppercase tracking-wide mb-0.5">Priority</span><span className="text-[var(--text-2)]">{t.priority}</span></div>
                      <div><span className="text-[var(--text-3)] block text-[11px] uppercase tracking-wide mb-0.5">Assignee</span><span className="text-[var(--text-2)]">{t.assigneeName ?? '—'}</span></div>
                      <div><span className="text-[var(--text-3)] block text-[11px] uppercase tracking-wide mb-0.5">Due</span><span className={`${t.isOverdue ? 'text-red-400' : 'text-[var(--text-2)]'}`}>{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-GB',{day:'2-digit',month:'short'}) : '—'}</span></div>
                    </div>
                    {t.description && <p className="text-[12.5px] text-[var(--text-2)] leading-relaxed">{t.description}</p>}
                    {t.requiredEvidence && (
                      <div className="bg-[var(--surface-3)] rounded-lg px-3 py-2 text-[12.5px]">
                        <span className="text-[var(--text-3)] font-semibold block mb-0.5">Required Evidence:</span>
                        <span className="text-[var(--text-2)]">{t.requiredEvidence}</span>
                      </div>
                    )}
                    {t.completionEvidence && (
                      <div className="bg-green-500/8 rounded-lg px-3 py-2 text-[12.5px] border border-green-500/15">
                        <span className="text-green-400 font-semibold block mb-0.5">✅ Completion Evidence:</span>
                        <span className="text-[var(--text-2)]">{t.completionEvidence}</span>
                      </div>
                    )}
                    {/* Approve button — visible when awaiting approval */}
                    {t.approvalRequired && t.status === 'AWAITING_APPROVAL' && canApprove && (
                      <div className="flex gap-2 pt-1">
                        <button
                          onClick={() => handleTaskApprove(t.id, 'APPROVE')}
                          disabled={!!taskActionState[t.id]}
                          className="px-3 py-1.5 rounded bg-green-500/15 text-green-400 text-[12px] font-medium hover:bg-green-500/25 border border-green-500/20 transition-colors disabled:opacity-50"
                        >
                          {taskActionState[t.id] === 'loading' ? '…' : '✓ Approve'}
                        </button>
                        <button
                          onClick={() => handleTaskApprove(t.id, 'REJECT')}
                          disabled={!!taskActionState[t.id]}
                          className="px-3 py-1.5 rounded bg-red-500/10 text-red-400 text-[12px] font-medium hover:bg-red-500/20 border border-red-500/20 transition-colors disabled:opacity-50"
                        >
                          ✕ Reject
                        </button>
                        <a href="/governance/review" className="px-3 py-1.5 rounded border border-[var(--border)] text-[var(--text-3)] text-[12px] hover:text-blue-400 transition-colors">
                          Full Review →
                        </a>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpdateLogTab({ item, canEdit }: { item: GovItem; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const router = useRouter();
  const [form, setForm] = useState({ title: '', updateType: 'GOVERNANCE_UPDATE', description: '', changeReason: '', requiresGovReview: true, evidenceLinks: '' });
  const [saving, setSaving] = useState(false);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch(`/api/governance/${item.id}/update-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, requiresGovReview: form.requiresGovReview }),
    });
    setSaving(false);
    setShowForm(false);
    router.refresh();
  }

  const pending = item.updateLogs.filter(u => u.requiresGovReview && u.govReviewStatus === 'PENDING');
  const rest    = item.updateLogs.filter(u => !(u.requiresGovReview && u.govReviewStatus === 'PENDING'));

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[12.5px] text-[var(--text-3)]">
          {item.updateLogs.length} entries
          {pending.length > 0 && <span className="ml-2 text-amber-400 font-semibold">· {pending.length} pending review</span>}
        </span>
        {canEdit && !showForm && (
          <button onClick={() => setShowForm(true)} className="pes-btn-primary text-xs">+ Log Update</button>
        )}
      </div>

      {/* Add form */}
      {showForm && (
        <form onSubmit={handleAdd} className="pes-card p-4 space-y-3 border-purple-500/20 bg-purple-500/3">
          <div className="font-semibold text-[13px] text-[var(--text)]">+ New Governance Update Entry</div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="pes-label block mb-1">Type</label>
              <select value={form.updateType} onChange={e => setForm(f => ({...f, updateType: e.target.value}))} className="pes-input text-[12.5px] py-1.5">
                {Object.entries(UPDATE_TYPE_STYLES).map(([v, s]) => <option key={v} value={v}>{s.icon} {v.replace(/_/g,' ')}</option>)}
              </select>
            </div>
            <div>
              <label className="pes-label block mb-1">Title *</label>
              <input type="text" required value={form.title} onChange={e => setForm(f => ({...f, title: e.target.value}))} className="pes-input text-[12.5px] py-1.5" placeholder="What was updated?" />
            </div>
          </div>
          <div>
            <label className="pes-label block mb-1">Description</label>
            <textarea rows={2} value={form.description} onChange={e => setForm(f => ({...f, description: e.target.value}))} className="pes-input resize-none text-[12.5px]" />
          </div>
          <div>
            <label className="pes-label block mb-1">Reason for Change</label>
            <input type="text" value={form.changeReason} onChange={e => setForm(f => ({...f, changeReason: e.target.value}))} className="pes-input text-[12.5px] py-1.5" placeholder="Why was this changed?" />
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form.requiresGovReview} onChange={e => setForm(f => ({...f, requiresGovReview: e.target.checked}))} className="accent-purple-500" />
              <span className="text-[12.5px] text-[var(--text-2)]">Requires Governance Review</span>
            </label>
            <input type="text" value={form.evidenceLinks} onChange={e => setForm(f => ({...f, evidenceLinks: e.target.value}))} className="pes-input text-[12.5px] py-1.5 flex-1" placeholder="Evidence link (optional)" />
          </div>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="pes-btn-primary text-xs">{saving ? <Spinner size={13} /> : 'Log Update'}</button>
            <button type="button" onClick={() => setShowForm(false)} className="pes-btn-ghost text-xs">Cancel</button>
          </div>
        </form>
      )}

      {/* Pending reviews first */}
      {pending.length > 0 && (
        <div>
          <div className="text-[11px] font-bold uppercase tracking-wider text-amber-400 mb-2">⏳ Pending Governance Review</div>
          {pending.map(u => <UpdateLogCard key={u.id} log={u} govItemId={item.id} />)}
        </div>
      )}

      {rest.map(u => <UpdateLogCard key={u.id} log={u} govItemId={item.id} />)}

      {item.updateLogs.length === 0 && !showForm && (
        <div className="pes-card p-8 text-center text-[var(--text-3)] text-[13px]">No updates logged yet</div>
      )}
    </div>
  );
}

function UpdateLogCard({ log, govItemId }: { log: UpdateLogEntry; govItemId: string }) {
  const router = useRouter();
  const [approving, setApproving] = useState(false);
  const style = UPDATE_TYPE_STYLES[log.updateType] ?? { color:'#6b7280', icon:'📝' };

  async function approve(status: 'APPROVED' | 'REJECTED') {
    setApproving(true);
    await fetch(`/api/update-logs/${log.id}/review`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ govReviewStatus: status }),
    });
    setApproving(false);
    router.refresh();
  }

  return (
    <div className="pes-card p-4 mb-2" style={{ borderLeft: `2px solid ${style.color}` }}>
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span>{style.icon}</span>
          <span className="font-semibold text-[13.5px] text-[var(--text)]">{log.title}</span>
          <span className="font-mono text-[10.5px] text-[var(--text-3)]">{log.logCode}</span>
        </div>
        <span className="text-[11.5px] text-[var(--text-3)] flex-shrink-0">{new Date(log.createdAt).toLocaleDateString('en-GB', {day:'2-digit', month:'short'})}</span>
      </div>

      {log.fieldChanged && (
        <div className="flex items-center gap-1.5 mb-2 text-[11.5px]">
          <span className="font-mono bg-[var(--surface-3)] text-[var(--text-3)] px-1.5 py-0.5 rounded">{log.fieldChanged}</span>
          <span className="text-red-400 line-through px-1.5 py-0.5 bg-red-500/10 rounded">{log.oldValue ?? '—'}</span>
          <span className="text-[var(--text-3)]">→</span>
          <span className="text-green-400 px-1.5 py-0.5 bg-green-500/10 rounded">{log.newValue ?? '—'}</span>
        </div>
      )}

      {log.description && <p className="text-[12.5px] text-[var(--text-2)] mb-2">{log.description}</p>}
      {log.changeReason && <div className="text-[12px] text-[var(--text-3)] bg-[var(--surface-3)] px-3 py-1.5 rounded">Reason: {log.changeReason}</div>}

      {/* Gov review section */}
      {log.requiresGovReview && (
        <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[var(--border)]">
          <span className="text-[11px] text-[var(--text-3)]">Gov. Review:</span>
          <span className="text-[11px] font-semibold" style={{ color: GOV_REVIEW_COLORS[log.govReviewStatus ?? 'PENDING'] }}>
            ● {log.govReviewStatus ?? 'PENDING'}
          </span>
          {log.govReviewStatus === 'PENDING' && (
            <div className="ml-auto flex gap-1.5">
              <button onClick={() => approve('APPROVED')} disabled={approving}
                className="text-[11.5px] px-2.5 py-1 rounded bg-green-500/15 text-green-400 hover:bg-green-500/25 transition-colors font-medium">
                ✅ Approve
              </button>
              <button onClick={() => approve('REJECTED')} disabled={approving}
                className="text-[11.5px] px-2.5 py-1 rounded bg-red-500/15 text-red-400 hover:bg-red-500/25 transition-colors font-medium">
                ❌ Reject
              </button>
            </div>
          )}
        </div>
      )}

      <div className="text-[11px] text-[var(--text-3)] mt-1.5">{log.createdByName ?? 'System'}</div>
    </div>
  );
}

function RelatedOrdersTab({ item }: { item: GovItem }) {
  const STATUS_COLORS: Record<string, string> = {
    NOT_STARTED:'#6b7280', IN_PROGRESS:'#3b82f6', UNDER_REVIEW:'#f59e0b',
    BLOCKED:'#ef4444', ON_HOLD:'#9ca3af', DONE:'#10b981', CANCELLED:'#374151',
  };
  const STATUS_LABELS: Record<string, string> = {
    NOT_STARTED:'Not Started', IN_PROGRESS:'In Progress', UNDER_REVIEW:'Under Review',
    BLOCKED:'Blocked', ON_HOLD:'On Hold', DONE:'Done', CANCELLED:'Cancelled',
  };

  return (
    <div className="space-y-3">
      <div className="text-[12.5px] text-[var(--text-3)]">
        Orders from unit <strong className="text-[var(--text-2)]">{item.unitCode ?? '—'}</strong> — {item.relatedOrders.length} items
      </div>
      {item.relatedOrders.length === 0 ? (
        <div className="pes-card p-8 text-center text-[var(--text-3)] text-[13px]">No related orders</div>
      ) : item.relatedOrders.map(o => (
        <Link key={o.id} href={`/orders/${o.id}`}>
          <div className="pes-card p-3.5 flex items-center gap-3 hover:border-[var(--border-2)] transition-colors">
            <span className="font-display text-[11.5px] text-blue-400 font-bold flex-shrink-0">{o.orderCode}</span>
            <span className="text-[13px] text-[var(--text)] flex-1 truncate">{o.name}</span>
            <span className="text-[11px] font-semibold" style={{ color: STATUS_COLORS[o.status] }}>● {STATUS_LABELS[o.status]}</span>
            <div className="w-[60px] flex-shrink-0">
              <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${o.percentComplete}%`, background: o.percentComplete === 100 ? '#10b981' : '#3b82f6' }} />
              </div>
              <span className="text-[10px] text-[var(--text-3)] text-right block">{o.percentComplete}%</span>
            </div>
            <span className="text-[var(--text-3)] text-[13px]">→</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

function AuditTab({ item }: { item: GovItem }) {
  return (
    <div className="space-y-2">
      {item.auditLogs.map(a => (
        <div key={a.id} className="pes-card px-4 py-3 flex items-center gap-3">
          <span className="text-[13px] flex-shrink-0">{a.action === 'CREATE' ? '➕' : a.action === 'DELETE' ? '🗑️' : '✏️'}</span>
          <div className="flex-1">
            <span className="font-semibold text-[var(--text)] text-[13px]">{a.userName}</span>
            <span className="text-[var(--text-2)] text-[13px]"> · {a.action.replace(/_/g,' ')}</span>
            {a.field && <span className="text-[var(--text-3)] text-[12px]"> — {a.field}</span>}
            {a.field && (
              <div className="text-[11.5px] mt-0.5">
                <span className="text-red-400 line-through">{a.oldValue ?? '—'}</span>
                <span className="text-[var(--text-3)] mx-1">→</span>
                <span className="text-green-400">{a.newValue ?? '—'}</span>
              </div>
            )}
          </div>
          <span className="text-[11px] text-[var(--text-3)]">{new Date(a.createdAt).toLocaleDateString('en-GB', {day:'2-digit',month:'short'})}</span>
        </div>
      ))}
    </div>
  );
}

// ── Helper ─────────────────────────────────────────────────────
function MetaCell({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[10px] uppercase tracking-wider font-semibold text-[var(--text-3)]">{label}</div>
      <div>{children}</div>
    </div>
  );
}
