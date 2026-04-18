// src/app/(protected)/audit-log/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma/client';

export const metadata: Metadata = { title: 'Audit Log — DGCC PES' };

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams: { module?: string; page?: string };
}) {
  const user = await requireAuth();
  if (!can(user, 'audit:view')) redirect('/dashboard');

  const page     = parseInt(searchParams.page ?? '1');
  const pageSize = 50;

  const where: any = {};
  if (searchParams.module) where.module = searchParams.module;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { name: true, initials: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  const ACTION_ICON: Record<string, string> = {
    CREATE:'➕', UPDATE:'✏️', DELETE:'🗑️', LOGIN:'🔐', LOGOUT:'🚪',
    STATUS_CHANGE:'🔄', EXPORT:'📤', IMPORT:'📥', APPROVE:'✅', REJECT:'❌',
  };

  const MODULES = ['orders','governance','change_requests','users','update_logs','order_descriptions'];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">🕵 Audit Log</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">{total} total entries — immutable record of all changes</p>
        </div>
        <select
          className="pes-input py-1.5 text-[13px] w-[160px]"
          defaultValue={searchParams.module ?? ''}
        >
          <option value="">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>
      </div>

      <div className="pes-card overflow-hidden">
        <table className="w-full text-[12.5px] border-collapse">
          <thead>
            <tr className="border-b border-[var(--border)] bg-[var(--surface)]">
              {['Time','User','Action','Module','Record','Field','Old → New','Notes'].map(h => (
                <th key={h} className="px-4 py-3 text-left text-[10.5px] font-semibold uppercase tracking-wider text-[var(--text-3)]">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {logs.map(log => (
              <tr key={log.id} className="border-b border-[var(--border)]/40 hover:bg-[var(--surface-2)]/40 transition-colors">
                <td className="px-4 py-2 whitespace-nowrap text-[var(--text-3)] text-[11px]">
                  {new Date(log.createdAt).toLocaleString('en-GB', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })}
                </td>
                <td className="px-4 py-2">
                  <span className="text-[var(--text-2)] text-[12px]">{log.user?.name ?? log.userName ?? 'System'}</span>
                </td>
                <td className="px-4 py-2 whitespace-nowrap">
                  <span className="text-[11px] flex items-center gap-1">
                    <span>{ACTION_ICON[log.action] ?? '📝'}</span>
                    <span className="text-[var(--text-2)]">{log.action.replace(/_/g,' ')}</span>
                  </span>
                </td>
                <td className="px-4 py-2 text-[11.5px] text-[var(--text-3)]">{log.module}</td>
                <td className="px-4 py-2 font-mono text-[11px] text-blue-400">{log.recordCode ?? log.recordId?.slice(0,8)}</td>
                <td className="px-4 py-2 text-[11.5px] text-[var(--text-3)]">{log.field ?? '—'}</td>
                <td className="px-4 py-2">
                  {log.field ? (
                    <span className="text-[11px]">
                      <span className="text-red-400 line-through mr-1">{log.oldValue ?? '—'}</span>
                      <span className="text-[var(--text-3)] mr-1">→</span>
                      <span className="text-green-400">{log.newValue ?? '—'}</span>
                    </span>
                  ) : <span className="text-[var(--text-3)]">—</span>}
                </td>
                <td className="px-4 py-2 text-[11.5px] text-[var(--text-3)] max-w-[200px] truncate">{log.notes ?? ''}</td>
              </tr>
            ))}
            {logs.length === 0 && (
              <tr><td colSpan={8} className="py-12 text-center text-[var(--text-3)]">No audit entries yet</td></tr>
            )}
          </tbody>
        </table>

        {total > pageSize && (
          <div className="px-5 py-3 border-t border-[var(--border)] flex justify-between items-center">
            <span className="text-[12px] text-[var(--text-3)]">Page {page} of {Math.ceil(total/pageSize)}</span>
          </div>
        )}
      </div>
    </div>
  );
}
