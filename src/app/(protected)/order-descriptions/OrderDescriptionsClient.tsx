// src/app/(protected)/order-descriptions/OrderDescriptionsClient.tsx
'use client';

import { useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Description {
  objective:        string | null;
  scope:            string | null;
  rationale:        string | null;
  governanceImpact: string | null;
  affectedUnit:     string | null;
  relatedPolicies:  string | null;
  requiredEvidence: string | null;
  risks:            string | null;
  updatedAt:        string;
}

interface Row {
  id:           string;
  orderCode:    string;
  name:         string;
  status:       string;
  unitCode:     string | null;
  unitName:     string | null;
  unitColor:    string | null;
  projectCode:  string | null;
  projectName:  string | null;
  description:  Description | null;
}

interface Props {
  rows:  Row[];
  units: { code: string; name: string }[];
}

const FIELDS: { key: keyof Description; label: string }[] = [
  { key: 'objective',        label: 'Objective' },
  { key: 'scope',            label: 'Scope' },
  { key: 'rationale',        label: 'Rationale' },
  { key: 'governanceImpact', label: 'Governance Impact' },
  { key: 'affectedUnit',     label: 'Affected Unit' },
  { key: 'relatedPolicies',  label: 'Related Policies' },
  { key: 'requiredEvidence', label: 'Required Evidence' },
  { key: 'risks',            label: 'Risks / Flags' },
];

export default function OrderDescriptionsClient({ rows, units }: Props) {
  const router = useRouter();

  const [search, setSearch]     = useState('');
  const [unitFilter, setUnit]   = useState<string>('');
  const [showOnlyFilled, setShowOnlyFilled] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  // Inline edit state
  const [editingId, setEditingId]   = useState<string | null>(null);
  const [editForm,  setEditForm]    = useState<Record<string, string>>({});
  const [saving,    setSaving]      = useState(false);
  const [saveError, setSaveError]   = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState<string | null>(null);

  // "+ Add Description" picker state
  const [pickerOpen, setPickerOpen]   = useState(false);
  const [pickerSearch, setPickerSearch] = useState('');

  function toggle(id: string) {
    if (editingId === id) return; // don't collapse while editing
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function startEdit(row: Row) {
    setEditingId(row.id);
    setSaveError(null);
    setEditForm({
      objective:        row.description?.objective        ?? '',
      scope:            row.description?.scope            ?? '',
      rationale:        row.description?.rationale        ?? '',
      governanceImpact: row.description?.governanceImpact ?? '',
      affectedUnit:     row.description?.affectedUnit     ?? row.unitCode ?? '',
      relatedPolicies:  row.description?.relatedPolicies  ?? '',
      requiredEvidence: row.description?.requiredEvidence ?? '',
      risks:            row.description?.risks            ?? '',
    });
    setExpanded(prev => new Set(prev).add(row.id));
  }

  function cancelEdit() {
    setEditingId(null);
    setEditForm({});
    setSaveError(null);
  }

  async function saveEdit(orderId: string) {
    setSaving(true);
    setSaveError(null);
    try {
      // Convert empty strings to null so DB stores them as null (cleaner)
      const payload: Record<string, string | null> = {};
      for (const k of Object.keys(editForm)) {
        const v = editForm[k]?.trim() ?? '';
        payload[k] = v === '' ? null : v;
      }

      const res = await fetch(`/api/orders/${orderId}/description`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? `Save failed (HTTP ${res.status})`);
      }

      // Success — flash green check, close edit mode, refresh server data
      setEditingId(null);
      setEditForm({});
      setSavedFlash(orderId);
      setTimeout(() => setSavedFlash(null), 2000);
      router.refresh(); // re-fetch server-side data to show new content
    } catch (err: any) {
      setSaveError(err?.message ?? 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  // Apply filters
  const filtered = useMemo(() => {
    return rows.filter(r => {
      if (showOnlyFilled && !hasContent(r.description)) return false;
      if (unitFilter && r.unitCode !== unitFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const haystack = [
          r.orderCode, r.name, r.unitCode ?? '', r.projectCode ?? '',
          r.description?.objective ?? '',
          r.description?.scope ?? '',
          r.description?.rationale ?? '',
          r.description?.risks ?? '',
        ].join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, unitFilter, showOnlyFilled]);

  const filledCount = rows.filter(r => hasContent(r.description)).length;

  function exportCSV() {
    const headers = [
      'orderCode', 'name', 'status', 'unitCode', 'projectCode',
      'objective', 'scope', 'rationale', 'governanceImpact',
      'affectedUnit', 'relatedPolicies', 'requiredEvidence', 'risks',
      'lastEdited',
    ];
    const escape = (v: any) => {
      if (v == null) return '';
      const s = String(v).replace(/"/g, '""');
      return `"${s}"`;
    };
    const lines = [headers.join(',')];
    for (const r of filtered) {
      const d = r.description;
      lines.push([
        r.orderCode, r.name, r.status, r.unitCode ?? '', r.projectCode ?? '',
        d?.objective ?? '', d?.scope ?? '', d?.rationale ?? '', d?.governanceImpact ?? '',
        d?.affectedUnit ?? '', d?.relatedPolicies ?? '', d?.requiredEvidence ?? '', d?.risks ?? '',
        d?.updatedAt ?? '',
      ].map(escape).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const today = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `DET-Order-Descriptions-${today}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-5 max-w-7xl">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">Order Descriptions</h1>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1">
            {rows.length} total · {filledCount} with content · {filtered.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2 relative">
          <button
            onClick={() => { setPickerOpen(o => !o); setPickerSearch(''); }}
            className="pes-btn-primary text-[12.5px]"
            title="Add a description to an existing order that doesn't have one yet"
          >
            + Add Description
          </button>
          <button onClick={exportCSV} className="pes-btn-ghost text-[12.5px]">
            ⬇ Export CSV ({filtered.length})
          </button>

          {/* Picker dropdown */}
          {pickerOpen && (
            <div
              className="pes-card absolute right-0 top-full mt-2 w-[420px] max-h-[460px] overflow-hidden flex flex-col z-50 shadow-2xl"
              style={{ background: 'var(--surface-2)' }}
            >
              <div className="p-3 border-b border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-display font-bold text-[13px] text-[var(--text)]">
                    Pick an order
                  </h3>
                  <button
                    onClick={() => setPickerOpen(false)}
                    className="text-[var(--text-3)] hover:text-[var(--text)] text-base leading-none"
                  >
                    ✕
                  </button>
                </div>
                <p className="text-[11px] text-[var(--text-3)] mb-2">
                  Showing only orders without a description. Pick one to start writing.
                </p>
                <input
                  type="text"
                  placeholder="🔍 Search by code or name…"
                  value={pickerSearch}
                  onChange={e => setPickerSearch(e.target.value)}
                  autoFocus
                  className="pes-input w-full text-[12px]"
                />
              </div>
              <div className="flex-1 overflow-y-auto p-2">
                {(() => {
                  const empty = rows.filter(r => !hasContent(r.description));
                  const q = pickerSearch.toLowerCase().trim();
                  const matched = q
                    ? empty.filter(r =>
                        r.orderCode.toLowerCase().includes(q) ||
                        r.name.toLowerCase().includes(q) ||
                        (r.unitCode ?? '').toLowerCase().includes(q)
                      )
                    : empty;

                  if (empty.length === 0) {
                    return (
                      <div className="p-6 text-center text-[var(--text-3)] text-[12px]">
                        ✨ Every order already has a description.
                        <br /><br />
                        To add a new description, first create a new order
                        (sidebar → All Orders → + New Order), then come back here.
                      </div>
                    );
                  }

                  if (matched.length === 0) {
                    return (
                      <div className="p-6 text-center text-[var(--text-3)] text-[12px]">
                        No empty orders match &quot;{pickerSearch}&quot;.
                      </div>
                    );
                  }

                  return matched.map(r => (
                    <button
                      key={r.id}
                      onClick={() => {
                        startEdit(r);
                        setPickerOpen(false);
                        setPickerSearch('');
                        // scroll the row into view after a tick
                        setTimeout(() => {
                          const el = document.getElementById(`desc-row-${r.id}`);
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }, 100);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded hover:bg-[var(--surface-3)] text-left transition-colors"
                    >
                      <span className="font-display font-bold text-[12px] text-blue-400 min-w-[80px]">
                        {r.orderCode}
                      </span>
                      {r.unitCode && (
                        <span
                          className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                          style={{
                            background: `${r.unitColor ?? '#3b82f6'}20`,
                            color: r.unitColor ?? '#3b82f6',
                          }}
                        >
                          {r.unitCode}
                        </span>
                      )}
                      <span className="flex-1 text-[12.5px] text-[var(--text)] truncate">{r.name}</span>
                    </button>
                  ));
                })()}
              </div>
              <div className="p-2 border-t border-[var(--border)] text-[10.5px] text-[var(--text-3)] text-center">
                {rows.filter(r => !hasContent(r.description)).length} orders without descriptions
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="pes-card p-4 flex flex-wrap gap-3 items-center">
        <input
          type="text"
          placeholder="🔍 Search by code, name, content…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pes-input flex-1 min-w-[220px]"
        />
        <select value={unitFilter} onChange={e => setUnit(e.target.value)} className="pes-input min-w-[180px]">
          <option value="">All Units</option>
          {units.map(u => (
            <option key={u.code} value={u.code}>{u.code} — {u.name}</option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-[12.5px] text-[var(--text-2)] cursor-pointer">
          <input
            type="checkbox"
            checked={showOnlyFilled}
            onChange={e => setShowOnlyFilled(e.target.checked)}
            className="cursor-pointer"
          />
          Only with content
        </label>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="pes-card p-8 text-center text-[var(--text-3)] text-[13px]">
          No orders match these filters.
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(r => {
            const isOpen     = expanded.has(r.id) || editingId === r.id;
            const isEditing  = editingId === r.id;
            const filled     = hasContent(r.description);
            const justSaved  = savedFlash === r.id;

            return (
              <div key={r.id} id={`desc-row-${r.id}`} className="pes-card overflow-hidden">
                <button
                  type="button"
                  onClick={() => toggle(r.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-[var(--surface-2)] transition-colors text-left"
                >
                  <span className="text-[var(--text-3)] text-xs">{isOpen ? '▼' : '▶'}</span>
                  <span className="font-display font-bold text-[12px] text-blue-400 min-w-[80px]">
                    {r.orderCode}
                  </span>
                  {r.unitCode && (
                    <span
                      className="text-[10.5px] font-bold px-1.5 py-0.5 rounded"
                      style={{
                        borderLeft: `2px solid ${r.unitColor ?? '#3b82f6'}`,
                        background: `${r.unitColor ?? '#3b82f6'}18`,
                        color: r.unitColor ?? '#3b82f6',
                      }}
                    >
                      {r.unitCode}
                    </span>
                  )}
                  <span className="flex-1 text-[13.5px] text-[var(--text)] truncate">{r.name}</span>
                  {justSaved && (
                    <span className="text-[10.5px] text-emerald-400 bg-emerald-500/15 px-2 py-0.5 rounded animate-pulse">
                      ✓ Saved
                    </span>
                  )}
                  {!justSaved && !filled && (
                    <span className="text-[10.5px] text-[var(--text-3)] bg-[var(--surface-3)] px-2 py-0.5 rounded">
                      No description
                    </span>
                  )}
                  {!justSaved && filled && (
                    <span className="text-[10.5px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      ✓ Filled
                    </span>
                  )}
                </button>

                {isOpen && (
                  <div className="border-t border-[var(--border)] p-5 bg-[var(--surface)]/40 space-y-5">

                    {/* EDIT MODE — inline form */}
                    {isEditing ? (
                      <>
                        {FIELDS.map(({ key, label }) => (
                          <div key={key}>
                            <div className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--text)] mb-1.5 pb-1 border-b border-[var(--border)]">
                              {label}
                            </div>
                            <textarea
                              value={editForm[key] ?? ''}
                              onChange={e => setEditForm(f => ({ ...f, [key]: e.target.value }))}
                              rows={key === 'scope' || key === 'rationale' ? 5 : 2}
                              className="pes-input w-full text-[13px] leading-relaxed"
                              style={{ resize: 'vertical', minHeight: 40 }}
                              placeholder={`Enter ${label.toLowerCase()}…`}
                            />
                          </div>
                        ))}

                        {saveError && (
                          <div className="text-[12px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-3 py-2">
                            ⚠ {saveError}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--border)]/50">
                          <button
                            onClick={cancelEdit}
                            disabled={saving}
                            className="pes-btn-ghost text-xs"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => saveEdit(r.id)}
                            disabled={saving}
                            className="pes-btn-primary text-xs"
                          >
                            {saving ? 'Saving…' : '✓ Save'}
                          </button>
                        </div>
                      </>
                    ) : (
                      /* VIEW MODE */
                      <>
                        {!filled ? (
                          <div className="text-center py-4">
                            <p className="text-[12.5px] text-[var(--text-3)] mb-3">No description added yet.</p>
                            <button onClick={() => startEdit(r)} className="pes-btn-primary text-xs">
                              + Add Description
                            </button>
                          </div>
                        ) : (
                          <>
                            <Field label="Objective"          value={r.description?.objective} />
                            <Field label="Scope"              value={r.description?.scope} />
                            <Field label="Rationale"          value={r.description?.rationale} />
                            <Field label="Governance Impact"  value={r.description?.governanceImpact} />
                            <Field label="Affected Unit"      value={r.description?.affectedUnit} />
                            <Field label="Related Policies"   value={r.description?.relatedPolicies} />
                            <Field label="Required Evidence"  value={r.description?.requiredEvidence} />
                            <Field label="Risks / Flags"      value={r.description?.risks} />
                            <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]/50">
                              <span className="text-[11px] text-[var(--text-3)]">
                                Last edited: {r.description ? new Date(r.description.updatedAt).toLocaleDateString('en-GB') : '—'}
                              </span>
                              <div className="flex gap-2">
                                <button onClick={() => startEdit(r)} className="pes-btn-ghost text-xs">
                                  ✏ Edit
                                </button>
                                <Link href={`/orders/${r.id}`}>
                                  <button className="pes-btn-ghost text-xs">→ Open Order</button>
                                </Link>
                              </div>
                            </div>
                          </>
                        )}
                      </>
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

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <div className="text-[12px] font-extrabold uppercase tracking-wider text-[var(--text)] mb-1.5 pb-1 border-b border-[var(--border)]">
        {label}
      </div>
      <p className="text-[13px] text-[var(--text)] leading-relaxed whitespace-pre-wrap">{value}</p>
    </div>
  );
}

function hasContent(d: Description | null): boolean {
  if (!d) return false;
  return !!(d.objective || d.scope || d.rationale || d.governanceImpact || d.affectedUnit || d.relatedPolicies || d.requiredEvidence || d.risks);
}
