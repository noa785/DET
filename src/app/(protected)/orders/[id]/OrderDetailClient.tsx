'use client';
import AddUpdateLogForm from './AddUpdateLogForm';
import AttachmentsTab from './_components/AttachmentsTab';
// src/app/(protected)/orders/[id]/OrderDetailClient.tsx

import { useState } from 'react';
import Link from 'next/link';
import { StatusBadge, PriorityBadge, RAGDot, ProgressBar } from '@/components/ui/badges';
import type { RAGStatus } from '@/types';

// ── Types (simplified from server) ────────────────────────────
interface DescriptionData {
  id: string;
  objective: string | null; scope: string | null; rationale: string | null;
  governanceImpact: string | null; affectedUnit: string | null;
  relatedPolicies: string | null; requiredEvidence: string | null;
  risks: string | null; updatedAt: string;
}
interface UpdateLogEntry {
  id: string; logCode: string; updateType: string; title: string;
  description: string | null; fieldChanged: string | null;
  oldValue: string | null; newValue: string | null;
  changeReason: string | null; requiresGovReview: boolean;
  govReviewStatus: string | null; govReviewedByName: string | null;
  govReviewedAt: string | null; govReviewNotes: string | null;
  evidenceLinks: string | null; createdByName: string | null;
  createdByInitials: string | null; createdAt: string;
}
interface OrderDetail {
  id: string; orderCode: string; type: string; name: string;
  unitCode: string | null; unitName: string | null; unitColor: string | null;
  projectCode: string | null; projectName: string | null; projectPhase: string | null;
  ownerName: string | null; priority: string; status: string;
  startDate: string | null; dueDate: string | null;
  percentComplete: number; rescheduleCount: number;
  dependencies: string | null; links: string | null; notes: string | null;
  createdAt: string; updatedAt: string; createdByName: string | null;
  effectiveRAG: RAGStatus; isOverdue: boolean;
  description: DescriptionData | null;
  updateLogs: UpdateLogEntry[];
  auditLogs: { id: string; action: string; field: string | null; oldValue: string | null; newValue: string | null; notes: string | null; userName: string; initials: string | null; createdAt: string }[];
  children: { id: string; orderCode: string; name: string; status: string; percentComplete: number; priority: string; ownerName: string | null; dueDate: string | null }[];
  govItems: { id: string; govCode: string; title: string; type: string; status: string; priority: string }[];
}

type Tab = 'overview' | 'update-log' | 'governance' | 'attachments';

// ── Main ───────────────────────────────────────────────────────
export default function OrderDetailClient({
  order, canEdit, currentUserId,
}: {
  order: OrderDetail; canEdit: boolean; currentUserId: string;
}) {
  const [tab, setTab] = useState<Tab>('overview');
  const color = order.unitColor && order.unitColor.length <= 9 ? order.unitColor : '#3b82f6';

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'overview',    label: 'Overview' },
    { id: 'update-log',  label: 'Update Log',  count: order.updateLogs.length },
    { id: 'governance',  label: 'Governance',  count: order.govItems.length },
    { id: 'attachments', label: 'Attachments' },
  ];

  return (
    <div className="space-y-5 max-w-5xl">

      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)]">
        <Link href="/orders" className="hover:text-[var(--text-2)]">All Orders</Link>
        <span>›</span>
        <span className="text-[var(--text)] font-medium">{order.orderCode}</span>
      </div>

      {/* Header card */}
      <div className="pes-card p-5" style={{ borderTop: `2px solid ${color}` }}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2.5 mb-2 flex-wrap">
              <span className="font-display font-bold text-[12px] text-blue-400">{order.orderCode}</span>
              <span className="text-[11px] text-[var(--text-3)]">·</span>
              <span className="text-[11px] text-[var(--text-3)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                {order.type.replace(/_/g, ' ')}
              </span>
              {order.unitCode && (
                <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                  style={{ borderLeft: `2px solid ${color}`, background: `${color}18`, color }}>
                  {order.unitCode}
                </span>
              )}
              {order.isOverdue && (
                <span className="text-[11px] bg-red-500/15 text-red-400 px-2 py-0.5 rounded font-semibold">⚠ OVERDUE</span>
              )}
            </div>
            <h1 className="font-display font-bold text-xl text-[var(--text)] leading-tight">{order.name}</h1>
            {order.projectName && (
              <div className="text-[13px] text-[var(--text-2)] mt-1">Project: {order.projectName}</div>
            )}
          </div>

          {canEdit && (
            <Link href={`/orders/${order.id}/edit`}>
              <button className="pes-btn-ghost text-xs flex-shrink-0">✏ Edit</button>
            </Link>
          )}
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3 mt-4 pt-4 border-t border-[var(--border)]">
          <MetaCell label="Status">    <StatusBadge status={order.status as any} /></MetaCell>
          <MetaCell label="Priority">  <PriorityBadge priority={order.priority as any} /></MetaCell>
          <MetaCell label="RAG">       <RAGDot rag={order.effectiveRAG} showLabel /></MetaCell>
          <MetaCell label="Progress">
            <div className="space-y-1 min-w-[80px]">
              <ProgressBar value={order.percentComplete} size="sm" />
              <span className="text-[11px] text-[var(--text-2)]">{order.percentComplete}%</span>
            </div>
          </MetaCell>
          <MetaCell label="Owner">     <span className="text-[12.5px]">{order.ownerName ?? '—'}</span></MetaCell>
          <MetaCell label="Due">
            <span className={`text-[12.5px] ${order.isOverdue ? 'text-red-400' : ''}`}>
              {order.dueDate ? new Date(order.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
            </span>
          </MetaCell>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[var(--border)] pb-0">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`
              px-4 py-2 text-[13px] font-medium transition-all border-b-2 -mb-px
              ${tab === t.id
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'
              }
            `}
          >
            {t.label}
            {t.count !== undefined && (
              <span className={`ml-1.5 text-[11px] px-1.5 py-0.5 rounded-full ${t.count === 0 ? 'bg-[var(--surface-3)] text-[var(--text-3)]' : 'bg-[var(--surface-3)] text-[var(--text-2)]'}`}>
                {t.count === 0 ? '—' : t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {tab === 'overview'    && <OverviewTab order={order} />}
        {tab === 'update-log'  && <UpdateLogTab order={order} canEdit={canEdit} />}
        {tab === 'governance'  && <GovernanceTab order={order} />}
        {tab === 'attachments' && <AttachmentsTab orderId={order.id} canEdit={canEdit} />}
      </div>
    </div>
  );
}

// ── Tab Components ─────────────────────────────────────────────

function OverviewTab({ order }: { order: OrderDetail }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {/* Core details */}
      <div className="pes-card p-5 space-y-4">
        <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)]">Details</div>
        {[
          ['Order Code', order.orderCode],
          ['Type',       order.type.replace(/_/g,' ')],
          ['Project',    order.projectName ?? '—'],
          ['Phase',      order.projectPhase ?? '—'],
          ['Unit',       order.unitName ?? '—'],
          ['Start Date', order.startDate ? new Date(order.startDate).toLocaleDateString('en-GB') : '—'],
          ['Due Date',   order.dueDate   ? new Date(order.dueDate).toLocaleDateString('en-GB')   : '—'],
          ['Reschedules', String(order.rescheduleCount)],
          ['Created by', order.createdByName ?? '—'],
          ['Created',    new Date(order.createdAt).toLocaleDateString('en-GB')],
          ['Last Updated', new Date(order.updatedAt).toLocaleDateString('en-GB')],
        ].map(([k, v]) => (
          <div key={k} className="flex justify-between text-[13px]">
            <span className="text-[var(--text-3)]">{k}</span>
            <span className="text-[var(--text)] text-right">{v}</span>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {/* Subtasks */}
        {order.children.length > 0 && (
          <div className="pes-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">Subtasks ({order.children.length})</div>
            <div className="space-y-2">
              {order.children.map(c => (
                <Link key={c.id} href={`/orders/${c.id}`}
                  className="flex items-center gap-2 p-2 rounded-lg hover:bg-[var(--surface-2)] transition-colors">
                  <StatusBadge status={c.status as any} />
                  <span className="text-[13px] flex-1 truncate text-[var(--text)]">{c.name}</span>
                  <span className="text-[11.5px] text-[var(--text-3)]">{c.percentComplete}%</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {order.notes && (
          <div className="pes-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">Notes</div>
            <p className="text-[13px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{order.notes}</p>
          </div>
        )}

        {/* Links */}
        {order.links && (
          <div className="pes-card p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">Links</div>
            {order.links.split(',').map((l, i) => (
              <a key={i} href={l.trim()} target="_blank" rel="noopener noreferrer"
                className="block text-[13px] text-blue-400 hover:text-blue-300 truncate mb-1">
                {l.trim()}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function DescriptionTab({ order, canEdit }: { order: OrderDetail; canEdit: boolean }) {
  const d = order.description;

  const FIELDS = [
    { key: 'objective',        label: '🎯 Objective',         placeholder: 'What is the goal of this task or project?' },
    { key: 'scope',            label: '🗺 Scope',              placeholder: 'What is in scope / out of scope?' },
    { key: 'rationale',        label: '💡 Rationale',          placeholder: 'Why is this being done? What triggered it?' },
    { key: 'governanceImpact', label: '🛡 Governance Impact',  placeholder: 'Effect on policies, procedures, or compliance…' },
    { key: 'affectedUnit',     label: '🏢 Affected Unit(s)',   placeholder: 'Which units are impacted?' },
    { key: 'relatedPolicies',  label: '📄 Related Policies',   placeholder: 'Policy or procedure references (comma-separated)' },
    { key: 'requiredEvidence', label: '📎 Required Evidence',  placeholder: 'What evidence or documentation is needed?' },
    { key: 'risks',            label: '⚠ Risks / Flags',       placeholder: 'Any risks, dependencies, or flags for governance…' },
  ];

  return (
    <div className="space-y-4">
      {!d && (
        <div className="pes-card p-5 border-dashed border-[var(--border-2)] bg-[var(--surface)]/50">
          <div className="text-center py-6">
            <div className="text-3xl mb-2 opacity-40">📝</div>
            <div className="text-[14px] font-medium text-[var(--text-2)] mb-1">No description yet</div>
            <p className="text-[12.5px] text-[var(--text-3)] mb-4 max-w-sm mx-auto">
              Add a governance-ready description with objectives, scope, impact, and evidence requirements.
            </p>
            {canEdit && (
              <Link href={`/orders/${order.id}/edit?tab=description`}>
                <button className="pes-btn-primary text-xs">+ Add Description</button>
              </Link>
            )}
          </div>
        </div>
      )}

      {d && (
        <>
          <div className="flex justify-between items-center">
            <span className="text-[11.5px] text-[var(--text-3)]">
              Last edited: {new Date(d.updatedAt).toLocaleDateString('en-GB')}
            </span>
            {canEdit && (
              <Link href={`/orders/${order.id}/edit?tab=description`}>
                <button className="pes-btn-ghost text-xs">✏ Edit Description</button>
              </Link>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4">
            {FIELDS.map(f => {
              const val = (d as any)[f.key];
              if (!val) return null;
              return (
                <div key={f.key} className="pes-card p-4">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-2">{f.label}</div>
                  <p className="text-[13.5px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">{val}</p>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function UpdateLogTab({ order, canEdit }: { order: OrderDetail; canEdit: boolean }) {
  const [showForm, setShowForm] = useState(false);
  const UPDATE_TYPE_STYLES: Record<string, { color: string; icon: string }> = {
    PROGRESS_UPDATE:   { color: '#3b82f6', icon: '📊' },
    SCOPE_CHANGE:      { color: '#8b5cf6', icon: '🗺' },
    DATE_CHANGE:       { color: '#f59e0b', icon: '📅' },
    OWNER_CHANGE:      { color: '#06b6d4', icon: '👤' },
    GOVERNANCE_UPDATE: { color: '#10b981', icon: '🛡' },
    POLICY_CHANGE:     { color: '#a855f7', icon: '📄' },
    EVIDENCE_ADDED:    { color: '#10b981', icon: '📎' },
    NOTE:              { color: '#6b7280', icon: '📝' },
    SYSTEM_CHANGE:     { color: '#f59e0b', icon: '⚙' },
  };

  const GOV_REVIEW_COLORS: Record<string, string> = {
    PENDING:  '#f59e0b',
    APPROVED: '#10b981',
    REJECTED: '#ef4444',
    'N/A':    '#6b7280',
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="text-[12.5px] text-[var(--text-3)]">{order.updateLogs.length} entries</span>
        {canEdit && (
          <button onClick={() => setShowForm(true)} className="pes-btn-primary text-xs">+ Add Update</button>
        )}
      </div>

      {order.updateLogs.length === 0 ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">📋</div>
          <div className="text-[13.5px] text-[var(--text-3)]">No updates logged yet</div>
        </div>
      ) : (
        <div className="space-y-3">
          {order.updateLogs.map(log => {
            const style = UPDATE_TYPE_STYLES[log.updateType] ?? { color: '#6b7280', icon: '📝' };
            return (
              <div key={log.id} className="pes-card p-4" style={{ borderLeft: `2px solid ${style.color}` }}>
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px]">{style.icon}</span>
                    <span className="font-semibold text-[13.5px] text-[var(--text)]">{log.title}</span>
                    <span className="text-[10.5px] font-mono text-[var(--text-3)]">{log.logCode}</span>
                    <span
                      className="text-[10.5px] px-1.5 py-0.5 rounded font-semibold"
                      style={{ background: `${style.color}18`, color: style.color }}
                    >
                      {log.updateType.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <span className="text-[11.5px] text-[var(--text-3)] flex-shrink-0">
                    {new Date(log.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
                  </span>
                </div>

                {/* Field change pill */}
                {log.fieldChanged && (
                  <div className="flex items-center gap-2 mb-2 text-[12px]">
                    <span className="text-[var(--text-3)] font-mono bg-[var(--surface-3)] px-1.5 py-0.5 rounded text-[11px]">{log.fieldChanged}</span>
                    <span className="text-[var(--text-3)] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded text-[11px] line-through">{log.oldValue ?? '—'}</span>
                    <span className="text-[var(--text-2)]">→</span>
                    <span className="bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded text-[11px]">{log.newValue ?? '—'}</span>
                  </div>
                )}

                {log.description && (
                  <p className="text-[13px] text-[var(--text-2)] leading-relaxed mb-2">{log.description}</p>
                )}

                {log.changeReason && (
                  <div className="text-[12px] text-[var(--text-3)] bg-[var(--surface-3)] px-3 py-2 rounded-lg mt-2">
                    <span className="font-semibold text-[var(--text-2)]">Reason: </span>{log.changeReason}
                  </div>
                )}

                {/* Governance review status */}
                {log.requiresGovReview && (
                  <div className="flex items-center gap-2 mt-2 pt-2 border-t border-[var(--border)]">
                    <span className="text-[11px] text-[var(--text-3)]">Gov. Review:</span>
                    <span
                      className="text-[11px] font-semibold"
                      style={{ color: GOV_REVIEW_COLORS[log.govReviewStatus ?? 'PENDING'] }}
                    >
                      ● {log.govReviewStatus ?? 'PENDING'}
                    </span>
                    {log.govReviewedByName && (
                      <span className="text-[11px] text-[var(--text-3)]">by {log.govReviewedByName}</span>
                    )}
                    {log.govReviewNotes && (
                      <span className="text-[11px] text-[var(--text-3)] truncate max-w-[200px]">— {log.govReviewNotes}</span>
                    )}
                  </div>
                )}

                <div className="flex items-center gap-2 mt-2 text-[11.5px] text-[var(--text-3)]">
                  {log.createdByInitials && (
                    <span className="w-5 h-5 rounded-full bg-[var(--surface-3)] flex items-center justify-center text-[9px] font-bold text-[var(--text-2)]">
                      {log.createdByInitials}
                    </span>
                  )}
                  <span>{log.createdByName ?? 'System'}</span>
                  {log.evidenceLinks && (
                    <a href={log.evidenceLinks} target="_blank" rel="noopener" className="ml-auto text-blue-400 hover:text-blue-300">
                      📎 Evidence
                    </a>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function GovernanceTab({ order }: { order: OrderDetail }) {
  const STATUS_COLORS: Record<string, string> = {
    ACTIVE: '#10b981', DRAFT: '#6b7280', UNDER_REVIEW: '#f59e0b',
    SUPERSEDED: '#6b7280', ARCHIVED: '#374151',
  };

  return (
    <div className="space-y-4">
      <div className="text-[12.5px] text-[var(--text-3)]">
        Governance items linked to unit <strong className="text-[var(--text-2)]">{order.unitCode ?? '—'}</strong>
      </div>

      {order.govItems.length === 0 ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-40">🛡</div>
          <div className="text-[13.5px] text-[var(--text-3)]">No governance items for this unit</div>
          <Link href="/governance" className="text-[12.5px] text-blue-400 hover:text-blue-300 mt-2 block">
            View Governance Registry →
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {order.govItems.map(g => (
            <Link key={g.id} href={`/governance/${g.id}`}>
              <div className="pes-card p-4 hover:border-[var(--border-2)] transition-colors flex items-center gap-3">
                <span className="text-[11px] font-mono font-bold text-purple-400 flex-shrink-0">{g.govCode}</span>
                <span className="text-[13px] text-[var(--text)] flex-1 truncate">{g.title}</span>
                <span className="text-[11px] text-[var(--text-3)] flex-shrink-0">{g.type.replace(/_/g,' ')}</span>
                <span className="text-[11px] font-semibold flex-shrink-0" style={{ color: STATUS_COLORS[g.status] ?? '#6b7280' }}>
                  ● {g.status}
                </span>
                <span className="text-[var(--text-3)] text-[12px]">→</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function AuditTab({ order }: { order: OrderDetail }) {
  const ACTION_ICONS: Record<string, string> = {
    CREATE: '➕', UPDATE: '✏️', DELETE: '🗑️', LOGIN: '🔐',
    STATUS_CHANGE: '🔄', EXPORT: '📤', IMPORT: '📥', APPROVE: '✅',
  };

  return (
    <div className="space-y-2">
      {order.auditLogs.map(a => (
        <div key={a.id} className="pes-card px-4 py-3 flex items-start gap-3">
          <span className="text-[14px] flex-shrink-0 mt-0.5">{ACTION_ICONS[a.action] ?? '📝'}</span>
          <div className="flex-1 min-w-0">
            <div className="text-[13px]">
              <span className="font-semibold text-[var(--text)]">{a.userName}</span>
              <span className="text-[var(--text-2)]"> · {a.action.replace(/_/g,' ')}</span>
              {a.field && <span className="text-[var(--text-3)]"> — {a.field}</span>}
            </div>
            {a.field && a.oldValue !== undefined && (
              <div className="text-[11.5px] mt-0.5">
                <span className="text-red-400 line-through mr-1">{a.oldValue ?? '—'}</span>
                <span className="text-[var(--text-3)] mr-1">→</span>
                <span className="text-green-400">{a.newValue ?? '—'}</span>
              </div>
            )}
            {a.notes && <div className="text-[11.5px] text-[var(--text-3)] mt-0.5">{a.notes}</div>}
          </div>
          <span className="text-[11px] text-[var(--text-3)] flex-shrink-0 whitespace-nowrap">
            {new Date(a.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
          </span>
        </div>
      ))}
      {order.auditLogs.length === 0 && (
        <div className="pes-card p-8 text-center text-[var(--text-3)] text-[13px]">No audit entries yet</div>
      )}
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
