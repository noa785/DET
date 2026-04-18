// src/app/(protected)/admin/lookups/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';

export const metadata: Metadata = { title: 'Lookup Tables — DGCC PES' };

export default async function LookupsPage() {
  const user = await requireAuth();
  if (!can(user, 'admin:units')) redirect('/dashboard');

  const lookups = await prisma.lookupValue.findMany({
    orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
  });

  // Group by category
  const grouped: Record<string, typeof lookups> = {};
  for (const lv of lookups) {
    if (!grouped[lv.category]) grouped[lv.category] = [];
    grouped[lv.category].push(lv);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display font-bold text-2xl text-[var(--text)]">📚 Lookup Tables</h1>
        <p className="text-sm text-[var(--text-3)] mt-0.5">{lookups.length} values across {Object.keys(grouped).length} categories</p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="pes-card p-16 text-center">
          <div className="text-5xl mb-4 opacity-20">📚</div>
          <div className="text-lg text-[var(--text-3)] mb-2">No lookup values yet</div>
          <p className="text-sm text-[var(--text-3)]">Run the seed script to populate lookup tables.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(grouped).map(([category, values]) => (
            <div key={category} className="pes-card p-5">
              <h3 className="font-semibold text-[var(--text)] text-[14px] mb-3 flex items-center gap-2">
                <span className="text-blue-400 font-mono text-[12px]">{category}</span>
                <span className="text-[10px] text-[var(--text-3)] bg-slate-800 px-1.5 py-0.5 rounded">{values.length}</span>
              </h3>
              <div className="space-y-1.5">
                {values.map(v => (
                  <div key={v.id} className="flex items-center justify-between py-1.5 px-3 rounded bg-[var(--surface)] border border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <span className="text-[12px] text-[var(--text-2)]">{v.label}</span>
                      {v.isSystem && (
                        <span className="text-[9px] bg-blue-500/15 text-blue-400 px-1 py-0.5 rounded font-semibold">SYSTEM</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-mono text-[var(--text-3)]">{v.value}</span>
                      {!v.isActive && (
                        <span className="text-[9px] bg-red-500/15 text-red-400 px-1 py-0.5 rounded font-semibold">DISABLED</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
