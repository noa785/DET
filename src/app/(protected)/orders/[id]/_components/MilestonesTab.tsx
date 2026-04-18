'use client';
// src/app/(protected)/orders/[id]/_components/MilestonesTab.tsx

import { useState, useEffect } from 'react';

type Milestone = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  plannedDate: string | null;
  actualDate: string | null;
  plannedPercent: number | null;
  actualPercent: number | null;
  varianceDays: number | null;
  note: string | null;
  sortOrder: number;
};

const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED: 'bg-slate-500/15 text-[var(--text-2)]',
  IN_PROGRESS: 'bg-blue-500/15 text-blue-400',
  COMPLETED: 'bg-green-500/15 text-green-400',
  DELAYED: 'bg-red-500/15 text-red-400',
  CANCELLED: 'bg-slate-500/15 text-[var(--text-3)]',
};

export default function MilestonesTab({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', description: '', status: 'NOT_STARTED', plannedDate: '', actualDate: '', plannedPercent: '', actualPercent: '', note: '' });

  useEffect(() => { fetchMilestones(); }, [orderId]);

  async function fetchMilestones() {
    setLoading(true);
    const res = await fetch(`/api/milestones?orderId=${orderId}`);
    if (res.ok) setMilestones(await res.json());
    setLoading(false);
  }

  function resetForm() {
    setForm({ title: '', description: '', status: 'NOT_STARTED', plannedDate: '', actualDate: '', plannedPercent: '', actualPercent: '', note: '' });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(m: Milestone) {
    setForm({
      title: m.title,
      description: m.description || '',
      status: m.status,
      plannedDate: m.plannedDate ? m.plannedDate.split('T')[0] : '',
      actualDate: m.actualDate ? m.actualDate.split('T')[0] : '',
      plannedPercent: m.plannedPercent?.toString() || '',
      actualPercent: m.actualPercent?.toString() || '',
      note: m.note || '',
    });
    setEditingId(m.id);
    setShowForm(true);
  }

  async function handleSubmit() {
    const payload = {
      orderId,
      title: form.title,
      description: form.description || null,
      status: form.status,
      plannedDate: form.plannedDate || null,
      actualDate: form.actualDate || null,
      plannedPercent: form.plannedPercent ? parseInt(form.plannedPercent) : null,
      actualPercent: form.actualPercent ? parseInt(form.actualPercent) : null,
      note: form.note || null,
    };

    if (editingId) {
      await fetch(`/api/milestones/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/milestones', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    resetForm();
    fetchMilestones();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this milestone?')) return;
    await fetch(`/api/milestones/${id}`, { method: 'DELETE' });
    fetchMilestones();
  }

  function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }

  if (loading) return <div className="text-[var(--text-3)] text-sm p-4">Loading milestones...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-[15px] text-[var(--text)]">Milestones ({milestones.length})</h3>
        {canEdit && !showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="pes-btn-primary text-xs py-1.5 px-3">+ Add Milestone</button>
        )}
      </div>

      {showForm && (
        <div className="pes-card p-4 space-y-3 border border-blue-500/20">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="pes-label block mb-1">Title *</label>
              <input className="pes-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Milestone title" />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Description</label>
              <textarea className="pes-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Optional details" />
            </div>
            <div>
              <label className="pes-label block mb-1">Status</label>
              <select className="pes-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="NOT_STARTED">Not Started</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
                <option value="DELAYED">Delayed</option>
                <option value="CANCELLED">Cancelled</option>
              </select>
            </div>
            <div>
              <label className="pes-label block mb-1">Planned Date</label>
              <input type="date" className="pes-input" value={form.plannedDate} onChange={e => setForm(f => ({ ...f, plannedDate: e.target.value }))} />
            </div>
            <div>
              <label className="pes-label block mb-1">Actual Date</label>
              <input type="date" className="pes-input" value={form.actualDate} onChange={e => setForm(f => ({ ...f, actualDate: e.target.value }))} />
            </div>
            <div>
              <label className="pes-label block mb-1">Planned %</label>
              <input type="number" className="pes-input" min="0" max="100" value={form.plannedPercent} onChange={e => setForm(f => ({ ...f, plannedPercent: e.target.value }))} />
            </div>
            <div>
              <label className="pes-label block mb-1">Actual %</label>
              <input type="number" className="pes-input" min="0" max="100" value={form.actualPercent} onChange={e => setForm(f => ({ ...f, actualPercent: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Note</label>
              <textarea className="pes-input" rows={2} value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={!form.title} className="pes-btn-primary text-xs py-1.5 px-4 disabled:opacity-50">{editingId ? 'Update' : 'Add'}</button>
            <button onClick={resetForm} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-3">Cancel</button>
          </div>
        </div>
      )}

      {milestones.length === 0 && !showForm ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-30">📍</div>
          <div className="text-sm text-[var(--text-3)]">No milestones yet</div>
        </div>
      ) : (
        <div className="space-y-2">
          {milestones.map((m, i) => (
            <div key={m.id} className="pes-card p-4 flex items-start gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-[#1a2236] flex items-center justify-center text-xs font-bold text-[var(--text-2)]">{i + 1}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-[13px] text-[var(--text)]">{m.title}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[m.status] || ''}`}>
                    {m.status.replace(/_/g, ' ')}
                  </span>
                </div>
                {m.description && <p className="text-xs text-[var(--text-2)] mb-2">{m.description}</p>}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-[var(--text-3)]">
                  <span>Planned: {fmtDate(m.plannedDate)}</span>
                  <span>Actual: {fmtDate(m.actualDate)}</span>
                  {m.plannedPercent != null && <span>Plan: {m.plannedPercent}%</span>}
                  {m.actualPercent != null && <span>Actual: {m.actualPercent}%</span>}
                  {m.varianceDays != null && (
                    <span className={m.varianceDays > 0 ? 'text-red-400' : 'text-green-400'}>
                      Variance: {m.varianceDays > 0 ? '+' : ''}{m.varianceDays}d
                    </span>
                  )}
                </div>
                {m.note && <p className="text-[11px] text-[var(--text-3)] mt-1 italic">{m.note}</p>}
              </div>
              {canEdit && (
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => startEdit(m)} className="text-[11px] text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                  <button onClick={() => handleDelete(m.id)} className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1">Del</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
