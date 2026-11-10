// src/lib/det/server.ts
// DET v2 server helpers: load orders in the shape the pages use.

import { prisma } from '@/lib/prisma/client';
import { bucketOf, type DetGov, type DetOrder, type DetProject, type GovItemStatus, type GovItemType, type GovScope, type SectionKey, type DbStatus, type GovStatus } from './shared';

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

export const DET_ORDER_SELECT = {
  id: true, orderCode: true, section: true, name: true, ownerName: true, status: true,
  percentComplete: true, startDate: true, dueDate: true, govStatus: true, govNote: true, govNoteAr: true, updatedAt: true,
  owner: { select: { name: true } },
  unit: { select: { code: true, name: true } },
  project: { select: { code: true, name: true } },
  description: { select: { bulletSummary: true, narrativeSummary: true, risks: true, nextSteps: true } },
} as const;

type Row = {
  id: string; orderCode: string; section: string; name: string; ownerName: string | null; status: string;
  percentComplete: number; startDate: Date | null; dueDate: Date | null; govStatus: string; govNote: string | null; govNoteAr: string | null; updatedAt: Date;
  owner: { name: string } | null; unit: { code: string; name: string } | null;
  project: { code: string; name: string } | null;
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
    projectCode: r.project?.code ?? null,
    projectName: r.project?.name ?? null,
    status,
    bucket: bucketOf(status),
    progress: r.percentComplete,
    start: iso(r.startDate),
    due: iso(r.dueDate),
    gov: r.govStatus as GovStatus,
    govNote: r.govNote ?? '',
    govNoteAr: r.govNoteAr ?? '',
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

/* ── Projects ─────────────────────────────────────────────────────────────── */

/** Projects of one section (or all), A to Z. */
export async function loadProjects(section?: SectionKey): Promise<DetProject[]> {
  const rows = await prisma.project.findMany({
    where: { isActive: true, ...(section ? { section } : {}) },
    select: { code: true, name: true, section: true },
    orderBy: { name: 'asc' },
  });
  return rows.map(r => ({ code: r.code, name: r.name, section: (r.section as SectionKey | null) ?? null }));
}

/** Find a project of the section by code or name; create it when the name is new.
 *  Returns the project id, or null for an empty value. */
export async function resolveProject(value: string | null | undefined, section: SectionKey, createdById?: string): Promise<string | null> {
  const v = (value ?? '').trim();
  if (!v) return null;
  const found = await prisma.project.findFirst({
    where: { OR: [{ code: v }, { name: { equals: v, mode: 'insensitive' } }] },
    select: { id: true, section: true },
  });
  if (found) {
    if (!found.section) await prisma.project.update({ where: { id: found.id }, data: { section } });
    return found.id;
  }
  const base = (v.match(/[A-Za-z0-9]+/g) ?? ['PRJ']).map(w => w[0]).join('').toUpperCase().slice(0, 6) || 'PRJ';
  let code = base;
  for (let i = 2; await prisma.project.findUnique({ where: { code }, select: { id: true } }); i++) code = `${base}${i}`;
  const p = await prisma.project.create({ data: { code, name: v, section, createdById: createdById ?? null }, select: { id: true } });
  return p.id;
}

/* ── Governance register ──────────────────────────────────────────────────── */

export const DET_GOV_SELECT = {
  id: true, code: true, scope: true, title: true, titleAr: true, type: true, status: true, ownerName: true,
  dueDate: true, lastReview: true, nextReview: true, evidenceLink: true, notes: true, notesAr: true, updatedAt: true,
  project: { select: { code: true, name: true, section: true } },
  unit: { select: { code: true, name: true } },
} as const;

type GovRow = {
  id: string; code: string; scope: string; title: string; titleAr: string | null; type: string; status: string; ownerName: string | null;
  dueDate: Date | null; lastReview: Date | null; nextReview: Date | null; evidenceLink: string | null; notes: string | null; notesAr: string | null; updatedAt: Date;
  project: { code: string; name: string; section: string | null } | null; unit: { code: string; name: string } | null;
};

export function toDetGov(r: GovRow): DetGov {
  return {
    id: r.id, code: r.code, scope: (r.scope === 'PROJECT' ? 'PROJECT' : 'UNIT') as GovScope,
    projectCode: r.project?.code ?? null, projectName: r.project?.name ?? null,
    projectSection: (r.project?.section as SectionKey | null) ?? null,
    unitCode: r.unit?.code ?? null, unitName: r.unit?.name ?? null,
    title: r.title, titleAr: r.titleAr ?? '', type: r.type as GovItemType, status: r.status as GovItemStatus, owner: r.ownerName ?? '',
    due: iso(r.dueDate), lastReview: iso(r.lastReview), nextReview: iso(r.nextReview),
    evidence: r.evidenceLink ?? '', notes: r.notes ?? '', notesAr: r.notesAr ?? '', updatedAt: r.updatedAt.toISOString(),
  };
}

export async function loadGovItems(): Promise<DetGov[]> {
  const rows = await prisma.detGovItem.findMany({
    where: { isDeleted: false }, select: DET_GOV_SELECT,
    orderBy: [{ scope: 'asc' }, { createdAt: 'asc' }],
  });
  return rows.map(r => toDetGov(r as unknown as GovRow));
}

/** Next governance code: GV-0001, GV-0002, ... */
export async function nextGovCode(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const seq = await prisma.sequence.upsert({
      where: { id: 'DET-GV' }, update: { current: { increment: 1 } }, create: { id: 'DET-GV', prefix: 'GV', padding: 4, current: 1 },
    });
    const code = `GV-${String(seq.current).padStart(4, '0')}`;
    if (!(await prisma.detGovItem.findUnique({ where: { code }, select: { id: true } }))) return code;
  }
  return `GV-${Date.now()}`;
}
