'use client';
// src/app/(protected)/projects/[id]/edit/EditProjectForm.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Unit {
  id: string;
  code: string;
  name: string;
}

interface ProjectData {
  id: string;
  code: string;
  name: string;
  unitId: string | null;
  phase: string;
  startDate: string;
  endDate: string;
  sponsor: string;
  description: string;
}

interface Props {
  units: Unit[];
  project: ProjectData;
}

const PHASES = ['INITIATION', 'PLANNING', 'EXECUTION', 'MONITORING', 'CLOSURE'] as const;

export default function EditProjectForm({ units, project }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: project.name,
    unitId: project.unitId ?? '',
    phase: project.phase as typeof PHASES[number],
    startDate: project.startDate,
    endDate: project.endDate,
    sponsor: project.sponsor,
    description: project.description,
  });

  function update<K extends keyof typeof form>(key: K, value: typeof form[K]) {
    setForm(prev => ({ ...prev, [key]: value }));
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!form.name.trim()) {
      setError('Name is required.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/projects/${project.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          unitId: form.unitId || null,
          phase: form.phase,
          startDate: form.startDate || null,
          endDate: form.endDate || null,
          sponsor: form.sponsor.trim() || null,
          description: form.description.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || data.issues?.[0]?.message || 'Failed to update project');
      }

      alert(`✓ Project "${project.code}" updated successfully.`);
      router.push('/projects');
      router.refresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-5" style={{ maxWidth: 720 }}>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">
            ✏️ Edit Project <span style={{ fontFamily: 'monospace', color: 'var(--text-3)', fontSize: 18 }}>{project.code}</span>
          </h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">Update project details. Changes are tracked in audit log.</p>
        </div>
        <Link href="/projects" className="pes-btn pes-btn-ghost" style={{ fontSize: 12 }}>
          ← Back
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="pes-card" style={{ padding: 20 }}>
        {error && (
          <div
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: 'var(--red, #ef4444)',
              padding: '10px 14px',
              borderRadius: 6,
              fontSize: 13,
              marginBottom: 16,
            }}
          >
            ⚠️ {error}
          </div>
        )}

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Project Name <span style={{ color: '#ef4444' }}>*</span></label>
          <input
            type="text"
            className="pes-input"
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            maxLength={200}
            required
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Unit</label>
            <select
              className="pes-input"
              value={form.unitId}
              onChange={(e) => update('unitId', e.target.value)}
            >
              <option value="">— None —</option>
              {units.map(u => (
                <option key={u.id} value={u.id}>{u.code} — {u.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Phase</label>
            <select
              className="pes-input"
              value={form.phase}
              onChange={(e) => update('phase', e.target.value as typeof PHASES[number])}
            >
              {PHASES.map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <label style={labelStyle}>Start Date</label>
            <input
              type="date"
              className="pes-input"
              value={form.startDate}
              onChange={(e) => update('startDate', e.target.value)}
            />
          </div>
          <div>
            <label style={labelStyle}>End Date</label>
            <input
              type="date"
              className="pes-input"
              value={form.endDate}
              onChange={(e) => update('endDate', e.target.value)}
            />
          </div>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={labelStyle}>Sponsor</label>
          <input
            type="text"
            className="pes-input"
            value={form.sponsor}
            onChange={(e) => update('sponsor', e.target.value)}
            maxLength={200}
          />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label style={labelStyle}>Description</label>
          <textarea
            className="pes-input"
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            maxLength={2000}
            rows={3}
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <Link href="/projects" className="pes-btn pes-btn-ghost" style={{ fontSize: 13 }}>
            Cancel
          </Link>
          <button
            type="submit"
            className="pes-btn pes-btn-primary"
            disabled={loading}
            style={{ fontSize: 13, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? 'Saving...' : '✓ Save Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--text-2, #cbd5e1)',
  marginBottom: 6,
};
