'use client';
// src/app/(protected)/orders/[id]/_components/AttachmentsTab.tsx

import { useState, useEffect } from 'react';

type Attachment = {
  id: string;
  category: string;
  title: string;
  url: string;
  fileName: string | null;
  description: string | null;
  uploadedBy: { id: string; name: string; initials: string } | null;
  createdAt: string;
};

const CAT_ICONS: Record<string, string> = {
  POLICY: '📜', MINUTES: '📝', EVIDENCE: '🔍', APPROVAL: '✅', DELIVERABLE: '📦', REPORT: '📊', OTHER: '📎',
};

export default function AttachmentsTab({ orderId, canEdit }: { orderId: string; canEdit: boolean }) {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ category: 'OTHER', title: '', url: '', fileName: '', description: '' });

  useEffect(() => { fetchAttachments(); }, [orderId]);

  async function fetchAttachments() {
    setLoading(true);
    const res = await fetch(`/api/attachments?orderId=${orderId}`);
    if (res.ok) setAttachments(await res.json());
    setLoading(false);
  }

  async function handleSubmit() {
    await fetch('/api/attachments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId, ...form, fileName: form.fileName || null, description: form.description || null }),
    });
    setForm({ category: 'OTHER', title: '', url: '', fileName: '', description: '' });
    setShowForm(false);
    fetchAttachments();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this attachment?')) return;
    await fetch(`/api/attachments/${id}`, { method: 'DELETE' });
    fetchAttachments();
  }

  if (loading) return <div className="text-[var(--text-3)] text-sm p-4">Loading attachments...</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-bold text-[15px] text-[var(--text)]">Attachments & Evidence ({attachments.length})</h3>
        {canEdit && !showForm && (
          <button onClick={() => setShowForm(true)} className="pes-btn-primary text-xs py-1.5 px-3">+ Add Attachment</button>
        )}
      </div>

      {showForm && (
        <div className="pes-card p-4 space-y-3 border border-blue-500/20">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="pes-label block mb-1">Category</label>
              <select className="pes-input" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}>
                <option value="POLICY">Policy</option>
                <option value="MINUTES">Minutes</option>
                <option value="EVIDENCE">Evidence</option>
                <option value="APPROVAL">Approval</option>
                <option value="DELIVERABLE">Deliverable</option>
                <option value="REPORT">Report</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div>
              <label className="pes-label block mb-1">Title *</label>
              <input className="pes-input" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Attachment title" />
            </div>
            <div className="col-span-2">
              <label className="pes-label block mb-1">URL / Link *</label>
              <input className="pes-input" value={form.url} onChange={e => setForm(f => ({ ...f, url: e.target.value }))} placeholder="https://drive.google.com/..." />
            </div>
            <div>
              <label className="pes-label block mb-1">File Name</label>
              <input className="pes-input" value={form.fileName} onChange={e => setForm(f => ({ ...f, fileName: e.target.value }))} placeholder="report.pdf" />
            </div>
            <div>
              <label className="pes-label block mb-1">Description</label>
              <input className="pes-input" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <button onClick={handleSubmit} disabled={!form.title || !form.url} className="pes-btn-primary text-xs py-1.5 px-4 disabled:opacity-50">Add</button>
            <button onClick={() => setShowForm(false)} className="text-xs text-[var(--text-2)] hover:text-[var(--text)] px-3">Cancel</button>
          </div>
        </div>
      )}

      {attachments.length === 0 && !showForm ? (
        <div className="pes-card p-8 text-center">
          <div className="text-3xl mb-2 opacity-30">📎</div>
          <div className="text-sm text-[var(--text-3)]">No attachments yet</div>
        </div>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => (
            <div key={att.id} className="pes-card p-3 flex items-center gap-3">
              <span className="text-lg">{CAT_ICONS[att.category] || '📎'}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <a href={att.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-[13px] text-blue-400 hover:text-blue-300 hover:underline truncate">{att.title}</a>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-[#1a2236] text-[var(--text-2)]">{att.category}</span>
                </div>
                <div className="flex gap-3 text-[11px] text-[var(--text-3)] mt-0.5">
                  {att.fileName && <span>{att.fileName}</span>}
                  {att.uploadedBy && <span>by {att.uploadedBy.name}</span>}
                  <span>{new Date(att.createdAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}</span>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => handleDelete(att.id)} className="text-[11px] text-red-400 hover:text-red-300 px-2 py-1 flex-shrink-0">Del</button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
