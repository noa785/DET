'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Brief {
  id: string;
  briefCode: string;
  title: string;
  status: string;
  weekStart: string | null;
  weekEnd: string | null;
  content: any;
  publishedAt: string | null;
  createdAt: string;
  unit: { code: string; name: string; colorHex: string | null } | null;
  preparedBy: { name: string } | null;
}

interface Props {
  briefs: Brief[];
  units: { id: string; code: string; name: string }[];
  orders: { id: string; orderCode: string; name: string; status: string }[];
}

const STATUS_C: Record<string, string> = {
  DRAFT: '#6b7280', UNDER_REVIEW: '#f59e0b', APPROVED: '#3b82f6',
  PUBLISHED: '#10b981', ARCHIVED: '#374151',
};

export default function WeeklyBriefsClient({ briefs: initial, units, orders }: Props) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  // Form
  const [title, setTitle] = useState('');
  const [unitId, setUnitId] = useState('');
  const [weekStart, setWeekStart] = useState('');
  const [weekEnd, setWeekEnd] = useState('');
  const [narrative, setNarrative] = useState('');
  const [bullets, setBullets] = useState('');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [orderSearch, setOrderSearch] = useState('');
  const [briefStatus, setBriefStatus] = useState('DRAFT');

  function reset() {
    setTitle(''); setUnitId(''); setWeekStart(''); setWeekEnd('');
    setNarrative(''); setBullets(''); setSelectedOrders([]); setOrderSearch('');
    setError(''); setEditingId(null); setBriefStatus('DRAFT');
  }

  function openCreate() {
    reset();
    setShowForm(true);
  }

  function openEdit(b: Brief) {
    setEditingId(b.id);
    setTitle(b.title);
    setUnitId(b.unit ? units.find(u => u.code === b.unit!.code)?.id || '' : '');
    setWeekStart(b.weekStart ? b.weekStart.split('T')[0] : '');
    setWeekEnd(b.weekEnd ? b.weekEnd.split('T')[0] : '');
    setBriefStatus(b.status);
    const content = b.content as any;
    setNarrative(content?.narrative || '');
    setBullets(Array.isArray(content?.bullets) ? content.bullets.join('\n') : '');
    setSelectedOrders(content?.orderIds || []);
    setOrderSearch('');
    setError('');
    setShowForm(true);
  }

  function autoTitle() {
    if (!weekStart) return;
    const d = new Date(weekStart);
    const wk = Math.ceil(((d.getTime() - new Date(d.getFullYear(), 0, 1).getTime()) / 86400000 + 1) / 7);
    const uc = unitId ? units.find(u => u.id === unitId)?.code : 'DGCC';
    setTitle(`${uc} - Week ${wk}, ${d.getFullYear()}`);
  }

  function toggleOrder(id: string) {
    setSelectedOrders(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  const filteredOrders = orders.filter(o =>
    !orderSearch || o.orderCode.toLowerCase().includes(orderSearch.toLowerCase()) || o.name.toLowerCase().includes(orderSearch.toLowerCase())
  ).slice(0, 20);

  async function handleSave() {
    if (!title.trim()) { setError('Title is required'); return; }
    setSaving(true); setError('');
    try {
      const payload = { title, unitId: unitId || null, weekStart, weekEnd, narrative, bullets, orderIds: selectedOrders, status: briefStatus };

      const url = editingId ? `/api/weekly-briefs/${editingId}` : '/api/weekly-briefs';
      const method = editingId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Failed'); return; }
      reset(); setShowForm(false); router.refresh();
    } catch (e: any) { setError(e.message); }
    finally { setSaving(false); }
  }

  async function handleDelete(id: string, code: string) {
    if (!confirm(`Delete ${code}? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/weekly-briefs/${id}`, { method: 'DELETE' });
      if (!res.ok) { alert('Failed to delete'); return; }
      router.refresh();
    } catch { alert('Failed to delete'); }
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">Weekly Briefs</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{initial.length} brief{initial.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={openCreate} className="pes-btn-primary text-[13px]">+ New Brief</button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 flex items-start justify-center pt-10 z-50 overflow-y-auto">
          <div className="pes-card p-6 w-full max-w-xl mx-4 mb-10 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-bold text-[17px] text-[var(--text)]">
                {editingId ? 'Edit Brief' : 'New Weekly Brief'}
              </h2>
              <button onClick={() => { setShowForm(false); reset(); }} className="text-[var(--text-3)] hover:text-[var(--text)] text-xl">&times;</button>
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-red-400 text-[13px]">{error}</div>}

            {/* Week */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pes-label">Week Start</label>
                <input type="date" value={weekStart}
                  onChange={e => { setWeekStart(e.target.value); if (e.target.value && !weekEnd) { const d = new Date(e.target.value); d.setDate(d.getDate() + 4); setWeekEnd(d.toISOString().split('T')[0]); }}}
                  className="pes-input w-full mt-1 text-[13px]" />
              </div>
              <div>
                <label className="pes-label">Week End</label>
                <input type="date" value={weekEnd} onChange={e => setWeekEnd(e.target.value)} className="pes-input w-full mt-1 text-[13px]" />
              </div>
            </div>

            {/* Unit + Status */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="pes-label">Unit</label>
                <select value={unitId} onChange={e => setUnitId(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
                  <option value="">DGCC (All)</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.code} - {u.name}</option>)}
                </select>
              </div>
              {editingId ? (
                <div>
                  <label className="pes-label">Status</label>
                  <select value={briefStatus} onChange={e => setBriefStatus(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
                    {['DRAFT', 'UNDER_REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED'].map(s => (
                      <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="flex items-end">
                  <button type="button" onClick={autoTitle} className="pes-btn-ghost text-[12px]" disabled={!weekStart}>Auto Title</button>
                </div>
              )}
            </div>

            {/* Title */}
            <div>
              <label className="pes-label">Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. DGCC - Week 8, 2026" className="pes-input w-full mt-1 text-[13px]" />
            </div>

            {/* Narrative */}
            <div>
              <label className="pes-label">Narrative Summary</label>
              <textarea value={narrative} onChange={e => setNarrative(e.target.value)} rows={4}
                placeholder="Write a brief summary of the week's progress..."
                className="pes-input w-full mt-1 text-[12.5px]" />
            </div>

            {/* Bullets */}
            <div>
              <label className="pes-label">Key Points (one per line)</label>
              <textarea value={bullets} onChange={e => setBullets(e.target.value)} rows={4}
                placeholder="Completed policy review&#10;Budget approved for Q2&#10;New hiring plan finalized"
                className="pes-input w-full mt-1 text-[12.5px]" />
            </div>

            {/* Linked Orders */}
            <div>
              <label className="pes-label">Linked Orders / Tasks</label>
              <input value={orderSearch} onChange={e => setOrderSearch(e.target.value)}
                placeholder="Search orders by code or name..."
                className="pes-input w-full mt-1 text-[12.5px] mb-2" />

              {selectedOrders.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {selectedOrders.map(id => {
                    const o = orders.find(x => x.id === id);
                    return o ? (
                      <span key={id} className="inline-flex items-center gap-1 bg-blue-500/15 text-blue-400 text-[11px] px-2 py-0.5 rounded">
                        {o.orderCode}
                        <button onClick={() => toggleOrder(id)} className="hover:text-red-400">&times;</button>
                      </span>
                    ) : null;
                  })}
                </div>
              )}

              {orderSearch && (
                <div className="max-h-36 overflow-y-auto border border-[var(--border)] rounded-lg">
                  {filteredOrders.map(o => (
                    <button key={o.id} type="button" onClick={() => { toggleOrder(o.id); setOrderSearch(''); }}
                      className={'w-full text-left px-3 py-1.5 text-[12px] hover:bg-[#1f2d45] flex items-center gap-2 ' + (selectedOrders.includes(o.id) ? 'bg-blue-500/10 text-blue-400' : 'text-[var(--text-2)]')}>
                      <span className="font-mono text-[10.5px] text-[var(--text-3)] w-20">{o.orderCode}</span>
                      <span className="truncate">{o.name}</span>
                    </button>
                  ))}
                  {filteredOrders.length === 0 && <div className="px-3 py-2 text-[12px] text-[var(--text-3)]">No orders found</div>}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-3 border-t border-[var(--border)]">
              <button onClick={() => { setShowForm(false); reset(); }} className="pes-btn-ghost text-[13px]">Cancel</button>
              <button onClick={handleSave} disabled={saving} className="pes-btn-primary text-[13px]">
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Brief'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Briefs List */}
      {initial.length === 0 ? (
        <div className="pes-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-20">📰</div>
          <div className="text-lg text-[var(--text-3)] mb-2">No weekly briefs yet</div>
          <button onClick={openCreate} className="pes-btn-primary text-[13px] mt-3">+ Create First Brief</button>
        </div>
      ) : (
        <div className="space-y-3">
          {initial.map(b => {
            const sc = STATUS_C[b.status] ?? '#6b7280';
            const content = b.content as any;
            const isOpen = expanded === b.id;
            const linkedOrders = content?.orderIds?.length ? orders.filter(o => content.orderIds.includes(o.id)) : [];

            return (
              <div key={b.id} className="pes-card overflow-hidden">
                {/* Header row */}
                <button onClick={() => setExpanded(isOpen ? null : b.id)}
                  className="w-full flex items-center gap-4 px-5 py-3.5 hover:bg-[var(--surface-2)] transition text-left">
                  <span className="font-mono text-[11.5px] text-blue-400 font-semibold w-20">{b.briefCode}</span>
                  <span className="text-[13px] text-[var(--text)] flex-1 truncate">{b.title}</span>
                  {b.unit && (
                    <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                      style={{ background: (b.unit.colorHex || '#3b82f6') + '20', color: b.unit.colorHex || '#3b82f6' }}>
                      {b.unit.code}
                    </span>
                  )}
                  <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded" style={{ background: sc + '18', color: sc }}>
                    {b.status.replace(/_/g, ' ')}
                  </span>
                  <span className="text-[11px] text-[var(--text-3)] w-32 text-right">
                    {b.weekStart && b.weekEnd
                      ? new Date(b.weekStart).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) + ' - ' + new Date(b.weekEnd).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
                      : '—'}
                  </span>
                  <span className="text-[var(--text-3)] text-[13px]">{isOpen ? '▲' : '▼'}</span>
                </button>

                {/* Expanded content */}
                {isOpen && (
                  <div className="px-5 pb-4 pt-1 border-t border-[var(--border)] space-y-3">
                    {/* Narrative */}
                    {content?.narrative && (
                      <div>
                        <div className="text-[10.5px] text-[var(--text-3)] uppercase tracking-wider font-semibold mb-1">Narrative</div>
                        <p className="text-[13px] text-[var(--text-2)] leading-relaxed whitespace-pre-wrap">{content.narrative}</p>
                      </div>
                    )}

                    {/* Bullets */}
                    {content?.bullets?.length > 0 && (
                      <div>
                        <div className="text-[10.5px] text-[var(--text-3)] uppercase tracking-wider font-semibold mb-1">Key Points</div>
                        <ul className="space-y-1">
                          {content.bullets.map((item: string, i: number) => (
                            <li key={i} className="text-[12.5px] text-[var(--text-2)] flex items-start gap-2">
                              <span className="text-blue-500 mt-0.5">•</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Linked Orders */}
                    {linkedOrders.length > 0 && (
                      <div>
                        <div className="text-[10.5px] text-[var(--text-3)] uppercase tracking-wider font-semibold mb-1">Linked Orders</div>
                        <div className="flex flex-wrap gap-1.5">
                          {linkedOrders.map(o => (
                            <span key={o.id} className="inline-flex items-center gap-1.5 bg-[#1a2332] border border-[var(--border)] text-[11px] px-2.5 py-1 rounded">
                              <span className="font-mono text-blue-400">{o.orderCode}</span>
                              <span className="text-[var(--text-2)]">{o.name}</span>
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Meta + Actions */}
                    <div className="flex items-center justify-between pt-2 border-t border-[var(--border)]">
                      <span className="text-[11px] text-[var(--text-3)]">
                        Prepared by {b.preparedBy?.name ?? '—'} · {new Date(b.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      <div className="flex items-center gap-2">
                        <button onClick={() => openEdit(b)} className="text-[11.5px] text-blue-400 hover:text-blue-300">Edit</button>
                        <button onClick={() => handleDelete(b.id, b.briefCode)} className="text-[11.5px] text-red-400 hover:text-red-300">Delete</button>
                      </div>
                    </div>
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
