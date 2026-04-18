// src/app/(protected)/changes/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import Link from 'next/link';

export const metadata: Metadata = { title: 'Change Control — DGCC PES' };

const STATUS_C: Record<string, string> = {
  DRAFT: '#6b7280', PENDING_APPROVAL: '#f59e0b', APPROVED: '#3b82f6',
  IN_PROGRESS: '#8b5cf6', TESTING: '#06b6d4', RELEASED: '#10b981', REJECTED: '#ef4444',
};
const RISK_C: Record<string, string> = {
  LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444',
};

export default async function ChangesPage() {
  await requireAuth();

  const changes = await prisma.changeRequest.findMany({
    where: { isDeleted: false },
    include: {
      requestedBy: { select: { name: true } },
      approvedBy: { select: { name: true } },
      _count: { select: { govTasks: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });

  const stats = {
    total: changes.length,
    pending: changes.filter(c => c.status === 'PENDING_APPROVAL').length,
    inProgress: changes.filter(c => ['APPROVED','IN_PROGRESS','TESTING'].includes(c.status)).length,
    released: changes.filter(c => c.status === 'RELEASED').length,
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">🔄 Change Control</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{changes.length} change request{changes.length !== 1 ? 's' : ''}</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: '#3b82f6' },
          { label: 'Pending Approval', value: stats.pending, color: stats.pending > 0 ? '#f59e0b' : '#10b981' },
          { label: 'In Progress', value: stats.inProgress, color: '#8b5cf6' },
          { label: 'Released', value: stats.released, color: '#10b981' },
        ].map(s => (
          <div key={s.label} className="pes-card p-4">
            <div className="text-[10.5px] uppercase tracking-wider text-[var(--text-3)] mb-1">{s.label}</div>
            <div className="font-display font-bold text-2xl" style={{ color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {changes.length === 0 ? (
        <div className="pes-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-20">🔄</div>
          <div className="text-lg text-[var(--text-3)] mb-2">No change requests yet</div>
          <p className="text-sm text-[var(--text-3)]">Change requests track system and process changes with governance review.</p>
        </div>
      ) : (
        <div className="pes-card overflow-hidden overflow-x-auto">
          <table className="w-full text-[13px] border-collapse min-w-[900px]">
            <thead>
              <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
                {['Code','Title','Type','Status','Risk','Gov Review','Requested By','Release Date','Tasks'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {changes.map(c => {
                const sc = STATUS_C[c.status] ?? '#6b7280';
                const rc = RISK_C[c.riskLevel] ?? '#6b7280';
                return (
                  <tr key={c.id} className="border-b border-[var(--border)] hover:bg-[var(--surface-2)] transition-colors">
                    <td className="px-4 py-2.5">
                      <span className="font-mono text-[11.5px] text-cyan-400 font-semibold">{c.changeCode}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[var(--text)] max-w-[220px] truncate">{c.title}</td>
                    <td className="px-4 py-2.5 text-[11.5px] text-[var(--text-3)]">{c.type.replace(/_/g,' ')}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold px-2 py-0.5 rounded" style={{ background: `${sc}18`, color: sc }}>
                        {c.status.replace(/_/g,' ')}
                      </span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className="text-[11px] font-semibold" style={{ color: rc }}>● {c.riskLevel}</span>
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={`text-[11px] font-semibold ${
                        c.govReviewStatus === 'APPROVED' ? 'text-green-400' :
                        c.govReviewStatus === 'REJECTED' ? 'text-red-400' :
                        c.govReviewStatus === 'IN_REVIEW' ? 'text-amber-400' : 'text-[var(--text-3)]'
                      }`}>{c.govReviewStatus}</span>
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--text-2)]">{c.requestedBy?.name ?? '—'}</td>
                    <td className="px-4 py-2.5 text-[11.5px] text-[var(--text-2)]">
                      {c.plannedReleaseDate
                        ? new Date(c.plannedReleaseDate).toLocaleDateString('en-GB', {day:'2-digit', month:'short', year:'2-digit'})
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-[12px] text-[var(--text-2)]">{c._count.govTasks}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
