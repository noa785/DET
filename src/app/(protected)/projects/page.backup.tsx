// src/app/(protected)/projects/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Projects — DGCC PES' };

const PHASE_COLORS: Record<string, string> = {
  INITIATION: '#6b7280',
  PLANNING: '#3b82f6',
  EXECUTION: '#f59e0b',
  MONITORING: '#8b5cf6',
  CLOSURE: '#10b981',
};

export default async function ProjectsPage() {
  await requireAuth();

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    include: {
      unit: { select: { code: true, name: true, colorHex: true } },
      createdBy: { select: { name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">📂 Projects</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">
            {projects.length} active project{projects.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* Projects Grid */}
      {projects.length === 0 ? (
        <div className="pes-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-20">📂</div>
          <div className="text-lg text-[var(--text-3)] mb-2">No projects yet</div>
          <p className="text-sm text-[var(--text-3)]">Projects are created when you link orders to a project.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map(p => {
            const phaseColor = PHASE_COLORS[p.phase] ?? '#6b7280';
            return (
              <div key={p.id} className="pes-card p-5 hover:border-slate-600 transition group">
                {/* Project Code & Unit */}
                <div className="flex items-center justify-between mb-3">
                  <span className="font-mono text-xs text-blue-400 font-semibold">{p.code}</span>
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
                  <span>📋 {p._count.orders} order{p._count.orders !== 1 ? 's' : ''}</span>
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
