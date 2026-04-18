'use client';
// src/app/(protected)/orders/[id]/edit/DescriptionForm.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

interface DescData {
  objective: string; scope: string; rationale: string;
  governanceImpact: string; affectedUnit: string;
  relatedPolicies: string; requiredEvidence: string; risks: string;
}

interface Props {
  orderId: string;
  orderCode: string;
  initialData?: Partial<DescData>;
}

const FIELDS: { key: keyof DescData; label: string; icon: string; placeholder: string; required?: boolean }[] = [
  {
    key: 'objective', icon: '🎯', label: 'Objective',
    placeholder: 'What is the goal of this task or project? What outcome is expected?',
    required: true,
  },
  {
    key: 'scope', icon: '🗺', label: 'Scope',
    placeholder: 'What is in scope? What is explicitly out of scope?',
  },
  {
    key: 'rationale', icon: '💡', label: 'Rationale / Trigger',
    placeholder: 'Why is this being done? What triggered this task or project?',
  },
  {
    key: 'governanceImpact', icon: '🛡', label: 'Governance Impact',
    placeholder: 'Does this affect any policies, procedures, standards, or compliance requirements? Describe the impact.',
  },
  {
    key: 'affectedUnit', icon: '🏢', label: 'Affected Unit(s)',
    placeholder: 'Which organizational units or teams are impacted by this work?',
  },
  {
    key: 'relatedPolicies', icon: '📄', label: 'Related Policies / Standards',
    placeholder: 'List any related policies, standards, or procedure references (comma-separated)',
  },
  {
    key: 'requiredEvidence', icon: '📎', label: 'Required Evidence / Documentation',
    placeholder: 'What evidence or documentation is needed for governance sign-off or compliance?',
  },
  {
    key: 'risks', icon: '⚠', label: 'Risks / Flags / Dependencies',
    placeholder: 'Any risks, blockers, dependencies, or flags that governance should be aware of?',
  },
];

export default function DescriptionForm({ orderId, orderCode, initialData }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [error,  setError]  = useState('');

  const [form, setForm] = useState<DescData>({
    objective:         initialData?.objective         ?? '',
    scope:             initialData?.scope             ?? '',
    rationale:         initialData?.rationale         ?? '',
    governanceImpact:  initialData?.governanceImpact  ?? '',
    affectedUnit:      initialData?.affectedUnit      ?? '',
    relatedPolicies:   initialData?.relatedPolicies   ?? '',
    requiredEvidence:  initialData?.requiredEvidence  ?? '',
    risks:             initialData?.risks             ?? '',
  });

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setSaved(false); setError('');

    const res = await fetch(`/api/orders/${orderId}/description`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (!res.ok) {
      setError('Failed to save description');
      setSaving(false); return;
    }

    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 3000);
    router.refresh();
  }

  return (
    <form onSubmit={handleSave} className="space-y-4">
      {/* Context banner */}
      <div className="pes-card p-4 flex items-center gap-3 border-purple-500/20 bg-purple-500/5">
        <span className="text-2xl">🛡</span>
        <div>
          <div className="text-[13px] font-semibold text-purple-300">Governance-Ready Description</div>
          <div className="text-[12px] text-[var(--text-3)]">
            This description is used by the governance team to review and approve work. Be specific and thorough.
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400">{error}</div>
      )}

      {FIELDS.map(f => (
        <div key={f.key} className="pes-card p-4">
          <label className="flex items-center gap-2 mb-2">
            <span className="text-[16px]">{f.icon}</span>
            <span className="pes-label">{f.label}</span>
            {f.required && <span className="text-red-400 text-[11px]">required</span>}
          </label>
          <textarea
            value={form[f.key]}
            onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
            rows={3}
            className="pes-input resize-none w-full text-[13.5px] leading-relaxed"
            placeholder={f.placeholder}
            required={f.required}
          />
        </div>
      ))}

      <div className="flex gap-3 pt-2 border-t border-[var(--border)]">
        <button type="submit" disabled={saving} className="pes-btn-primary">
          {saving ? <Spinner size={14} /> : '💾 Save Description'}
        </button>
        <button type="button" onClick={() => router.back()} className="pes-btn-ghost">Cancel</button>
        {saved && <span className="text-green-400 text-[13px] self-center">✅ Saved</span>}
      </div>
    </form>
  );
}
