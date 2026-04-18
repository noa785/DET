'use client';
// src/app/(protected)/gov-tasks/_components/GovTaskForm.tsx
// Create + Edit governance tasks

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Spinner } from '@/components/ui/badges';

const TASK_TYPES = [
  { value: 'POLICY_REVIEW',        label: '📄 Policy Review' },
  { value: 'PROCEDURE_UPDATE',     label: '📋 Procedure Update' },
  { value: 'COMPLIANCE_CHECK',     label: '✅ Compliance Check' },
  { value: 'TRAINING_REQUIRED',    label: '🎓 Training Required' },
  { value: 'EVIDENCE_COLLECTION',  label: '📎 Evidence Collection' },
  { value: 'SIGN_OFF_REQUIRED',    label: '✍ Sign-off Required' },
  { value: 'IMPACT_ASSESSMENT',    label: '📊 Impact Assessment' },
  { value: 'DOCUMENTATION',        label: '📝 Documentation' },
];

const STATUS_OPTS = [
  { value: 'TODO',               label: 'To Do',            color: '#6b7280' },
  { value: 'IN_PROGRESS',        label: 'In Progress',      color: '#3b82f6' },
  { value: 'AWAITING_APPROVAL',  label: 'Awaiting Approval',color: '#f59e0b' },
  { value: 'DONE',               label: 'Done',             color: '#10b981' },
  { value: 'CANCELLED',          label: 'Cancelled',        color: '#374151' },
];

const PRIORITY_OPTS = [
  { value: 'LOW',      label: 'Low',      color: '#6b7280' },
  { value: 'MEDIUM',   label: 'Medium',   color: '#f59e0b' },
  { value: 'HIGH',     label: 'High',     color: '#f87171' },
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
];

interface GovItem { id: string; govCode: string; title: string; }
interface User    { id: string; name: string; }

interface InitialData {
  govItemId: string;
  changeRequestId?: string | null;
  title: string;
  type: string;
  description?: string | null;
  status: string;
  priority: string;
  assigneeId?: string | null;
  approverId?: string | null;
  dueDate?: string | null;
  requiredEvidence?: string | null;
  completionEvidence?: string | null;
  approvalRequired: boolean;
}

interface Props {
  mode: 'create' | 'edit';
  taskId?: string;
  taskCode?: string;
  govItems: GovItem[];
  users: User[];
  initialData?: Partial<InitialData>;
  defaultGovItemId?: string;
}

const DEFAULTS: InitialData = {
  govItemId: '', changeRequestId: null, title: '', type: 'POLICY_REVIEW',
  description: null, status: 'TODO', priority: 'MEDIUM',
  assigneeId: null, approverId: null, dueDate: null,
  requiredEvidence: null, completionEvidence: null, approvalRequired: false,
};

export default function GovTaskForm({
  mode, taskId, taskCode, govItems, users, initialData, defaultGovItemId,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<InitialData>({
    ...DEFAULTS,
    ...initialData,
    govItemId: initialData?.govItemId ?? defaultGovItemId ?? '',
  });
  const [errors, setErrors]       = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg]   = useState<string | null>(null);

  function f<K extends keyof InitialData>(k: K, v: InitialData[K]) {
    setForm(p => ({ ...p, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k as string]; return n; });
  }

  function validate(): boolean {
    const errs: Record<string, string> = {};
    if (!form.govItemId.trim()) errs.govItemId = 'Governance item is required';
    if (!form.title.trim())     errs.title = 'Title is required';
    if (!form.type)             errs.type  = 'Task type is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;
    setServerError(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        const url    = mode === 'create' ? '/api/gov-tasks' : `/api/gov-tasks/${taskId}`;
        const method = mode === 'create' ? 'POST' : 'PATCH';

        const payload = {
          govItemId:          form.govItemId,
          changeRequestId:    form.changeRequestId  || null,
          title:              form.title.trim(),
          type:               form.type,
          description:        form.description      || null,
          status:             form.status,
          priority:           form.priority,
          assigneeId:         form.assigneeId       || null,
          approverId:         form.approverId       || null,
          dueDate:            form.dueDate          || null,
          requiredEvidence:   form.requiredEvidence  || null,
          completionEvidence: form.completionEvidence || null,
          approvalRequired:   form.approvalRequired,
        };

        const r    = await fetch(url, {
          method,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        const json = await r.json();
        const savedId = mode === 'create' ? json.data.id : taskId!;

        setSuccessMsg(mode === 'create' ? `Created ${json.data.taskCode}` : 'Saved successfully');
        setTimeout(() => router.push(`/gov-tasks/${savedId}`), 900);
      } catch (e: any) {
        setServerError(e.message ?? 'Save failed');
      }
    });
  }

  const isBusy = isPending;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] mb-1">
          <Link href="/gov-tasks" className="hover:text-[var(--text-2)]">Governance Tasks</Link>
          <span>›</span>
          <span className="text-[var(--text)]">{mode === 'create' ? 'New Task' : `Edit ${taskCode}`}</span>
        </div>
        <h1 className="font-display font-bold text-[22px] text-[var(--text)]">
          {mode === 'create' ? '+ New Governance Task' : `Edit ${taskCode}`}
        </h1>
      </div>

      <div className="pes-card p-5 space-y-5">

        {/* Governance Item */}
        <div>
          <label className="pes-label">Governance Item <span className="text-red-400">*</span></label>
          <select
            value={form.govItemId}
            onChange={e => f('govItemId', e.target.value)}
            className={`pes-input w-full mt-1 ${errors.govItemId ? 'border-red-500' : ''}`}
          >
            <option value="">— select governance item —</option>
            {govItems.map(g => (
              <option key={g.id} value={g.id}>{g.govCode} — {g.title}</option>
            ))}
          </select>
          {errors.govItemId && <p className="text-red-400 text-[11.5px] mt-1">{errors.govItemId}</p>}
        </div>

        {/* Title */}
        <div>
          <label className="pes-label">Task Title <span className="text-red-400">*</span></label>
          <input
            type="text"
            value={form.title}
            onChange={e => f('title', e.target.value)}
            placeholder="e.g. Review and update procurement policy…"
            className={`pes-input w-full mt-1 ${errors.title ? 'border-red-500' : ''}`}
          />
          {errors.title && <p className="text-red-400 text-[11.5px] mt-1">{errors.title}</p>}
        </div>

        {/* Type */}
        <div>
          <label className="pes-label">Task Type <span className="text-red-400">*</span></label>
          <div className="grid grid-cols-2 gap-2 mt-1.5">
            {TASK_TYPES.map(t => (
              <button
                key={t.value}
                type="button"
                onClick={() => f('type', t.value)}
                className={`
                  text-left px-3 py-2 rounded-lg text-[12.5px] border transition-all
                  ${form.type === t.value
                    ? 'border-purple-500/50 bg-purple-500/10 text-purple-300'
                    : 'border-[var(--border)] text-[var(--text-2)] hover:border-[var(--border-2)] hover:text-[var(--text)]'}
                `}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Status + Priority row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="pes-label">Status</label>
            <select value={form.status} onChange={e => f('status', e.target.value)} className="pes-input w-full mt-1">
              {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="pes-label">Priority</label>
            <select value={form.priority} onChange={e => f('priority', e.target.value)} className="pes-input w-full mt-1">
              {PRIORITY_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>
          </div>
        </div>

        {/* Assignee + Approver row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="pes-label">Assignee</label>
            <select value={form.assigneeId ?? ''} onChange={e => f('assigneeId', e.target.value || null)} className="pes-input w-full mt-1">
              <option value="">— unassigned —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="pes-label">Due Date</label>
            <input
              type="date"
              value={form.dueDate ?? ''}
              onChange={e => f('dueDate', e.target.value || null)}
              className="pes-input w-full mt-1"
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="pes-label">Description</label>
          <textarea
            rows={3}
            value={form.description ?? ''}
            onChange={e => f('description', e.target.value || null)}
            placeholder="Describe what needs to be done, context, and any governance requirements…"
            className="pes-input w-full mt-1 resize-none"
          />
        </div>

        {/* Required Evidence */}
        <div>
          <label className="pes-label">Required Evidence</label>
          <textarea
            rows={2}
            value={form.requiredEvidence ?? ''}
            onChange={e => f('requiredEvidence', e.target.value || null)}
            placeholder="What documents, approvals, or evidence must be provided to complete this task?"
            className="pes-input w-full mt-1 resize-none"
          />
        </div>

        {/* Approval required toggle */}
        <div className="flex items-center gap-3 py-3 px-4 rounded-lg bg-[var(--surface-2)] border border-[var(--border)]">
          <input
            type="checkbox"
            id="approvalRequired"
            checked={form.approvalRequired}
            onChange={e => f('approvalRequired', e.target.checked)}
            className="accent-purple-500 w-4 h-4 cursor-pointer"
          />
          <label htmlFor="approvalRequired" className="text-[13px] text-[var(--text-2)] cursor-pointer flex-1">
            Requires approval before closing
          </label>
          {form.approvalRequired && (
            <select
              value={form.approverId ?? ''}
              onChange={e => f('approverId', e.target.value || null)}
              className="pes-input w-[180px] py-1.5 text-[12.5px]"
            >
              <option value="">— select approver —</option>
              {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          )}
        </div>

        {/* Completion Evidence (edit mode only) */}
        {mode === 'edit' && (
          <div>
            <label className="pes-label">Completion Evidence</label>
            <textarea
              rows={2}
              value={form.completionEvidence ?? ''}
              onChange={e => f('completionEvidence', e.target.value || null)}
              placeholder="Links, documents, or notes proving task completion…"
              className="pes-input w-full mt-1 resize-none"
            />
          </div>
        )}
      </div>

      {/* Error / Success */}
      {serverError && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-[13px]">
          ✕ {serverError}
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 text-[13px]">
          ✓ {successMsg}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={handleSubmit}
          disabled={isBusy}
          className="pes-btn-primary flex items-center gap-2"
        >
          {isBusy ? <Spinner size={14} /> : (mode === 'create' ? '✓ Create Task' : '✓ Save Changes')}
        </button>
        <button
          type="button"
          onClick={() => router.back()}
          disabled={isBusy}
          className="pes-btn-ghost text-[13px] text-[var(--text-3)]"
        >
          Cancel
        </button>
        {mode === 'edit' && taskId && (
          <Link href={`/gov-tasks/${taskId}`} className="ml-auto">
            <button className="pes-btn-ghost text-xs text-[var(--text-3)]">← Back to Task</button>
          </Link>
        )}
      </div>
    </div>
  );
}
