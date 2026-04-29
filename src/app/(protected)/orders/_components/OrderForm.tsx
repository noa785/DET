'use client';
// src/app/(protected)/orders/_components/OrderForm.tsx
// Simplified — single scrollable form, no tabs
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  OrderFormSchema,
  ORDER_FORM_DEFAULTS,
  type OrderFormValues,
} from '@/lib/validation/order.schemas';
import {
  TextInput, TextArea, Select, DateInput, PercentSlider,
} from '@/components/ui/form-fields';

const TYPE_OPTS = [
  { value: 'PROGRAM', label: 'Program' }, { value: 'PROJECT', label: 'Project' },
  { value: 'DELIVERABLE', label: 'Deliverable' }, { value: 'TASK', label: 'Task' },
  { value: 'SUBTASK', label: 'Subtask' },
];
const STATUS_OPTS = [
  { value: 'NOT_STARTED', label: 'Not Started' }, { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'UNDER_REVIEW', label: 'Under Review' }, { value: 'BLOCKED', label: 'Blocked' },
  { value: 'ON_HOLD', label: 'On Hold' }, { value: 'DONE', label: 'Done' },
  { value: 'CANCELLED', label: 'Cancelled' },
];
const PRIORITY_OPTS = [
  { value: 'LOW', label: 'Low' }, { value: 'MEDIUM', label: 'Medium' },
  { value: 'HIGH', label: 'High' }, { value: 'CRITICAL', label: 'Critical' },
];

interface SelectOpt { id: string; label: string; }
interface Props {
  mode: 'create' | 'edit';
  orderId?: string; orderCode?: string;
  initialValues?: Partial<OrderFormValues>;
  initialDescription?: any; // kept for API compat, ignored in UI
  units: SelectOpt[]; projects: SelectOpt[]; users: SelectOpt[];
  defaultTab?: string; // ignored — kept for compat
}

export default function OrderForm({
  mode, orderId, orderCode, initialValues,
  units, projects, users,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<OrderFormValues>({ ...ORDER_FORM_DEFAULTS, ...initialValues });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  // Toast state — drives the success popup that appears after save
  const [toast, setToast] = useState<{ title: string; subtitle: string; govNotified: boolean } | null>(null);

  function f<K extends keyof OrderFormValues>(k: K, v: OrderFormValues[K]) {
    setForm(prev => ({ ...prev, [k]: v }));
    setErrors(e => { const n = { ...e }; delete n[k]; return n; });
  }

  async function handleSubmit() {
    setServerError(null); setToast(null);
    const parsed = OrderFormSchema.safeParse(form);
    if (!parsed.success) {
      const errs: Record<string, string> = {};
      parsed.error.issues.forEach(i => { errs[String(i.path[0])] = i.message; });
      setErrors(errs);
      return;
    }
    startTransition(async () => {
      try {
        const url  = mode === 'create' ? '/api/orders' : `/api/orders/${orderId}`;
        const meth = mode === 'create' ? 'POST' : 'PATCH';
        const r = await fetch(url, {
          method: meth,
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });
        if (!r.ok) {
          const j = await r.json().catch(() => ({}));
          throw new Error(j.error ?? `HTTP ${r.status}`);
        }
        const json = await r.json();
        const savedId   = mode === 'create' ? json.data.id : orderId!;
        const savedCode = mode === 'create' ? json.data.orderCode : orderCode;
        const willNotifyGov = !!parsed.data.govReviewRequired &&
          (mode === 'create' || (mode === 'edit' && (initialValues as any)?.govReviewRequired === false));

        setToast({
          title:    mode === 'create' ? 'Order created successfully' : 'Changes saved successfully',
          subtitle: mode === 'create'
            ? `Order ${savedCode} has been added to the system.`
            : `Order ${savedCode} has been updated.`,
          govNotified: willNotifyGov,
        });
        // Give the user enough time to read the toast before redirecting
        setTimeout(() => router.push(`/orders/${savedId}`), 1800);
      } catch (e: any) { setServerError(e.message ?? 'Save failed'); }
    });
  }

  const divider = (label: string) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 0' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );

  return (
    <div style={{ maxWidth: 720 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: 'var(--text-3)', marginBottom: 4 }}>
            <Link href="/orders" style={{ color: 'var(--text-3)', textDecoration: 'none' }}>All Orders</Link>
            <span>›</span>
            <span style={{ color: 'var(--text)' }}>{mode === 'create' ? 'New Order' : `Edit ${orderCode}`}</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
            {mode === 'create' ? '+ New Order' : `Edit ${orderCode}`}
          </h1>
        </div>
        {mode === 'edit' && orderId && (
          <Link href={`/orders/${orderId}`}>
            <button className="pes-btn pes-btn-ghost" style={{ fontSize: 12 }}>← Back</button>
          </Link>
        )}
      </div>

      {/* Alerts */}
      {serverError && (
        <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16 }}>
          {serverError}
        </div>
      )}

      {/* Single card form */}
      <div className="pes-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>

        {/* ── Basic Info ── */}
        {divider('Basic Information')}

        <TextInput label="Order Name" required value={form.name}
          onChange={e => f('name', e.target.value)} error={errors.name}
          placeholder="e.g. Update ELI Timetable Scheduling System" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Select label="Type" required value={form.type}
            onChange={v => f('type', v as any)} options={TYPE_OPTS} error={errors.type} />
          <Select label="Unit" value={form.unitId ?? ''}
            onChange={v => f('unitId', v || null)}
            options={units.map(u => ({ value: u.id, label: u.label }))} placeholder="Select unit…" />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Select label="Project Type" value={(form as any).projectType ?? ''}
            onChange={v => f('projectType' as any, v || null)}
            options={[
              { value: 'SYSTEM_BUILD',  label: '🖥 System Build' },
              { value: 'DATA_ANALYSIS', label: '📊 Data Analysis' },
              { value: 'OTHER',         label: '◻ Other' },
            ]}
            placeholder="Select project type…" />
          <Select label="Owner" value={form.ownerId ?? ''}
            onChange={v => f('ownerId', v || null)}
            options={users.map(u => ({ value: u.id, label: u.label }))} placeholder="Assign to…" />
        </div>

        {/* ── Status & Progress ── */}
        {divider('Status & Progress')}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <Select label="Status" required value={form.status}
            onChange={v => f('status', v as any)} options={STATUS_OPTS} error={errors.status} />
          <Select label="Priority" required value={form.priority}
            onChange={v => f('priority', v as any)} options={PRIORITY_OPTS} error={errors.priority} />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <DateInput label="Start Date" value={form.startDate ?? null}
            onChange={v => f('startDate', v)} error={errors.startDate} />
          <DateInput label="Due Date" value={form.dueDate ?? null}
            onChange={v => f('dueDate', v)} error={errors.dueDate} />
        </div>

        <PercentSlider label="% Complete" value={form.percentComplete}
          onChange={v => f('percentComplete', v)} error={errors.percentComplete} />

        {/* ── Notes & Governance ── */}
        {divider('Notes & Governance')}

        <TextArea label="Notes" value={form.notes ?? ''} onChange={e => f('notes', e.target.value || null)}
          placeholder="Any relevant context, blockers, or comments…" autoGrow rows={3} />

        {/* Gov. Review Required */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', borderRadius: 8,
          background: 'rgba(139,92,246,0.06)',
          border: '1px solid rgba(139,92,246,0.18)',
          cursor: 'pointer',
        }} onClick={() => f('govReviewRequired' as any, !(form as any).govReviewRequired)}>
          <input
            type="checkbox"
            checked={(form as any).govReviewRequired ?? false}
            onChange={e => f('govReviewRequired' as any, e.target.checked)}
            onClick={e => e.stopPropagation()}
            style={{ width: 16, height: 16, accentColor: '#8b5cf6', cursor: 'pointer', flexShrink: 0 }}
          />
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>
              Requires Governance Team Review
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
              Flags this order in the Gov. Review Dashboard automatically
            </div>
          </div>
        </div>

      </div>

      {/* Actions */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
        <Link href={mode === 'edit' && orderId ? `/orders/${orderId}` : '/orders'}>
          <button className="pes-btn pes-btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
        </Link>
        <button
          onClick={handleSubmit}
          disabled={isPending || !form.name.trim()}
          className="pes-btn pes-btn-primary"
          style={{ fontSize: 13, opacity: isPending || !form.name.trim() ? 0.5 : 1 }}
        >
          {isPending ? 'Saving…' : mode === 'create' ? 'Create Order' : 'Save Changes'}
        </button>
      </div>

      {/* ── Success Toast (top-right, dismissible) ── */}
      {toast && (
        <>
          <style>{`
            @keyframes pesToastIn {
              from { opacity: 0; transform: translateY(-12px) scale(0.96); }
              to   { opacity: 1; transform: translateY(0)     scale(1); }
            }
            @keyframes pesToastBar {
              from { width: 100%; } to { width: 0%; }
            }
          `}</style>
          <div
            role="status"
            aria-live="polite"
            style={{
              position: 'fixed',
              top: 24,
              right: 24,
              zIndex: 9999,
              minWidth: 340,
              maxWidth: 420,
              background: 'var(--surface, #fff)',
              border: '1px solid var(--border)',
              borderLeft: '4px solid #10b981',
              borderRadius: 10,
              boxShadow: '0 10px 30px rgba(0,0,0,0.18), 0 4px 8px rgba(0,0,0,0.08)',
              padding: '14px 16px 12px',
              animation: 'pesToastIn 220ms cubic-bezier(0.16, 1, 0.3, 1)',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              {/* Checkmark badge */}
              <div style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(16,185,129,0.15)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="#10b981" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)', lineHeight: 1.3 }}>
                  {toast.title}
                </div>
                <div style={{ fontSize: 12.5, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.45 }}>
                  {toast.subtitle}
                </div>
                {toast.govNotified && (
                  <div style={{
                    marginTop: 10,
                    padding: '8px 10px',
                    background: 'rgba(139,92,246,0.08)',
                    border: '1px solid rgba(139,92,246,0.2)',
                    borderRadius: 6,
                    fontSize: 12,
                    color: 'var(--text)',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 8,
                  }}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                      stroke="#8b5cf6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                      style={{ flexShrink: 0, marginTop: 1 }}>
                      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
                    </svg>
                    <span>The Governance team has been notified for review.</span>
                  </div>
                )}
              </div>
              <button
                onClick={() => setToast(null)}
                aria-label="Dismiss notification"
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  color: 'var(--text-3)', padding: 2, lineHeight: 0,
                  flexShrink: 0,
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6"  y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
            {/* Progress bar — shows time remaining before redirect */}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, height: 2,
              background: '#10b981',
              animation: 'pesToastBar 1800ms linear forwards',
            }} />
          </div>
        </>
      )}

    </div>
  );
}
