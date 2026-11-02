// src/lib/det/govwrite.ts
// Create or update one governance register item. Used by the Governance page and by the Google Sheets sync.

import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { DET_GOV_SELECT, nextGovCode, toDetGov } from './server';
import { GOV_ITEM_STATUS_KEYS, GOV_ITEM_TYPE_KEYS, type DetGov } from './shared';

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional();

export const GovInput = z.object({
  scope:      z.enum(['PROJECT', 'UNIT']),
  target:     z.string().trim().max(200).optional().nullable(),     // project or unit: code or name
  title:      z.string().trim().min(1, 'Please write the governance item').max(500),
  type:       z.enum(GOV_ITEM_TYPE_KEYS as [string, ...string[]]).optional().default('OTHER'),
  status:     z.enum(GOV_ITEM_STATUS_KEYS as [string, ...string[]]).optional().default('PLANNED'),
  owner:      z.string().trim().max(200).optional().nullable(),
  due:        day,
  lastReview: day,
  nextReview: day,
  evidence:   z.string().trim().max(1000).optional().nullable(),
  notes:      z.string().trim().max(10000).optional().nullable(),
});
export type GovInputT = z.infer<typeof GovInput>;

const toDate = (d: string | null | undefined) => (d ? new Date(`${d}T00:00:00Z`) : null);

/** Find the project or unit the item is about. Returns an error message when the name is unknown. */
async function resolveTarget(scope: 'PROJECT' | 'UNIT', target: string | null | undefined) {
  const v = (target ?? '').trim();
  if (!v) return { projectId: null, unitId: null, error: null as string | null };
  if (scope === 'PROJECT') {
    const p = await prisma.project.findFirst({ where: { OR: [{ code: v }, { name: { equals: v, mode: 'insensitive' } }] }, select: { id: true } });
    return p ? { projectId: p.id, unitId: null, error: null } : { projectId: null, unitId: null, error: `Unknown project: ${v}` };
  }
  const u = await prisma.unit.findFirst({ where: { OR: [{ code: v }, { name: { equals: v, mode: 'insensitive' } }] }, select: { id: true } });
  return u ? { projectId: null, unitId: u.id, error: null } : { projectId: null, unitId: null, error: `Unknown unit: ${v}` };
}

/** Create (no id) or update (id or code) a governance item. */
export async function saveGovItem(input: GovInputT, ref?: { id?: string; code?: string }): Promise<{ item?: DetGov; error?: string; created?: boolean }> {
  const t = await resolveTarget(input.scope, input.target);
  if (t.error) return { error: t.error };
  const data = {
    scope: input.scope, projectId: t.projectId, unitId: t.unitId, title: input.title,
    type: input.type ?? 'OTHER', status: input.status ?? 'PLANNED', ownerName: input.owner || null,
    dueDate: toDate(input.due), lastReview: toDate(input.lastReview), nextReview: toDate(input.nextReview),
    evidenceLink: input.evidence || null, notes: input.notes || null,
  };
  const existing = ref?.id || ref?.code
    ? await prisma.detGovItem.findFirst({ where: ref.id ? { id: ref.id } : { code: ref.code }, select: { id: true } })
    : null;
  if (existing) {
    const row = await prisma.detGovItem.update({ where: { id: existing.id }, data: { ...data, isDeleted: false }, select: DET_GOV_SELECT });
    return { item: toDetGov(row as never) };
  }
  const given = ref?.code && /^GV-\d+$/.test(ref.code) ? ref.code : null;
  const code = given ?? await nextGovCode();
  const row = await prisma.detGovItem.create({ data: { ...data, code }, select: DET_GOV_SELECT });
  if (given) {   // an ID typed in the sheet: move the counter past it so new IDs never repeat it
    const n = Number(given.slice(3));
    const seq = await prisma.sequence.findUnique({ where: { id: 'DET-GV' }, select: { current: true } });
    if (!seq) await prisma.sequence.create({ data: { id: 'DET-GV', prefix: 'GV', padding: 4, current: n } });
    else if (seq.current < n) await prisma.sequence.update({ where: { id: 'DET-GV' }, data: { current: n } });
  }
  return { item: toDetGov(row as never), created: true };
}
