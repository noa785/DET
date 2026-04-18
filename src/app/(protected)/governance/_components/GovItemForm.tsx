'use client';
// src/app/(protected)/governance/_components/GovItemForm.tsx
// Create + Edit governance items
// Fields: title, type, status, priority, riskLevel, unit, owner, reviewer,
//         version, effectiveDate, reviewCycleDays, nextReviewDate,
//         source, complianceImpact, notes, evidenceLinks

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@/components/ui/badges';

// ── Constants ──────────────────────────────────────────────────
const GOV_TYPES = [
  { value: 'POLICY',                label: '📄 Policy' },
  { value: 'PROCEDURE',             label: '📋 Procedure' },
  { value: 'STANDARD',              label: '📐 Standard' },
  { value: 'GUIDELINE',             label: '📌 Guideline' },
  { value: 'COMMITTEE_DECISION',    label: '🏛 Committee Decision' },
  { value: 'CONTROL',               label: '🔐 Control' },
  { value: 'COMPLIANCE_REQUIREMENT',label: '✅ Compliance Requirement' },
  { value: 'UPDATE_ITEM',           label: '🔄 Update Item' },
];

const STATUS_OPTS = [
  { value: 'DRAFT',        label: 'Draft',        color: '#6b7280' },
  { value: 'ACTIVE',       label: 'Active',       color: '#10b981' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: '#f59e0b' },
  { value: 'SUPERSEDED',   label: 'Superseded',   color: '#9ca3af' },
  { value: 'ARCHIVED',     label: 'Archived',     color: '#374151' },
];

const PRIORITY_OPTS = ['LOW','MEDIUM','HIGH','CRITICAL'];
const RISK_OPTS     = ['LOW','MEDIUM','HIGH','CRITICAL'];
const CYCLE_OPTS    = [
  { value: '', label: '— no cycle —' },
  { value: '30',  label: 'Monthly (30 days)' },
  { value: '90',  label: 'Quarterly (90 days)' },
  { value: '180', label: 'Semi-annual (180 days)' },
  { value: '365', label: 'Annual (365 days)' },
];

// ── Types ──────────────────────────────────────────────────────
interface FormData {
  title:             string;
  type:              string;
  status:            string;
  priority:          string;
  riskLevel:         string;
  unitId:            string;
  ownerId:           string;
  reviewerId:        string;
  version:           string;
  effectiveDate:     string;
  reviewCycleDays:   string;
  nextReviewDate:    string;
  source:            string;
  complianceImpact:  string;
  notes:             string;
  evidenceLinks:     string;
}

interface Props {
  mode: 'create' | 'edit';
  govItemId?: string;
  govCode?: string;
  initialData?: Partial<FormData>;
  units:    { id: string; code: string; name: string }[];
  users:    { id: string; name: string }[];
  prefillTitle?: string;
  prefillNotes?: string;
  fromOrderCode?: string;
}

const DEFAULTS: FormData = {
  title: '', type: 'POLICY', status: 'DRAFT', priority: 'MEDIUM',
  riskLevel: 'MEDIUM', unitId: '', ownerId: '', reviewerId: '',
  version: '1.0', effectiveDate: '', reviewCycleDays: '', nextReviewDate: '',
  source: '', complianceImpact: '', notes: '', evidenceLinks: '',
};

type Tab = 'core' | 'review' | 'notes';

// ── Component ──────────────────────────────────────────────────
export default function GovItemForm({
  mode, govItemId, govCode, initialData, units, users,
  prefillTitle, prefillNotes, fromOrderCode,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [data, setData] = useState<FormData>({
    ...DEFAULTS,
    ...initialData,
    ...(prefillTitle ? { title: prefillTitle } : {}),
    ...(prefillNotes ? { notes: prefillNotes } : {}),
  });
  const [tab, setTab]         = useState<Tab>('core');
  const [errors, setErrors]   = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [saving, setSaving]   = useState(false);

  function set(k: keyof FormData, v: string) {
    setData(d => ({ ...d, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!data.title.trim()) errs.title = 'Title is required';
    if (!data.type)         errs.type  = 'Type is required';
    if (data.effectiveDate && data.nextReviewDate &&
        data.nextReviewDate < data.effectiveDate) {
      errs.nextReviewDate = 'Review date must be after effective date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) { setTab('core'); return; }

    setSaving(true);
    setApiError(null);

    const body = {
      title:            data.title.trim(),
      type:             data.type,
      status:           data.status,
      priority:         data.priority,
      riskLevel:        data.riskLevel,
      unitId:           data.unitId  || null,
      ownerId:          data.ownerId || null,
      reviewerId:       data.reviewerId || null,
      version:          data.version || '1.0',
      effectiveDate:    data.effectiveDate  || null,
      nextReviewDate:   data.nextReviewDate || null,
      reviewCycleDays:  data.reviewCycleDays ? parseInt(data.reviewCycleDays) : null,
      source:           data.source           || null,
      complianceImpact: data.complianceImpact || null,
      notes:            data.notes            || null,
      evidenceLinks:    data.evidenceLinks    || null,
    };

    try {
      const url    = mode === 'create' ? '/api/governance' : `/api/governance/${govItemId}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const res  = await fetch(url, {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const json = await res.json();

      if (!res.ok) { setApiError(json.error ?? 'Save failed'); setSaving(false); return; }

      const id = mode === 'create' ? json.data?.id : govItemId;
      startTransition(() => router.push(`/governance/${id}`));
      router.refresh();
    } catch {
      setApiError('Network error — please try again');
      setSaving(false);
    }
  }

  const TABS: { id: Tab; label: string; icon: string }[] = [
    { id: 'core',   label: 'Core Details',   icon: '🛡' },
    { id: 'review', label: 'Review Cycle',   icon: '📅' },
    { id: 'notes',  label: 'Notes & Evidence', icon: '📎' },
  ];

  return (
    <div className="max-w-3xl space-y-5">

      {/* Linked order banner */}
      {fromOrderCode && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 8,
          background: 'rgba(139,92,246,0.08)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}>
          <span style={{ fontSize: 18 }}>⬙</span>
          <div style={{ fontSize: 13, color: 'var(--text-2)' }}>
            Creating governance item linked to order{' '}
            <strong style={{ color: '#8b5cf6' }}>{fromOrderCode}</strong>.
            The title and notes have been pre-filled — edit as needed.
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] mb-1">
            <Link href="/governance" className="hover:text-[var(--text-2)]">Governance Registry</Link>
            <span>›</span>
            <span className="text-[var(--text)]">{mode === 'create' ? 'New Gov. Item' : `Edit ${govCode}`}</span>
          </div>
          <h1 className="font-display font-bold text-[22px] text-[var(--text)]">
            {mode === 'create' ? '+ New Governance Item' : `Edit ${govCode}`}
          </h1>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1">
            {mode === 'create'
              ? 'Create a new policy, procedure, standard, or governance control'
              : 'Update the governance item details'}
          </p>
        </div>
        {mode === 'edit' && govItemId && (
          <Link href={`/governance/${govItemId}`}>
            <button className="pes-btn-ghost text-xs">← Back</button>
          </Link>
        )}
      </div>

      {/* Form card */}
      <div className="pes-card p-6">

        {/* Tabs */}
        <div className="flex gap-1 border-b border-[var(--border)] mb-6">
          {TABS.map(t => (
            <button key={t.id} type="button" onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium border-b-2 -mb-px transition-all
                ${tab === t.id ? 'border-purple-500 text-purple-400' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
              <span>{t.icon}</span>{t.label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} noValidate>

          {/* ── Tab: Core Details ── */}
          {tab === 'core' && (
            <div className="space-y-5">

              {/* Title */}
              <div>
                <label className="pes-label">Title <span className="text-red-400">*</span></label>
                <input
                  type="text"
                  value={data.title}
                  onChange={e => set('title', e.target.value)}
                  placeholder="e.g. Procurement Policy v2.1 — Annual Review"
                  className={`pes-input w-full mt-1 ${errors.title ? 'border-red-500' : ''}`}
                />
                {errors.title && <p className="text-red-400 text-[11.5px] mt-1">{errors.title}</p>}
              </div>

              {/* Type + Status */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pes-label">Type <span className="text-red-400">*</span></label>
                  <select value={data.type} onChange={e => set('type', e.target.value)}
                    className={`pes-input w-full mt-1 ${errors.type ? 'border-red-500' : ''}`}>
                    {GOV_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pes-label">Status</label>
                  <select value={data.status} onChange={e => set('status', e.target.value)} className="pes-input w-full mt-1">
                    {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Priority + Risk */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pes-label">Priority</label>
                  <select value={data.priority} onChange={e => set('priority', e.target.value)} className="pes-input w-full mt-1">
                    {PRIORITY_OPTS.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pes-label">Risk Level</label>
                  <select value={data.riskLevel} onChange={e => set('riskLevel', e.target.value)} className="pes-input w-full mt-1">
                    {RISK_OPTS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Unit + Version */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pes-label">Unit</label>
                  <select value={data.unitId} onChange={e => set('unitId', e.target.value)} className="pes-input w-full mt-1">
                    <option value="">— institution-wide —</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pes-label">Version</label>
                  <input type="text" value={data.version} onChange={e => set('version', e.target.value)}
                    placeholder="1.0" className="pes-input w-full mt-1" />
                </div>
              </div>

              {/* Owner + Reviewer */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pes-label">Owner</label>
                  <select value={data.ownerId} onChange={e => set('ownerId', e.target.value)} className="pes-input w-full mt-1">
                    <option value="">— unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="pes-label">Reviewer</label>
                  <select value={data.reviewerId} onChange={e => set('reviewerId', e.target.value)} className="pes-input w-full mt-1">
                    <option value="">— unassigned —</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </div>
              </div>

              {/* Source */}
              <div>
                <label className="pes-label">Source / Reference</label>
                <input type="text" value={data.source} onChange={e => set('source', e.target.value)}
                  placeholder="e.g. MoHE Decree 2024/45, Board Resolution #12"
                  className="pes-input w-full mt-1" />
              </div>

              {/* Compliance Impact */}
              <div>
                <label className="pes-label">Compliance Impact</label>
                <textarea rows={2} value={data.complianceImpact} onChange={e => set('complianceImpact', e.target.value)}
                  placeholder="Describe the compliance impact or regulatory requirement…"
                  className="pes-input w-full mt-1 resize-none" />
              </div>
            </div>
          )}

          {/* ── Tab: Review Cycle ── */}
          {tab === 'review' && (
            <div className="space-y-5">

              <div className="pes-card p-4 border-purple-500/20 bg-purple-500/5">
                <p className="text-[12.5px] text-purple-300">
                  📅 Set the effective date and review schedule. The system will automatically track overdue reviews.
                </p>
              </div>

              {/* Effective Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="pes-label">Effective Date</label>
                  <input type="date" value={data.effectiveDate} onChange={e => set('effectiveDate', e.target.value)}
                    className="pes-input w-full mt-1" />
                </div>
                <div>
                  <label className="pes-label">Next Review Date</label>
                  <input type="date" value={data.nextReviewDate} onChange={e => set('nextReviewDate', e.target.value)}
                    className={`pes-input w-full mt-1 ${errors.nextReviewDate ? 'border-red-500' : ''}`} />
                  {errors.nextReviewDate && <p className="text-red-400 text-[11.5px] mt-1">{errors.nextReviewDate}</p>}
                </div>
              </div>

              {/* Review Cycle */}
              <div>
                <label className="pes-label">Review Cycle</label>
                <select value={data.reviewCycleDays} onChange={e => set('reviewCycleDays', e.target.value)}
                  className="pes-input w-full mt-1">
                  {CYCLE_OPTS.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                <p className="text-[11.5px] text-[var(--text-3)] mt-1">
                  When set, the system will auto-calculate the next review date after each completed review.
                </p>
              </div>

              {/* Review history hint */}
              {mode === 'edit' && (
                <div className="pes-card p-4 border-dashed border-[var(--border-2)]">
                  <p className="text-[12.5px] text-[var(--text-3)]">
                    📋 Past review history is tracked in the <strong className="text-[var(--text-2)]">Update Log</strong> tab on the governance item detail page.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* ── Tab: Notes & Evidence ── */}
          {tab === 'notes' && (
            <div className="space-y-5">

              <div>
                <label className="pes-label">Notes</label>
                <textarea rows={5} value={data.notes} onChange={e => set('notes', e.target.value)}
                  placeholder="Additional notes, context, or background information…"
                  className="pes-input w-full mt-1 resize-none" />
              </div>

              <div>
                <label className="pes-label">Evidence Links</label>
                <p className="text-[11.5px] text-[var(--text-3)] mb-1">Comma-separated URLs to supporting documents</p>
                <textarea rows={3} value={data.evidenceLinks} onChange={e => set('evidenceLinks', e.target.value)}
                  placeholder="https://sharepoint.dgcc.edu.sa/policy/..., https://drive/doc/..."
                  className="pes-input w-full resize-none" />
              </div>
            </div>
          )}

          {/* API error */}
          {apiError && (
            <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
              ✕ {apiError}
            </div>
          )}

          {/* Actions */}
          <div className="mt-8 flex items-center gap-3 pt-5 border-t border-[var(--border)]">
            <button type="submit" disabled={saving}
              className="pes-btn-primary flex items-center gap-2" style={{ background: '#7c3aed' }}>
              {saving ? <Spinner size={14} /> : (mode === 'create' ? '✓ Create Gov. Item' : '✓ Save Changes')}
            </button>

            <button type="button" onClick={() => router.back()} disabled={saving}
              className="pes-btn-ghost text-[13px] text-[var(--text-3)]">
              Cancel
            </button>

            <div className="ml-auto flex gap-1">
              {(['core','review','notes'] as Tab[]).map(t => (
                <button key={t} type="button" onClick={() => setTab(t)}
                  className={`h-1.5 rounded-full transition-all ${tab === t ? 'bg-purple-500 w-4' : 'bg-[#1f2d45] w-1.5'}`} />
              ))}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
