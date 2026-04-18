'use client';
// src/components/forms/OrderForm.tsx
// Unified form for New + Edit order
// Tabs: 1) Core fields  2) Governance Description  3) Links & Dependencies

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

// ── Types ──────────────────────────────────────────────────────
type FormTab = 'core' | 'description' | 'links';

interface OrderFormData {
  id?: string;
  orderCode?: string;
  type: string;
  name: string;
  unitId: string;
  projectId: string;
  ownerId: string;
  priority: string;
  status: string;
  startDate: string;
  dueDate: string;
  percentComplete: number;
  dependencies: string;
  links: string;
  notes: string;
  // Description (governance)
  objective: string;
  scope: string;
  rationale: string;
  governanceImpact: string;
  affectedUnit: string;
  relatedPolicies: string;
  requiredEvidence: string;
  risks: string;
}

interface Props {
  mode: 'create' | 'edit';
  initialData?: Partial<OrderFormData>;
  units: { id: string; code: string; name: string; colorHex: string | null }[];
  projects: { id: string; code: string; name: string }[];
  users: { id: string; name: string }[];
  currentUserId: string;
  defaultTab?: FormTab;
}

const DEFAULT: OrderFormData = {
  type: 'TASK', name: '', unitId: '', projectId: '', ownerId: '',
  priority: 'MEDIUM', status: 'NOT_STARTED',
  startDate: '', dueDate: '', percentComplete: 0,
  dependencies: '', links: '', notes: '',
  objective: '', scope: '', rationale: '', governanceImpact: '',
  affectedUnit: '', relatedPolicies: '', requiredEvidence: '', risks: '',
};

const ORDER_TYPES    = ['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK'];
const STATUS_OPTIONS = ['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED'];
const PRIORITY_OPTIONS = ['LOW','MEDIUM','HIGH','CRITICAL'];
const PRIORITY_COLORS: Record<string, string> = { LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444' };

// ── Component ──────────────────────────────────────────────────
export default function OrderForm({ mode, initialData, units, projects, users, currentUserId, defaultTab }: Props) {
  const router    = useRouter();
  const [data, setData]   = useState<OrderFormData>({ ...DEFAULT, ...initialData });
  const [tab, setTab]     = useState<FormTab>(defaultTab ?? 'core');
  const [errors, setErrors] = useState<Partial<Record<keyof OrderFormData, string>>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [saving, setSaving] = useState(false);

  function set(key: keyof OrderFormData, val: string | number) {
    setData(d => ({ ...d, [key]: val }));
    if (errors[key]) setErrors(e => ({ ...e, [key]: undefined }));
  }

  function validate(): boolean {
    const errs: Partial<Record<keyof OrderFormData, string>> = {};
    if (!data.name.trim())   errs.name = 'Name is required';
    if (!data.type)          errs.type = 'Type is required';
    if (data.percentComplete < 0 || data.percentComplete > 100) errs.percentComplete = 'Must be 0–100';
    if (data.startDate && data.dueDate && data.startDate > data.dueDate) {
      errs.dueDate = 'Due date must be after start date';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent, andClose = true) {
    e.preventDefault();
    if (!validate()) { setTab('core'); return; }

    setSaving(true);
    setApiError(null);

    try {
      const url    = mode === 'create' ? '/api/orders' : `/api/orders/${data.id}`;
      const method = mode === 'create' ? 'POST' : 'PATCH';

      const body: any = {
        name:            data.name.trim(),
        type:            data.type,
        unitId:          data.unitId    || null,
        projectId:       data.projectId || null,
        ownerId:         data.ownerId   || null,
        priority:        data.priority,
        status:          data.status,
        startDate:       data.startDate || null,
        dueDate:         data.dueDate   || null,
        percentComplete: data.percentComplete,
        dependencies:    data.dependencies || null,
        links:           data.links        || null,
        notes:           data.notes        || null,
      };

      const res  = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();

      if (!res.ok) {
        setApiError(json.error ?? 'Save failed');
        setSaving(false);
        return;
      }

      const orderId = json.data?.id ?? data.id;

      // Save description separately if any desc field is filled
      const hasDesc = data.objective || data.scope || data.rationale ||
        data.governanceImpact || data.affectedUnit || data.relatedPolicies ||
        data.requiredEvidence || data.risks;

      if (hasDesc && orderId) {
        await fetch(`/api/orders/${orderId}/description`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            objective:        data.objective        || null,
            scope:            data.scope            || null,
            rationale:        data.rationale        || null,
            governanceImpact: data.governanceImpact || null,
            affectedUnit:     data.affectedUnit     || null,
            relatedPolicies:  data.relatedPolicies  || null,
            requiredEvidence: data.requiredEvidence || null,
            risks:            data.risks            || null,
          }),
        });
      }

      setSaving(false);
      if (andClose) {
        startTransition(() => router.push(`/orders/${orderId}`));
      } else {
        // Save & continue editing
        if (mode === 'create') {
          startTransition(() => router.push(`/orders/${orderId}/edit`));
        }
        router.refresh();
      }
    } catch (err) {
      setApiError('Network error — please try again');
      setSaving(false);
    }
  }

  const isBusy = saving || isPending;

  const tabs: { id: FormTab; label: string; icon: string; required?: boolean }[] = [
    { id: 'core',        label: 'Core Fields',       icon: '📋', required: true },
    { id: 'description', label: 'Governance Description', icon: '🛡' },
    { id: 'links',       label: 'Links & Dependencies',   icon: '🔗' },
  ];

  const hasDescError = false; // could validate desc fields
  const descFilled = !!(data.objective || data.scope || data.rationale || data.governanceImpact);

  return (
    <form onSubmit={handleSubmit} noValidate>

      {/* Tab nav */}
      <div className="flex gap-1 border-b border-[var(--border)] mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`
              flex items-center gap-1.5 px-4 py-2 text-[13px] font-medium
              border-b-2 -mb-px transition-all
              ${tab === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}
            `}
          >
            <span>{t.icon}</span>
            {t.label}
            {t.id === 'description' && descFilled && (
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 ml-0.5" />
            )}
          </button>
        ))}
      </div>

      {/* ── Tab: Core ─────────────────────────────────────────── */}
      {tab === 'core' && (
        <div className="space-y-5">

          {/* Name */}
          <div>
            <label className="pes-label">Task / Project Name <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={data.name}
              onChange={e => set('name', e.target.value)}
              placeholder="e.g. Update ELI Academic Calendar Procedures"
              className={`pes-input w-full mt-1 ${errors.name ? 'border-red-500' : ''}`}
              autoFocus
            />
            {errors.name && <p className="text-red-400 text-[11.5px] mt-1">{errors.name}</p>}
          </div>

          {/* Type + Priority row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pes-label">Type <span className="text-red-400">*</span></label>
              <select value={data.type} onChange={e => set('type', e.target.value)} className="pes-input w-full mt-1">
                {ORDER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="pes-label">Priority</label>
              <div className="flex gap-2 mt-1">
                {PRIORITY_OPTIONS.map(p => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => set('priority', p)}
                    className="flex-1 py-1.5 rounded text-[11px] font-semibold transition-all border"
                    style={{
                      borderColor: data.priority === p ? PRIORITY_COLORS[p] : '#1f2d45',
                      background: data.priority === p ? `${PRIORITY_COLORS[p]}18` : 'transparent',
                      color: data.priority === p ? PRIORITY_COLORS[p] : '#6b7280',
                    }}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="pes-label">Status</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {STATUS_OPTIONS.map(s => {
                const STATUS_C: Record<string, string> = {
                  NOT_STARTED:'#6b7280', IN_PROGRESS:'#3b82f6', UNDER_REVIEW:'#f59e0b',
                  BLOCKED:'#ef4444', ON_HOLD:'#9ca3af', DONE:'#10b981', CANCELLED:'#4b5563',
                };
                const c = STATUS_C[s];
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => set('status', s)}
                    className="px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all border"
                    style={{
                      borderColor: data.status === s ? c : '#1f2d45',
                      background: data.status === s ? `${c}18` : 'transparent',
                      color: data.status === s ? c : '#6b7280',
                    }}
                  >
                    {s.replace(/_/g,' ')}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Unit + Project row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="pes-label">Unit</label>
              <select value={data.unitId} onChange={e => set('unitId', e.target.value)} className="pes-input w-full mt-1">
                <option value="">— not assigned —</option>
                {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
              </select>
            </div>
            <div>
              <label className="pes-label">Project</label>
              <select value={data.projectId} onChange={e => set('projectId', e.target.value)} className="pes-input w-full mt-1">
                <option value="">— standalone task —</option>
                {projects.map(p => <option key={p.id} value={p.id}>{p.code} — {p.name}</option>)}
              </select>
            </div>
          </div>

          {/* Owner */}
          <div>
            <label className="pes-label">Owner</label>
            <select value={data.ownerId} onChange={e => set('ownerId', e.target.value)} className="pes-input w-full mt-1">
              <option value="">— unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Dates row */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="pes-label">Start Date</label>
              <input type="date" value={data.startDate} onChange={e => set('startDate', e.target.value)} className="pes-input w-full mt-1" />
            </div>
            <div>
              <label className="pes-label">Due Date</label>
              <input
                type="date"
                value={data.dueDate}
                onChange={e => set('dueDate', e.target.value)}
                className={`pes-input w-full mt-1 ${errors.dueDate ? 'border-red-500' : ''}`}
              />
              {errors.dueDate && <p className="text-red-400 text-[11.5px] mt-1">{errors.dueDate}</p>}
            </div>
            <div>
              <label className="pes-label">% Complete</label>
              <div className="flex items-center gap-2 mt-1">
                <input
                  type="range"
                  min={0} max={100} step={5}
                  value={data.percentComplete}
                  onChange={e => set('percentComplete', parseInt(e.target.value))}
                  className="flex-1 accent-blue-500"
                />
                <input
                  type="number"
                  min={0} max={100}
                  value={data.percentComplete}
                  onChange={e => set('percentComplete', Math.max(0, Math.min(100, parseInt(e.target.value) || 0)))}
                  className="pes-input w-14 text-center py-1 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="pes-label">Notes</label>
            <textarea
              rows={3}
              value={data.notes}
              onChange={e => set('notes', e.target.value)}
              placeholder="Brief operational notes…"
              className="pes-input w-full mt-1 resize-none"
            />
          </div>
        </div>
      )}

      {/* ── Tab: Governance Description ───────────────────────── */}
      {tab === 'description' && (
        <div className="space-y-5">
          <div className="pes-card p-4 border-purple-500/20 bg-purple-500/5">
            <p className="text-[12.5px] text-purple-300">
              🛡 This description is <strong>governance-facing</strong> — it helps reviewers understand the purpose, scope, and compliance impact.
              Fill as much as relevant. All fields are optional but recommended for governance items.
            </p>
          </div>

          {[
            { key: 'objective',        label: '🎯 Objective',            hint: 'What is the goal or purpose of this task/project?' },
            { key: 'scope',            label: '🗺 Scope',                 hint: 'What is in scope? What is explicitly out of scope?' },
            { key: 'rationale',        label: '💡 Rationale / Trigger',   hint: 'Why is this being done? What triggered it?' },
            { key: 'governanceImpact', label: '🛡 Governance Impact',     hint: 'Effect on procedures, policies, or compliance requirements…' },
            { key: 'affectedUnit',     label: '🏢 Affected Unit(s)',      hint: 'Which units or departments are impacted?' },
            { key: 'relatedPolicies',  label: '📄 Related Policies',      hint: 'Policy or procedure references (comma-separated)' },
            { key: 'requiredEvidence', label: '📎 Required Evidence',     hint: 'What documentation or evidence must be provided?' },
            { key: 'risks',            label: '⚠ Risks / Flags',          hint: 'Risks, blockers, or governance concerns…' },
          ].map(field => (
            <div key={field.key}>
              <label className="pes-label">{field.label}</label>
              <textarea
                rows={field.key === 'objective' || field.key === 'scope' ? 3 : 2}
                value={(data as any)[field.key]}
                onChange={e => set(field.key as any, e.target.value)}
                placeholder={field.hint}
                className="pes-input w-full mt-1 resize-none leading-relaxed"
              />
            </div>
          ))}
        </div>
      )}

      {/* ── Tab: Links & Dependencies ─────────────────────────── */}
      {tab === 'links' && (
        <div className="space-y-5">

          <div>
            <label className="pes-label">Links</label>
            <p className="text-[11.5px] text-[var(--text-3)] mb-1">Comma-separated URLs — e.g. SharePoint documents, Jira tickets, reports</p>
            <textarea
              rows={3}
              value={data.links}
              onChange={e => set('links', e.target.value)}
              placeholder="https://sharepoint.dgcc.edu.sa/doc/..., https://jira/ticket/123"
              className="pes-input w-full resize-none"
            />
          </div>

          <div>
            <label className="pes-label">Dependencies</label>
            <p className="text-[11.5px] text-[var(--text-3)] mb-1">Order codes or task names this depends on (comma-separated)</p>
            <textarea
              rows={2}
              value={data.dependencies}
              onChange={e => set('dependencies', e.target.value)}
              placeholder="ORD-0012, ORD-0045"
              className="pes-input w-full resize-none"
            />
          </div>

          <div className="pes-card p-4 border-dashed border-[var(--border-2)]">
            <p className="text-[12.5px] text-[var(--text-3)]">
              📁 <strong className="text-[var(--text-2)]">File attachments</strong> — coming in Batch 8 (file upload to Supabase Storage)
            </p>
          </div>
        </div>
      )}

      {/* ── Error banner ─────────────────────────────────────── */}
      {apiError && (
        <div className="mt-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
          ✕ {apiError}
        </div>
      )}

      {/* ── Actions ───────────────────────────────────────────── */}
      <div className="mt-8 flex items-center gap-3 pt-5 border-t border-[var(--border)]">
        <button
          type="submit"
          disabled={isBusy}
          className="pes-btn-primary flex items-center gap-2"
        >
          {isBusy ? <Spinner size={14} /> : (mode === 'create' ? '✓ Create Order' : '✓ Save Changes')}
        </button>

        {mode === 'create' && (
          <button
            type="button"
            onClick={e => handleSubmit(e as any, false)}
            disabled={isBusy}
            className="pes-btn-ghost text-[13px]"
          >
            Save & Add Another
          </button>
        )}

        <button
          type="button"
          onClick={() => router.back()}
          disabled={isBusy}
          className="pes-btn-ghost text-[13px] text-[var(--text-3)]"
        >
          Cancel
        </button>

        {/* Progress indicator for tabs */}
        <div className="ml-auto flex gap-1">
          {(['core','description','links'] as FormTab[]).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`w-1.5 h-1.5 rounded-full transition-all ${tab === t ? 'bg-blue-500 w-4' : 'bg-[#1f2d45]'}`}
            />
          ))}
        </div>
      </div>
    </form>
  );
}
