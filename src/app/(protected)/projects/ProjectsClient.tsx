'use client';
// src/app/(protected)/projects/ProjectsClient.tsx

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const PHASE_COLORS: Record<string, string> = {
  INITIATION: '#6b7280',
  PLANNING: '#3b82f6',
  EXECUTION: '#f59e0b',
  MONITORING: '#8b5cf6',
  CLOSURE: '#10b981',
};

interface Project {
  id: string;
  code: string;
  name: string;
  description: string | null;
  phase: string;
  sponsor: string | null;
  startDate: string | null;
  endDate: string | null;
  unit: { code: string; name: string; colorHex: string | null } | null;
  createdBy: { name: string } | null;
  orderCount: number;
}

interface Props {
  projects: Project[];
  canManage: boolean;
}

export default function ProjectsClient({ projects, canManage }: Props) {
  const router = useRouter();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function handleDelete(project: Project) {
    setOpenMenuId(null);

    if (project.orderCount > 0) {
      alert(`⚠️ Cannot delete this project.\n\n${project.orderCount} order(s) are linked to it. Please reassign or delete them first.`);
      return;
    }

    if (!confirm(`⚠️ Delete project "${project.name}" (${project.code})?\n\nThis will hide the project but keep its history for audit purposes.`)) {
      return;
    }

    setDeleting(project.id);
    try {
      const res = await fetch(`/api/projects/${project.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Delete failed');
      alert(`✓ Project "${project.code}" deleted successfully.`);
      router.refresh();
    } catch (err: any) {
      alert(`Error: ${err.message}`);
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="space-y-5" onClick={() => setOpenMenuId(null)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">📂 Projects</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">
            {projects.length} active project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>

        {canManage && (
          <Link
            href="/projects/new"
            className="pes-btn pes-btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 13 }}
          >
            <span style={{ fontSize: 16, lineHeight: 1 }}>+</span>
            New Project
          </Link>
        )}
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="pes-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-20">📂</div>
          <div className="text-lg text-[var(--text-3)] mb-2">No projects yet</div>
          <p className="text-sm text-[var(--text-3)]">
            {canManage ? 'Click "+ New Project" to create one.' : 'Projects will appear here when created.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const phaseColor = PHASE_COLORS[p.phase] ?? '#6b7280';
            const isMenuOpen = openMenuId === p.id;
            const isDeleting = deleting === p.id;

            return (
              <div
                key={p.id}
                className="pes-card p-5 hover:border-slate-600 transition group relative"
                style={{ opacity: isDeleting ? 0.5 : 1 }}
              >
                {/* Header row: Code + Unit + Menu */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-blue-400 font-semibold">{p.code}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.unit && (
                      <span
                        className="text-[10px] font-semibold px-2 py-0.5 rounded"
                        style={{
                          background: p.unit.colorHex ? `${p.unit.colorHex}20` : '#3b82f620',
                          color: p.unit.colorHex || '#3b82f6',
                        }}
                      >
                        {p.unit.code}
                      </span>
                    )}

                    {/* Action menu (admin only) */}
                    {canManage && (
                      <div style={{ position: 'relative' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setOpenMenuId(isMenuOpen ? null : p.id);
                          }}
                          disabled={isDeleting}
                          style={{
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 6px',
                            color: 'var(--text-3)',
                            fontSize: 16,
                            lineHeight: 1,
                            borderRadius: 4,
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                          aria-label="Project actions"
                        >
                          ⋮
                        </button>

                        {isMenuOpen && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            style={{
                              position: 'absolute',
                              top: '100%',
                              right: 0,
                              marginTop: 4,
                              background: 'var(--bg-2, #1e293b)',
                              border: '1px solid var(--border)',
                              borderRadius: 6,
                              minWidth: 140,
                              zIndex: 10,
                              boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
                              overflow: 'hidden',
                            }}
                          >
                            <Link
                              href={`/projects/${p.id}/edit`}
                              style={{
                                display: 'block',
                                padding: '8px 12px',
                                fontSize: 12.5,
                                color: 'var(--text)',
                                textDecoration: 'none',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                              ✏️ Edit
                            </Link>
                            <button
                              onClick={() => handleDelete(p)}
                              style={{
                                display: 'block',
                                width: '100%',
                                textAlign: 'left',
                                padding: '8px 12px',
                                fontSize: 12.5,
                                color: 'var(--red, #ef4444)',
                                background: 'none',
                                border: 'none',
                                cursor: 'pointer',
                                borderTop: '1px solid var(--border)',
                              }}
                              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
                              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                            >
                              🗑️ Delete
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Name */}
                <h3 className="text-[var(--text)] font-semibold text-[15px] mb-2 line-clamp-2 group-hover:text-blue-300 transition">
                  {p.name}
                </h3>

                {/* Description */}
                {p.description && (
                  <p className="text-xs text-[var(--text-3)] mb-3 line-clamp-2">{p.description}</p>
                )}

                {/* Phase Badge */}
                <div className="flex items-center gap-3 mb-3">
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded"
                    style={{ background: `${phaseColor}18`, color: phaseColor }}
                  >
                    {p.phase.replace(/_/g, ' ')}
                  </span>
                  {p.sponsor && (
                    <span className="text-[10.5px] text-[var(--text-3)]">
                      Sponsor: {p.sponsor}
                    </span>
                  )}
                </div>

                {/* Stats Row */}
                <div className="flex items-center justify-between text-[11px] text-[var(--text-3)] pt-3 border-t border-[var(--border)]">
                  <span>📋 {p.orderCount} order{p.orderCount !== 1 ? 's' : ''}</span>
                  <span>
                    {p.startDate && p.endDate
                      ? `${new Date(p.startDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })} — ${new Date(p.endDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}`
                      : 'No dates set'}
                  </span>
                </div>

                {/* Created By */}
                {p.createdBy && (
                  <div className="text-[10px] text-[var(--text-3)] mt-2">
                    Created by {p.createdBy.name}
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
