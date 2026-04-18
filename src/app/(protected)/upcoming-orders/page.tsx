'use client';
// src/app/(protected)/upcoming-orders/page.tsx
import { useState, useEffect } from 'react';
import Link from 'next/link';

// ── Types ──────────────────────────────────────────────────────
interface SRF {
  id: string; refCode: string;
  unitName: string; contactName: string; contactEmail?: string; contactPhone?: string;
  serviceTypes?: string; helpTypes?: string;
  description: string; expectedOutput?: string; internalNotes?: string;
  priority: string; expectedStartDate?: string; deadline?: string;
  businessJustification?: string; dataClassification?: string; hasPersonalData: boolean;
  preferredDay?: string; preferredTime?: string;
  status: string;
  assignedTo?: { id: string; name: string } | null;
  linkedOrderId?: string;
  createdAt: string;
}

const SERVICE_OPTS = [
  'Combine data', 'Clean data', 'Check rules', 'Make a report',
  'Quality check', 'Schedule it', 'Improve what we have',
  'Save to shared library', 'Simple dashboard', 'Other',
];
const HELP_OPTS = [
  'Advice', 'Set up the process', 'Co-delivery',
  'Training', 'Quality & compliance check', 'Other',
];

const PRIO_COLOR: Record<string, string> = {
  URGENT: '#ef4444', HIGH: '#f59e0b', NORMAL: '#10b981',
};
const STATUS_COLOR: Record<string, string> = {
  PENDING: '#6b7280', APPROVED: '#3b82f6', IN_PROGRESS: '#f59e0b',
  DONE: '#10b981', REJECTED: '#ef4444',
};
const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Pending Review', APPROVED: 'Approved',
  IN_PROGRESS: 'In Progress', DONE: 'Done', REJECTED: 'Rejected',
};

export default function UpcomingOrdersPage() {
  const [items, setItems]       = useState<SRF[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<SRF | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [users, setUsers]       = useState<{ id: string; name: string }[]>([]);

  // Form state
  const empty = {
    unitName: '', contactName: '', contactEmail: '', contactPhone: '',
    serviceTypes: [] as string[], helpTypes: [] as string[],
    description: '', expectedOutput: '', internalNotes: '',
    priority: 'NORMAL', expectedStartDate: '', deadline: '',
    businessJustification: '', dataClassification: '',
    hasPersonalData: false, preferredDay: '', preferredTime: '',
    assignedToId: '',
  };
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);
  const [error, setError]   = useState('');

  useEffect(() => {
    fetchItems();
    fetch('/api/users').then(r => r.json()).then(d => setUsers(d.data ?? [])).catch(() => {});
  }, [statusFilter]);

  async function fetchItems() {
    setLoading(true);
    try {
      const url = statusFilter ? `/api/upcoming-orders?status=${statusFilter}` : '/api/upcoming-orders';
      const r = await fetch(url);
      const d = await r.json();
      setItems(d.data ?? []);
    } finally { setLoading(false); }
  }

  function openCreate() {
    setEditItem(null);
    setForm(empty);
    setError('');
    setShowForm(true);
  }

  function openEdit(item: SRF) {
    setEditItem(item);
    const st = item.serviceTypes ? JSON.parse(item.serviceTypes) : [];
    const ht = item.helpTypes    ? JSON.parse(item.helpTypes)    : [];
    setForm({
      unitName: item.unitName, contactName: item.contactName,
      contactEmail: item.contactEmail ?? '', contactPhone: item.contactPhone ?? '',
      serviceTypes: st, helpTypes: ht,
      description: item.description, expectedOutput: item.expectedOutput ?? '',
      internalNotes: item.internalNotes ?? '',
      priority: item.priority,
      expectedStartDate: item.expectedStartDate ? item.expectedStartDate.slice(0,10) : '',
      deadline: item.deadline ? item.deadline.slice(0,10) : '',
      businessJustification: item.businessJustification ?? '',
      dataClassification: item.dataClassification ?? '',
      hasPersonalData: item.hasPersonalData,
      preferredDay: item.preferredDay ?? '', preferredTime: item.preferredTime ?? '',
      assignedToId: item.assignedTo?.id ?? '',
    });
    setError('');
    setShowForm(true);
  }

  function toggleArr(arr: string[], val: string) {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  async function handleSave() {
    if (!form.unitName.trim() || !form.contactName.trim() || !form.description.trim()) {
      setError('Unit name, contact name, and description are required');
      return;
    }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        serviceTypes: JSON.stringify(form.serviceTypes),
        helpTypes:    JSON.stringify(form.helpTypes),
        assignedToId: form.assignedToId || null,
        contactEmail: form.contactEmail || null,
        contactPhone: form.contactPhone || null,
        expectedStartDate: form.expectedStartDate || null,
        deadline:     form.deadline || null,
        dataClassification: (form.dataClassification as any) || null,
      };
      const url    = editItem ? `/api/upcoming-orders/${editItem.id}` : '/api/upcoming-orders';
      const method = editItem ? 'PATCH' : 'POST';
      const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { const j = await r.json(); setError(j.error ?? 'Failed'); return; }
      setShowForm(false);
      fetchItems();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function updateStatus(id: string, status: string) {
    await fetch(`/api/upcoming-orders/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchItems();
  }

  async function convertToOrder(item: SRF) {
    // Pre-fill new order form with SRF data
    const params = new URLSearchParams({
      name: `[SRF] ${item.unitName} — ${item.description.slice(0, 60)}`,
      notes: `From SRF ${item.refCode}. Contact: ${item.contactName}${item.contactEmail ? ' (' + item.contactEmail + ')' : ''}.\n\n${item.description}`,
      priority: item.priority === 'URGENT' ? 'CRITICAL' : item.priority === 'HIGH' ? 'HIGH' : 'MEDIUM',
    });
    window.location.href = `/orders/new?${params.toString()}`;
  }

  const counts = {
    pending:    items.filter(i => i.status === 'PENDING').length,
    approved:   items.filter(i => i.status === 'APPROVED').length,
    inProgress: items.filter(i => i.status === 'IN_PROGRESS').length,
    done:       items.filter(i => i.status === 'DONE').length,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
            Upcoming Orders
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
            Service requests from stakeholders — review, assign, and convert to orders
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <a href="https://form.jotform.com/252510842524047" target="_blank" rel="noopener noreferrer">
            <button className="pes-btn pes-btn-ghost" style={{ fontSize: 12 }}>
              ↗ Open JotForm
            </button>
          </a>
          <button className="pes-btn pes-btn-primary" style={{ fontSize: 12 }} onClick={openCreate}>
            + New Request
          </button>
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {[
          { label: 'Pending Review', val: counts.pending,    color: '#6b7280', id: 'PENDING' },
          { label: 'Approved',       val: counts.approved,   color: '#3b82f6', id: 'APPROVED' },
          { label: 'In Progress',    val: counts.inProgress, color: '#f59e0b', id: 'IN_PROGRESS' },
          { label: 'Done',           val: counts.done,       color: '#10b981', id: 'DONE' },
        ].map(s => (
          <div key={s.id} className="pes-card" onClick={() => setStatusFilter(statusFilter === s.id ? '' : s.id)}
            style={{ padding: '16px 20px', cursor: 'pointer', borderTop: `2px solid ${s.color}`,
              background: statusFilter === s.id ? `${s.color}10` : 'var(--surface)' }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 800, color: s.color, marginTop: 4 }}>{s.val}</div>
          </div>
        ))}
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Filter:</span>
        {['', 'PENDING', 'APPROVED', 'IN_PROGRESS', 'DONE', 'REJECTED'].map(s => (
          <button key={s} onClick={() => setStatusFilter(s)}
            className="pes-btn pes-btn-ghost"
            style={{ fontSize: 11, padding: '4px 12px',
              background: statusFilter === s ? 'var(--accent)' : 'transparent',
              color: statusFilter === s ? '#fff' : 'var(--text-2)',
              borderColor: statusFilter === s ? 'var(--accent)' : 'var(--border-2)' }}>
            {s === '' ? 'All' : STATUS_LABEL[s] ?? s}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="pes-card" style={{ overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center', color: 'var(--text-3)' }}>Loading…</div>
        ) : items.length === 0 ? (
          <div style={{ padding: 64, textAlign: 'center' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.3 }}>📥</div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>No requests yet</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Add requests manually or share the JotForm link with stakeholders</div>
            <button className="pes-btn pes-btn-primary" style={{ fontSize: 12 }} onClick={openCreate}>+ New Request</button>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Ref', 'Unit / Contact', 'Description', 'Services', 'Priority', 'Expected Start', 'Status', 'Assigned To', ''].map(h => (
                    <th key={h} style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map(item => {
                  const services = item.serviceTypes ? JSON.parse(item.serviceTypes) : [];
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border)', transition: 'background 0.1s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>

                      {/* Ref */}
                      <td style={{ padding: '10px 14px', whiteSpace: 'nowrap' }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>{item.refCode}</span>
                      </td>

                      {/* Unit */}
                      <td style={{ padding: '10px 14px', minWidth: 160 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{item.unitName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.contactName}</div>
                        {item.contactEmail && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{item.contactEmail}</div>}
                      </td>

                      {/* Description */}
                      <td style={{ padding: '10px 14px', maxWidth: 240 }}>
                        <div style={{ fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {item.description}
                        </div>
                        {item.expectedOutput && (
                          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>Output: {item.expectedOutput}</div>
                        )}
                      </td>

                      {/* Services */}
                      <td style={{ padding: '10px 14px', minWidth: 160 }}>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3 }}>
                          {services.slice(0, 3).map((s: string) => (
                            <span key={s} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 99, background: 'rgba(var(--accent-rgb),0.1)', color: 'var(--accent)', whiteSpace: 'nowrap' }}>
                              {s}
                            </span>
                          ))}
                          {services.length > 3 && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>+{services.length - 3}</span>}
                        </div>
                      </td>

                      {/* Priority */}
                      <td style={{ padding: '10px 14px' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: PRIO_COLOR[item.priority] }}>
                          ● {item.priority}
                        </span>
                      </td>

                      {/* Expected Start */}
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-2)', whiteSpace: 'nowrap' }}>
                        {item.expectedStartDate ? new Date(item.expectedStartDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' }) : '—'}
                      </td>

                      {/* Status */}
                      <td style={{ padding: '10px 14px' }}>
                        <select
                          value={item.status}
                          onChange={e => updateStatus(item.id, e.target.value)}
                          style={{
                            fontSize: 11, fontWeight: 600, padding: '3px 8px', borderRadius: 99,
                            background: STATUS_COLOR[item.status] + '18',
                            color: STATUS_COLOR[item.status],
                            border: `1px solid ${STATUS_COLOR[item.status]}40`,
                            cursor: 'pointer', outline: 'none',
                          }}>
                          {Object.entries(STATUS_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </td>

                      {/* Assigned To */}
                      <td style={{ padding: '10px 14px', fontSize: 12, color: 'var(--text-2)' }}>
                        {item.assignedTo?.name ?? '—'}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: '10px 10px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => openEdit(item)}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'transparent', border: '1px solid var(--border-2)', color: 'var(--text-2)', cursor: 'pointer' }}>
                            Edit
                          </button>
                          {!item.linkedOrderId && item.status !== 'REJECTED' && (
                            <button onClick={() => convertToOrder(item)}
                              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.3)', color: 'var(--accent)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                              → Convert
                            </button>
                          )}
                          {item.linkedOrderId && (
                            <Link href={`/orders/${item.linkedOrderId}`}>
                              <span style={{ fontSize: 11, padding: '4px 10px', borderRadius: 6, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', cursor: 'pointer' }}>
                                ✓ Order
                              </span>
                            </Link>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── FORM MODAL ── */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 100, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '32px 16px', overflowY: 'auto' }}>
          <div style={{ background: 'var(--surface)', borderRadius: 12, border: '1px solid var(--border)', width: '100%', maxWidth: 680, padding: 28, display: 'flex', flexDirection: 'column', gap: 18 }}>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <h2 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', margin: 0 }}>
                {editItem ? `Edit ${editItem.refCode}` : 'New Service Request'}
              </h2>
              <button onClick={() => setShowForm(false)} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
            </div>

            {error && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: 8, padding: '8px 14px', fontSize: 13, color: 'var(--red)' }}>✕ {error}</div>}

            {/* Section: Requester */}
            <Divider label="A. Unit Information" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Department / Unit *">
                <input className="pes-input" value={form.unitName} onChange={e => setForm(f => ({ ...f, unitName: e.target.value }))} placeholder="e.g. ELI — Assessment Unit" style={{ fontSize: 12 }} />
              </Field>
              <Field label="Primary Contact *">
                <input className="pes-input" value={form.contactName} onChange={e => setForm(f => ({ ...f, contactName: e.target.value }))} placeholder="Full name" style={{ fontSize: 12 }} />
              </Field>
              <Field label="PNU Email">
                <input className="pes-input" type="email" value={form.contactEmail} onChange={e => setForm(f => ({ ...f, contactEmail: e.target.value }))} placeholder="unit@pnu.edu.sa" style={{ fontSize: 12 }} />
              </Field>
              <Field label="Phone">
                <input className="pes-input" value={form.contactPhone} onChange={e => setForm(f => ({ ...f, contactPhone: e.target.value }))} placeholder="05xxxxxxxx" style={{ fontSize: 12 }} />
              </Field>
            </div>

            {/* Section: Services */}
            <Divider label="B. What Do You Need?" />
            <Field label="Select services needed:">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {SERVICE_OPTS.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', padding: '4px 10px', borderRadius: 99, border: `1px solid ${form.serviceTypes.includes(s) ? 'var(--accent)' : 'var(--border-2)'}`, background: form.serviceTypes.includes(s) ? 'rgba(var(--accent-rgb),0.1)' : 'transparent', transition: 'all 0.1s' }}>
                    <input type="checkbox" checked={form.serviceTypes.includes(s)} onChange={() => setForm(f => ({ ...f, serviceTypes: toggleArr(f.serviceTypes, s) }))} style={{ display: 'none' }} />
                    {form.serviceTypes.includes(s) ? '✓ ' : ''}{s}
                  </label>
                ))}
              </div>
            </Field>
            <Field label="How should we help?">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {HELP_OPTS.map(s => (
                  <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', padding: '4px 10px', borderRadius: 99, border: `1px solid ${form.helpTypes.includes(s) ? '#8b5cf6' : 'var(--border-2)'}`, background: form.helpTypes.includes(s) ? 'rgba(139,92,246,0.1)' : 'transparent', transition: 'all 0.1s' }}>
                    <input type="checkbox" checked={form.helpTypes.includes(s)} onChange={() => setForm(f => ({ ...f, helpTypes: toggleArr(f.helpTypes, s) }))} style={{ display: 'none' }} />
                    {form.helpTypes.includes(s) ? '✓ ' : ''}{s}
                  </label>
                ))}
              </div>
            </Field>

            {/* Section: Request */}
            <Divider label="C. What's the Request?" />
            <Field label="Description *">
              <textarea className="pes-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="What do you need and why?" rows={3} style={{ fontSize: 12, resize: 'vertical' }} />
            </Field>
            <Field label="Expected Output">
              <input className="pes-input" value={form.expectedOutput} onChange={e => setForm(f => ({ ...f, expectedOutput: e.target.value }))} placeholder="e.g. Excel with summary sheet, PDF report…" style={{ fontSize: 12 }} />
            </Field>

            {/* Section: Priority */}
            <Divider label="D. Priority & Timeline" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
              <Field label="Priority *">
                <select className="pes-input" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={{ fontSize: 12 }}>
                  <option value="URGENT">🔴 Urgent (≤3 days)</option>
                  <option value="HIGH">🟡 High (3–5 days)</option>
                  <option value="NORMAL">🟢 Normal (≤4 weeks)</option>
                </select>
              </Field>
              <Field label="Expected Start Date">
                <input className="pes-input" type="date" value={form.expectedStartDate} onChange={e => setForm(f => ({ ...f, expectedStartDate: e.target.value }))} style={{ fontSize: 12 }} />
              </Field>
              <Field label="Deadline">
                <input className="pes-input" type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} style={{ fontSize: 12 }} />
              </Field>
            </div>
            <Field label="Why is it important?">
              <input className="pes-input" value={form.businessJustification} onChange={e => setForm(f => ({ ...f, businessJustification: e.target.value }))} placeholder="Exams / Accreditation / Compliance…" style={{ fontSize: 12 }} />
            </Field>

            {/* Section: Data */}
            <Divider label="E. Data & Confidentiality" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Data Classification">
                <select className="pes-input" value={form.dataClassification} onChange={e => setForm(f => ({ ...f, dataClassification: e.target.value }))} style={{ fontSize: 12 }}>
                  <option value="">Select…</option>
                  <option value="PUBLIC">Public</option>
                  <option value="INTERNAL">Internal</option>
                  <option value="CONFIDENTIAL">Confidential</option>
                </select>
              </Field>
              <Field label="Contains Personal Data?">
                <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
                  {[true, false].map(v => (
                    <label key={String(v)} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, cursor: 'pointer', color: 'var(--text-2)' }}>
                      <input type="radio" checked={form.hasPersonalData === v} onChange={() => setForm(f => ({ ...f, hasPersonalData: v }))} />
                      {v ? 'Yes' : 'No'}
                    </label>
                  ))}
                </div>
              </Field>
            </div>

            {/* Section: Kickoff */}
            <Divider label="F. Kickoff Meeting" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Preferred Day">
                <select className="pes-input" value={form.preferredDay} onChange={e => setForm(f => ({ ...f, preferredDay: e.target.value }))} style={{ fontSize: 12 }}>
                  <option value="">Select…</option>
                  {['Sunday','Monday','Tuesday','Wednesday','Thursday'].map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </Field>
              <Field label="Preferred Time">
                <select className="pes-input" value={form.preferredTime} onChange={e => setForm(f => ({ ...f, preferredTime: e.target.value }))} style={{ fontSize: 12 }}>
                  <option value="">Select…</option>
                  {['9:00-10:00','10:00-11:00','11:00-12:00','12:00-13:00','13:00-14:00'].map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>
            </div>

            {/* Section: Internal */}
            <Divider label="G. Internal (Staff Only)" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Assign To">
                <select className="pes-input" value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} style={{ fontSize: 12 }}>
                  <option value="">Unassigned</option>
                  {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <div />
            </div>
            <Field label="Internal Notes">
              <textarea className="pes-input" value={form.internalNotes} onChange={e => setForm(f => ({ ...f, internalNotes: e.target.value }))} placeholder="Notes visible to staff only…" rows={2} style={{ fontSize: 12, resize: 'vertical' }} />
            </Field>

            {/* Actions */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, paddingTop: 8, borderTop: '1px solid var(--border)' }}>
              <button onClick={() => setShowForm(false)} className="pes-btn pes-btn-ghost" style={{ fontSize: 13 }}>Cancel</button>
              <button onClick={handleSave} disabled={saving} className="pes-btn pes-btn-primary" style={{ fontSize: 13, opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Saving…' : editItem ? 'Save Changes' : 'Create Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{label}</div>
      <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', color: 'var(--text-3)' }}>{label}</label>
      {children}
    </div>
  );
}
