'use client';
// src/app/(protected)/orders/[id]/_components/RAIDTab.tsx

import { useState, useEffect } from 'react';

type RAIDItem = {
  id: string;
  category: string;
  title: string;
  description: string | null;
  severity: string;
  status: string;
  ownerId: string | null;
  owner: { id: string; name: string; initials: string } | null;
  dueDate: string | null;
  mitigationPlan: string | null;
  resolutionNote: string | null;
};

const CAT_COLORS: Record<string, string> = {
  RISK: 'bg-red-500/15 text-red-400',
  ASSUMPTION: 'bg-amber-500/15 text-amber-400',
  ISSUE: 'bg-orange-500/15 text-orange-400',
  DECISION: 'bg-blue-500/15 text-blue-400',
};

const CAT_ICONS: Record<string, string> = { RISK: '⚠️', ASSUMPTION: '💭', ISSUE: '🔥', DECISION: '✅' };

const SEV_COLORS: Record<string, string> = {
  LOW: 'text-green-400', MEDIUM: 'text-amber-400', HIGH: 'text-orange-400', CRITICAL: 'text-red-400',
};

const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-500/15 text-blue-400',
  MITIGATED: 'bg-green-500/15 text-green-400',
  CLOSED: 'bg-slate-500/15 text-[var(--text-2)]',
  ESCALATED: 'bg-red-500/15 text-red-400',
  ACCEPTED: 'bg-purple-500/15 text-purple-400',
};

export default function RAIDTab({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [items, setItems] = useState<RAIDItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('ALL');
  const [form, setForm] = useState({ category: 'RISK', title: '', description: '', severity: 'MEDIUM', status: 'OPEN', dueDate: '', mitigationPlan: '', resolutionNote: '' });

  useEffect(() => { fetchItems(); }, [orderId]);

  async function fetchItems() {
    setLoading(true);
    const res = await fetch(`/api/raid?orderId=${orderId}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }

  function resetForm() {
    setForm({ category: 'RISK', title: '', description: '', severity: 'MEDIUM', status: 'OPEN', dueDate: '', mitigationPlan: '', resolutionNote: '' });
    setShowForm(false);
    setEditingId(null);
  }

  function startEdit(item: RAIDItem) {
    setForm({
      category: item.category,
      title: item.title,
      description: item.description || '',
      severity: item.severity,
      status: item.status,
      dueDate: item.dueDate ? item.dueDate.split('T')[0] : '',
      mitigationPlan: item.mitigationPlan || '',
      resolutionNote: item.resolutionNote || '',
    });
    setEditingId(item.id);
    setShowForm(true);
  }

  async function handleSubmit() {
    const payload = {
      orderId,
      category: form.category,
      title: form.title,
      description: form.description || null,
      severity: form.severity,
      status: form.status,
      dueDate: form.dueDate || null,
      mitigationPlan: form.mitigationPlan || null,
      resolutionNote: form.resolutionNote || null,
    };

    if (editingId) {
      await fetch(`/api/raid/${editingId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    } else {
      await fetch('/api/raid', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    }
    resetForm();
    fetchItems();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this item?')) return;
    await fetch(`/api/raid/${id}`, { method: 'DELETE' });
    fetchItems();
  }

  const filtered = filter === 'ALL' ? items : items.filter(i => i.category === filter);
  const counts = { RISK: items.filter(i => i.category === 'RISK').length, ASSUMPTION: items.filter(i => i.category === 'ASSUMPTION').length, ISSUE: items.filter(i => i.category === 'ISSUE').length, DECISION: items.filter(i => i.category === 'DECISION').length };

  if (loading) return <div className="text-[var(--text-3)] text-sm p-4">Loading RAID items...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-[15px] text-[var(--text)]">RAID Register ({items.length})</h3>
        {canEdit && !showForm && (
          <button onClick={() => { resetForm(); setShowForm(true); }} className="pes-btn-primary text-xs py-1.5 px-3">+ Add Item</button>
        )}
      </div>

      {/* Category filter pills */}
      <div className="flex gap-2 flex-wrap">
        {['ALL', 'RISK', 'ASSUMPTION', 'ISSUE', 'DECISION'].map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`text-[11px] px-3 py-1.5 rounded-full font-semibold transition-colors ${filter === cat ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30' : 'bg-[#1a2236] text-[var(--text-2)] hover:text-[var(--text)]'}`}>
            {cat === 'ALL' ? `All (${items.length})` : `${CAT_ICONS[cat]} ${cat} (${counts[cat as keyof typeof counts]})`}
          </button>
        ))}
      </div>

      {showForm && (
        <div className="pes-card p-4 space-y-3 border border-blue-500/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="pes-label block mb-1">Category *</label>
              <select className="pes-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="RISK">Risk</option>
                <option value="ASSUMPTION">Assumption</option>
                <option value="ISSUE">Issue</option>
                <option value="DECISION">Decision</option>
              </select>
            </div>
            <div>
              <label className="pes-label block mb-1">Severity</label>
              <select className="pes-input" value={form.severity} onChange={e => setForm(f => ({ ...f, severity: e.target.value }))}>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Title *</label>
              <input className="pes-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Brief title" />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Description</label>
              <textarea className="pes-input" rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div>
              <label className="pes-label block mb-1">Status</label>
              <select className="pes-input" value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="OPEN">Open</option>
                <option value="MITIGATED">Mitigated</option>
                <option value="CLOSED">Closed</option>
                <option value="ESCALATED">Escalated</option>
                <option value="ACCEPTED">Accepted</option>
              </select>
            </div>
            <div>
              <label className="pes-label block mb-1">Due Date</label>
              <input type="date" className="pes-input" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Mitigation Plan</label>
              <textarea className="pes-input" rows={2} value={form.mitigationPlan} onChange={e => setForm(f => ({ ...f, mitigationPlan: e.target.value }))} />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">Resolution Note</label>
              <textarea className="pes-input" rows={2} value={form.resolutionNote} onChange={e => setForm(f => ({ ...f, resolutionNote: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={!form.title} className="pes-btn-primary text-xs py-1.5 px-4 disabled:opacity-50">{editingId ? 'Update' : 'Add'}</button>
            <button onClick={resetForm} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-3">Cancel</button>
          </div>
        </div>
      )}

      {filtered.length === 0 && !showForm ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-30">🛡</div>
          <div className="text-sm text-[var(--text-3)]">No RAID items yet</div>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="pes-card p-4">
              <div className="flex items-start gap-3">
                <span className="text-lg">{CAT_ICONS[item.category]}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${CAT_COLORS[item.category]}`}>{item.category}</span>
                    <span className="font-semibold text-[13px] text-[var(--text)]">{item.title}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${STATUS_COLORS[item.status]}`}>{item.status}</span>
                    <span className={`text-[10px] font-bold ${SEV_COLORS[item.severity]}`}>{item.severity}</span>
                  </div>
                  {item.description && <p className="text-xs text-[var(--text-2)] mb-1">{item.description}</p>}
                  {item.mitigationPlan && <p className="text-[11px] text-[var(--text-3)]"><span className="text-[var(--text-2)] font-medium">Mitigation:</span> {item.mitigationPlan}</p>}
                  {item.resolutionNote && <p className="text-[11px] text-[var(--text-3)]"><span className="text-[var(--text-2)] font-medium">Resolution:</span> {item.resolutionNote}</p>}
                  <div className="flex gap-3 text-[11px] text-[var(--text-3)] mt-1">
                    {item.owner && <span>Owner: {item.owner.name}</span>}
                    {item.dueDate && <span>Due: {new Date(item.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>}
                  </div>
                </div>
                {canEdit && (
                  <div className="flex gap-1 flex-shrink-0">
                    <button onClick={() => startEdit(item)} className="text-[11px] text-blue-400 hover:text-blue-300 px-2 py-1">Edit</button>
                    <button onClick={() => handleDelete(item.id)} className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1">Del</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
