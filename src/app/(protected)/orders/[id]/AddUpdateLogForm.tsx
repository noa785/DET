'use client';
// src/app/(protected)/orders/[id]/AddUpdateLogForm.tsx
// Slide-in form to add an update log entry with governance review option

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

const UPDATE_TYPES = [
  { value: 'PROGRESS_UPDATE',   label: '📊 Progress Update' },
  { value: 'SCOPE_CHANGE',      label: '🗺 Scope Change' },
  { value: 'DATE_CHANGE',       label: '📅 Date Change' },
  { value: 'OWNER_CHANGE',      label: '👤 Owner Change' },
  { value: 'GOVERNANCE_UPDATE', label: '🛡 Governance Update' },
  { value: 'POLICY_CHANGE',     label: '📄 Policy Change' },
  { value: 'EVIDENCE_ADDED',    label: '📎 Evidence Added' },
  { value: 'NOTE',              label: '📝 General Note' },
  { value: 'SYSTEM_CHANGE',     label: '⚙ System Change' },
];

interface Props {
  orderId: string;
  orderCode: string;
  onSuccess: () => void;
  onCancel: () => void;
}

export default function AddUpdateLogForm({ orderId, orderCode, onSuccess, onCancel }: Props) {
  const router  = useRouter();
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState('');

  const [form, setForm] = useState({
    updateType:        'PROGRESS_UPDATE',
    title:             '',
    description:       '',
    fieldChanged:      '',
    oldValue:          '',
    newValue:          '',
    changeReason:      '',
    requiresGovReview: false,
    evidenceLinks:     '',
  });

  function set(key: string, val: string | boolean) {
    setForm(f => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) { setError('Title is required'); return; }

    setSaving(true); setError('');

    const res = await fetch(`/api/orders/${orderId}/update-logs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        updateType:        form.updateType,
        title:             form.title.trim(),
        description:       form.description || null,
        fieldChanged:      form.fieldChanged || null,
        oldValue:          form.oldValue || null,
        newValue:          form.newValue || null,
        changeReason:      form.changeReason || null,
        requiresGovReview: form.requiresGovReview,
        evidenceLinks:     form.evidenceLinks || null,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? 'Failed to save');
      setSaving(false); return;
    }

    router.refresh();
    onSuccess();
  }

  return (
    <div className="pes-card p-5 border-blue-500/20 bg-blue-500/3">
      <div className="font-display font-bold text-[14px] text-[var(--text)] mb-4">+ Add Update Log Entry</div>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-[12.5px] text-red-400">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Update type + title */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pes-label block mb-1">Update Type</label>
            <select value={form.updateType} onChange={e => set('updateType', e.target.value)} className="pes-input text-[13px] py-1.5">
              {UPDATE_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="pes-label block mb-1">Title <span className="text-red-400">*</span></label>
            <input
              type="text"
              value={form.title}
              onChange={e => set('title', e.target.value)}
              className="pes-input text-[13px] py-1.5"
              placeholder="e.g. Due date extended to March 2026"
              required
            />
          </div>
        </div>

        {/* Description */}
        <div>
          <label className="pes-label block mb-1">Description</label>
          <textarea
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={2}
            className="pes-input resize-none text-[13px]"
            placeholder="Additional details about this update…"
          />
        </div>

        {/* Field change (optional) */}
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="pes-label block mb-1">Field Changed</label>
            <input type="text" value={form.fieldChanged} onChange={e => set('fieldChanged', e.target.value)}
              className="pes-input text-[13px] py-1.5" placeholder="e.g. dueDate" />
          </div>
          <div>
            <label className="pes-label block mb-1">Old Value</label>
            <input type="text" value={form.oldValue} onChange={e => set('oldValue', e.target.value)}
              className="pes-input text-[13px] py-1.5" placeholder="Before" />
          </div>
          <div>
            <label className="pes-label block mb-1">New Value</label>
            <input type="text" value={form.newValue} onChange={e => set('newValue', e.target.value)}
              className="pes-input text-[13px] py-1.5" placeholder="After" />
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="pes-label block mb-1">Reason for Change</label>
          <input type="text" value={form.changeReason} onChange={e => set('changeReason', e.target.value)}
            className="pes-input text-[13px] py-1.5"
            placeholder="Why was this changed? Context for governance…" />
        </div>

        {/* Evidence + Gov Review */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pes-label block mb-1">Evidence Link(s)</label>
            <input type="text" value={form.evidenceLinks} onChange={e => set('evidenceLinks', e.target.value)}
              className="pes-input text-[13px] py-1.5" placeholder="https://…" />
          </div>
          <div className="flex items-center gap-3 pt-5">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form.requiresGovReview}
                onChange={e => set('requiresGovReview', e.target.checked)}
                className="w-4 h-4 accent-purple-500 cursor-pointer"
              />
              <span className="text-[13px] text-[var(--text-2)]">Requires Governance Review</span>
            </label>
          </div>
        </div>

        {form.requiresGovReview && (
          <div className="px-3 py-2.5 bg-purple-500/8 border border-purple-500/20 rounded-lg text-[12.5px] text-purple-300">
            🛡 This update will be flagged for governance review. Status will be set to <strong>PENDING</strong> until approved.
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit" disabled={saving} className="pes-btn-primary text-xs">
            {saving ? <Spinner size={13} /> : '+ Log Update'}
          </button>
          <button type="button" onClick={onCancel} className="pes-btn-ghost text-xs">Cancel</button>
        </div>
      </form>
    </div>
  );
}
