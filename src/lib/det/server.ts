// src/lib/det/server.ts
// DET v2 server helpers: load orders in the shape the pages use.

import { prisma } from '@/lib/prisma/client';
import { bucketOf, type DetOrder, type SectionKey, type DbStatus, type GovStatus } from './shared';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export const DET_ORDER_SELECT = {
  id: true, orderCode: true, section: true, name: true, ownerName: true, status: true,
  percentComplete: true, startDate: true, dueDate: true, govStatus: true, govNote: true, updatedAt: true,
  owner: { select: { name: true } },
  unit: { select: { code: true, name: true } },
  description: { select: { bulletSummary: true, narrativeSummary: true, risks: true, nextSteps: true } },
} as const;

type Row = {
  id: string; orderCode: string; section: string; name: string; ownerName: string | null; status: string;
  percentComplete: number; startDate: Date | null; dueDate: Date | null; govStatus: string; govNote: string | null; updatedAt: Date;
  owner: { name: string } | null; unit: { code: string; name: string } | null;
  description: { bulletSummary: string | null; narrativeSummary: string | null; risks: string | null; nextSteps: string | null } | null;
};

export function toDetOrder(r: Row): DetOrder {
  const status = r.status as DbStatus;
  return {
    id: r.id,
    code: r.orderCode,
    section: r.section as SectionKey,
    name: r.name,
    owner: r.ownerName || r.owner?.name || 'Unassigned',
    unitCode: r.unit?.code ?? null,
    unitName: r.unit?.name ?? null,
    status,
    bucket: bucketOf(status),
    progress: r.percentComplete,
    start: iso(r.startDate),
    due: iso(r.dueDate),
    gov: r.govStatus as GovStatus,
    govNote: r.govNote ?? '',
    points: (r.description?.bulletSummary ?? '').split('\n').map(s => s.trim()).filter(Boolean),
    narrative: r.description?.narrativeSummary ?? '',
    risks: r.description?.risks ?? '',
    nextSteps: r.description?.nextSteps ?? '',
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** All live orders, optionally for one section, in the tracker Excel's row order.
 *  Orders added in the system (no Excel row) follow, oldest first. Cancelled orders are left out. */
export async function loadOrders(section?: SectionKey): Promise<DetOrder[]> {
  const rows = await prisma.order.findMany({
    where: { isDeleted: false, status: { not: 'CANCELLED' }, ...(section ? { section } : {}) },
    select: DET_ORDER_SELECT,
    orderBy: [{ sheetOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { orderCode: 'asc' }],
  });
  return rows.map(r => toDetOrder(r as unknown as Row));
}

/** Names already used as "Responsible", for quick suggestions in forms. */
export async function loadOwnerSuggestions(): Promise<string[]> {
  const [named, users] = await Promise.all([
    prisma.order.findMany({ where: { isDeleted: false, ownerName: { not: null } }, select: { ownerName: true }, distinct: ['ownerName'] }),
    prisma.user.findMany({ where: { isActive: true }, select: { name: true } }),
  ]);
  const all = new Set<string>();
  named.forEach(n => n.ownerName && all.add(n.ownerName));
  users.forEach(u => all.add(u.name));
  return [...all].sort((a, b) => a.localeCompare(b));
}

/** ELI departments, units and committees (from the units list). */
export async function loadUnits(): Promise<import('./shared').DetUnit[]> {
  return prisma.unit.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { name: 'asc' } });
}

/** Next code for a new order in a section: SE-0001, AU-0001, ... */
export async function nextOrderCode(section: SectionKey): Promise<string> {
  const prefix = section === 'AUTOMATION' ? 'AU' : 'SE';
  const id = `DET-${prefix}`;
  for (let i = 0; i < 5; i++) {
    const seq = await prisma.sequence.upsert({
      where: { id },
      update: { current: { increment: 1 } },
      create: { id, prefix, padding: 4, current: 1 },
    });
    const code = `${prefix}-${String(seq.current).padStart(4, '0')}`;
    const taken = await prisma.order.findUnique({ where: { orderCode: code }, select: { id: true } });
    if (!taken) return code;
  }
  return `${prefix}-${Date.now()}`;
}

/** Systems from the register, with how many of their orders are done. */
export async function loadSystems(): Promise<import('./shared').DetSystem[]> {
  const projects = await prisma.project.findMany({
    where: { isSystem: true, isActive: true },
    select: { id: true, code: true, name: true, description: true, systemType: true, systemStatus: true, includeInKpi: true, link: true, unit: { select: { code: true } } },
    orderBy: { code: 'asc' },
  });
  const [all, done] = await Promise.all([
    prisma.order.groupBy({ by: ['projectId'], where: { isDeleted: false, status: { not: 'CANCELLED' }, projectId: { in: projects.map(p => p.id) } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ['projectId'], where: { isDeleted: false, status: 'DONE', projectId: { in: projects.map(p => p.id) } }, _count: { _all: true } }),
  ]);
  const n = new Map(all.map(g => [g.projectId, g._count._all]));
  const d = new Map(done.map(g => [g.projectId, g._count._all]));
  const order = { LIVE: 0, PILOT: 1, IN_DEVELOPMENT: 2, PLANNED: 3 } as Record<string, number>;
  return projects.map(p => ({
    code: p.code,
    name: p.name,
    type: p.systemType === 'ACADEMIC' ? 'ACADEMIC' as const : 'ADMINISTRATIVE' as const,
    unitCode: p.unit?.code ?? null,
    status: (['LIVE', 'PILOT', 'IN_DEVELOPMENT', 'PLANNED'].includes(p.systemStatus ?? '') ? p.systemStatus : 'PLANNED') as import('./shared').SystemStatus,
    summary: p.description ?? '',
    link: p.link,
    includeInKpi: p.includeInKpi,
    orders: n.get(p.id) ?? 0,
    done: d.get(p.id) ?? 0,
  })).sort((a, b) => order[a.status] - order[b.status] || a.name.localeCompare(b.name));
}
