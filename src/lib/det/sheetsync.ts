// src/lib/det/sheetsync.ts
// Two-way sync with the Google Sheets of each team (Systems Engineering, Automation, Governance).
// A small Google Apps Script sends the rows that changed in a sheet; DET saves them, then returns
// every record so the script can write back what changed in DET. Sheet edits win when both changed.

import { prisma } from '@/lib/prisma/client';
import { audit } from '@/lib/audit/logger';
import type { AuthUser, Role } from '@/types';
import { nextOrderCode, resolveProject, loadGovItems } from './server';
import { saveGovItem } from './govwrite';
import {
  BUCKETS, GOV, GOV_ITEM_STATUS, GOV_ITEM_STATUS_KEYS, GOV_ITEM_TYPE, GOV_ITEM_TYPE_KEYS, bucketOf,
  type Bucket, type DbStatus, type GovItemStatus, type GovItemType, type GovStatus, type SectionKey,
} from './shared';

/* ── Sheet columns (the order the script uses) ─────────────────────────────── */
export const ORDER_COLUMNS = ['Order ID', 'Project', 'Order', 'Responsible', 'Unit', 'Start date', 'Due date', 'Progress %', 'Status', 'Governance', 'Description', 'Narrative'] as const;
export const GOV_COLUMNS = ['Item ID', 'About', 'Project or unit', 'Governance item', 'Type', 'Owner', 'Status', 'Due date', 'Last review', 'Next review', 'Evidence link', 'Notes'] as const;
export const ORDER_STATUS_LABELS = ['Not started', 'In progress', 'Stuck', 'Done', 'Cancelled'];
export const ORDER_GOV_LABELS = ['Not required', 'Waiting review', 'Approved'];

type Row = Record<string, string | number | null | undefined>;
export type SyncResult = { ids: Record<string, string>; errors: { key: string; message: string }[]; snapshot: Row[]; lists: Record<string, string[]> };

const str = (v: unknown) => (v === null || v === undefined ? '' : String(v)).trim();
const day = (v: unknown) => { const s = str(v); return /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : ''; };
const toDate = (s: string) => (s ? new Date(`${s}T00:00:00Z`) : null);
const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : '');
const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function parseProgress(v: unknown): number | null {
  const s = str(v).replace('%', '');
  if (!s) return null;
  let n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n > 0 && n <= 1 && s.includes('.')) n = n * 100;   // 0.7 means 70%
  return Math.max(0, Math.min(100, Math.round(n)));
}
function parseStatus(v: unknown): DbStatus | 'CANCELLED' | null {
  const n = norm(str(v));
  if (!n) return null;
  if (n.startsWith('cancel')) return 'CANCELLED';
  const detail = (Object.keys(STATUS_WORD) as DbStatus[]).find(k => norm(k) === n);   // the tracker file uses the detailed status
  if (detail) return detail;
  const hit = (Object.keys(BUCKETS) as Bucket[]).find(k => norm(BUCKETS[k].label) === n || norm(k) === n);
  return hit ? BUCKETS[hit].db : null;
}
function parseGov(v: unknown): GovStatus | null {
  const n = norm(str(v));
  if (!n) return null;
  return (Object.keys(GOV) as GovStatus[]).find(k => norm(GOV[k].label) === n || norm(k) === n) ?? null;
}
/** The detailed status words of the tracker Excel file (Data tab). */
const STATUS_WORD: Record<DbStatus, string> = {
  NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review', BLOCKED: 'Blocked',
  ON_HOLD: 'On Hold', DONE: 'Done', CANCELLED: 'Cancelled',
};
const statusLabel = (s: string) => (s === 'CANCELLED' ? 'Cancelled' : BUCKETS[bucketOf(s as DbStatus)].label);

/** The DET user the sheet belongs to, so the audit log names a person. */
async function sheetOwner(roles: Role[]): Promise<AuthUser | null> {
  const u = await prisma.user.findFirst({ where: { isActive: true, role: { in: roles } }, orderBy: { createdAt: 'asc' }, select: { id: true, email: true, name: true, role: true } });
  return u ? { id: u.id, email: u.email, name: u.name, role: u.role as Role } : null;
}

async function unitIdOf(v: string): Promise<string | null | undefined> {
  if (!v) return null;
  const u = await prisma.unit.findFirst({ where: { OR: [{ code: v }, { name: { equals: v, mode: 'insensitive' } }] }, select: { id: true } });
  return u ? u.id : undefined;   // undefined = unknown unit
}

async function lists(section?: SectionKey) {
  const [projects, units] = await Promise.all([
    prisma.project.findMany({ where: { isActive: true, ...(section ? { section } : {}) }, select: { name: true }, orderBy: { name: 'asc' } }),
    prisma.unit.findMany({ where: { isActive: true }, select: { name: true }, orderBy: { name: 'asc' } }),
  ]);
  return {
    projects: projects.map(p => p.name), units: units.map(u => u.name),
    orderStatus: ORDER_STATUS_LABELS, orderGovernance: ORDER_GOV_LABELS,
    govAbout: ['Project', 'Unit'], govType: GOV_ITEM_TYPE_KEYS.map(k => GOV_ITEM_TYPE[k]), govStatus: GOV_ITEM_STATUS_KEYS.map(k => GOV_ITEM_STATUS[k].label),
  };
}

/* ── Orders (Systems Engineering or Automation sheet) ─────────────────────── */
const ORDER_ROW_SELECT = {
  orderCode: true, name: true, ownerName: true, startDate: true, dueDate: true, percentComplete: true, status: true, govStatus: true,
  unit: { select: { name: true, code: true } }, project: { select: { name: true, code: true } },
  owner: { select: { name: true } }, description: { select: { bulletSummary: true, narrativeSummary: true } },
} as const;
type OrderRowSrc = {
  orderCode: string; name: string; ownerName: string | null; startDate: Date | null; dueDate: Date | null; percentComplete: number;
  status: string; govStatus: string; unit: { name: string; code: string } | null; project: { name: string; code: string } | null; owner: { name: string } | null;
  description: { bulletSummary: string | null; narrativeSummary: string | null } | null;
};
function orderRow(o: OrderRowSrc): Row {
  return {
    'Order ID': o.orderCode, 'Project': o.project?.name ?? '', 'Order': o.name, 'Responsible': o.ownerName || o.owner?.name || '',
    'Unit': o.unit?.name ?? '', 'Start date': iso(o.startDate), 'Due date': iso(o.dueDate), 'Progress %': o.percentComplete,
    'Status': statusLabel(o.status), 'Governance': GOV[o.govStatus as GovStatus]?.label ?? 'Not required',
    'Description': (o.description?.bulletSummary ?? '').split('\n').map(s => s.trim()).filter(Boolean).join('\n'),
    'Narrative': o.description?.narrativeSummary ?? '',
    // Extra fields for the tracker file layout (Data tab); the simple sheet ignores them.
    'Status detail': STATUS_WORD[o.status as DbStatus] ?? statusLabel(o.status), 'Project code': o.project?.code ?? '', 'Unit code': o.unit?.code ?? '',
    'Late': o.status !== 'DONE' && o.status !== 'CANCELLED' && !!o.dueDate && iso(o.dueDate) < new Date().toISOString().slice(0, 10) ? 'Yes' : 'No',
  };
}
/** Compare two rows the way a person would: case, spaces and bullet marks do not count. */
function sameRow(a: Row, b: Row): boolean {
  const f = (r: Row) => ORDER_COLUMNS.map(c => str(r[c]).toLowerCase().replace(/^[•\-*]\s*/gm, '').replace(/\s+/g, ' ')).join('|');
  return f(a) === f(b);
}

export async function syncOrders(section: SectionKey, rows: { key: string; values: Row }[]): Promise<SyncResult> {
  const ids: Record<string, string> = {}, errors: SyncResult['errors'] = [];
  const owner = await sheetOwner(section === 'AUTOMATION' ? ['GOV_EDITOR'] : ['TECH_ADMIN']) ?? await sheetOwner(['SUPER_ADMIN', 'ADMIN']);

  for (const { key, values: v } of rows.slice(0, 500)) {
    try {
      const name = str(v['Order']);
      const code = str(v['Order ID']);
      if (!name && !code) continue;
      if (!name) { errors.push({ key, message: 'The Order column is empty' }); continue; }
      const existing = code ? await prisma.order.findUnique({
        where: { orderCode: code },
        select: { ...ORDER_ROW_SELECT, id: true, section: true, rescheduleCount: true },
      }) : null;
      if (existing && existing.section !== section) { errors.push({ key, message: `${code} belongs to the other section` }); continue; }
      // Nothing really changed (for example only the formatting): keep the record as it is.
      const asked = parseStatus(v['Status']);
      const incoming: Row = { ...v, 'Progress %': parseProgress(v['Progress %']) ?? '', 'Status': asked ? statusLabel(asked) : str(v['Status']) || (existing ? statusLabel(existing.status) : ''),
        'Governance': str(v['Governance']) || 'Not required', 'Start date': day(v['Start date']), 'Due date': day(v['Due date']) };
      if (existing && sameRow(incoming, orderRow(existing as unknown as OrderRowSrc)) && (!asked || asked === existing.status)) { ids[key] = code; continue; }

      const unitV = str(v['Unit']);
      const unitId = await unitIdOf(unitV);
      if (unitId === undefined) { errors.push({ key, message: `Unknown unit: ${unitV}` }); continue; }
      const projectId = await resolveProject(str(v['Project']), section, owner?.id);

      let status = parseStatus(v['Status']) ?? (existing?.status as DbStatus | undefined) ?? 'NOT_STARTED';
      let progress = parseProgress(v['Progress %']) ?? existing?.percentComplete ?? 0;
      if (status === 'DONE') progress = 100;
      else if (progress === 100 && status !== 'CANCELLED') status = 'DONE';
      else if (progress > 0 && status === 'NOT_STARTED') status = 'IN_PROGRESS';
      const gov = parseGov(v['Governance']) ?? 'NOT_REQUIRED';
      const due = day(v['Due date']), start = day(v['Start date']);
      const prevDue = existing?.dueDate ? iso(existing.dueDate) : '';
      const points = str(v['Description']).split(/\r?\n/).map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean);
      const desc = { bulletSummary: points.length ? points.join('\n') : null, narrativeSummary: str(v['Narrative']) || null, lastEditedById: owner?.id ?? null };

      const data = {
        name, ownerName: str(v['Responsible']) || null, unitId, projectId,
        startDate: toDate(start), dueDate: toDate(due),
        status, percentComplete: progress, govStatus: gov, govReviewRequired: gov !== 'NOT_REQUIRED',
        updatedById: owner?.id ?? null,
      };
      if (existing) {
        await prisma.order.update({
          where: { id: existing.id },
          data: {
            ...data,
            ...(prevDue && due && due > prevDue ? { rescheduleCount: existing.rescheduleCount + 1 } : {}),
            description: { upsert: { create: desc, update: desc } },
          },
        });
        ids[key] = code;
        if (owner) await audit({ action: existing.status !== status ? 'STATUS_CHANGE' : 'UPDATE', module: 'orders', user: owner, recordId: existing.id, recordCode: code, orderId: existing.id, notes: 'Updated from the Google Sheet' });
      } else {
        const newCode = code || await nextOrderCode(section);
        const o = await prisma.order.create({
          data: { ...data, orderCode: newCode, section, createdById: owner?.id ?? null, description: { create: desc } },
          select: { id: true },
        });
        ids[key] = newCode;
        if (owner) await audit({ action: 'CREATE', module: 'orders', user: owner, recordId: o.id, recordCode: newCode, orderId: o.id, notes: 'Added from the Google Sheet' });
      }
    } catch (e) {
      errors.push({ key, message: (e as Error).message.slice(0, 200) });
    }
  }

  // Everything in the section, so the sheet can show what changed in DET.
  const all = await prisma.order.findMany({
    where: { isDeleted: false, section },
    orderBy: [{ sheetOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { orderCode: 'asc' }],
    select: ORDER_ROW_SELECT,
  });
  const snapshot: Row[] = all.map(o => orderRow(o as unknown as OrderRowSrc));
  return { ids, errors, snapshot, lists: await lists(section) };
}

/* ── Governance sheet ─────────────────────────────────────────────────────── */
export async function syncGovernance(rows: { key: string; values: Row }[]): Promise<SyncResult> {
  const ids: Record<string, string> = {}, errors: SyncResult['errors'] = [];
  const owner = await sheetOwner(['GOVERNANCE_ADMIN']) ?? await sheetOwner(['SUPER_ADMIN', 'ADMIN']);
  const typeOf = (v: unknown): GovItemType => GOV_ITEM_TYPE_KEYS.find(k => norm(GOV_ITEM_TYPE[k]) === norm(str(v)) || norm(k) === norm(str(v))) ?? 'OTHER';
  const statusOf = (v: unknown): GovItemStatus => GOV_ITEM_STATUS_KEYS.find(k => norm(GOV_ITEM_STATUS[k].label) === norm(str(v)) || norm(k) === norm(str(v))) ?? 'PLANNED';

  for (const { key, values: v } of rows.slice(0, 500)) {
    try {
      const title = str(v['Governance item']);
      const code = str(v['Item ID']);
      if (!title && !code) continue;
      if (!title) { errors.push({ key, message: 'The Governance item column is empty' }); continue; }
      const scope = norm(str(v['About'])).startsWith('proj') ? 'PROJECT' : 'UNIT';
      const r = await saveGovItem({
        scope, target: str(v['Project or unit']) || null, title, type: typeOf(v['Type']), status: statusOf(v['Status']),
        owner: str(v['Owner']) || null, due: day(v['Due date']) || null, lastReview: day(v['Last review']) || null,
        nextReview: day(v['Next review']) || null, evidence: str(v['Evidence link']) || null, notes: str(v['Notes']) || null,
      }, code ? { code } : undefined);
      if (r.error || !r.item) { errors.push({ key, message: r.error ?? 'Could not save' }); continue; }
      ids[key] = r.item.code;
      if (owner) await audit({ action: r.created ? 'CREATE' : 'UPDATE', module: 'governance', user: owner, recordId: r.item.id, recordCode: r.item.code, notes: r.created ? 'Added from the Google Sheet' : 'Updated from the Google Sheet' });
    } catch (e) {
      errors.push({ key, message: (e as Error).message.slice(0, 200) });
    }
  }

  const items = await loadGovItems();
  const snapshot: Row[] = items.map(g => ({
    'Item ID': g.code, 'About': g.scope === 'PROJECT' ? 'Project' : 'Unit',
    'Project or unit': (g.scope === 'PROJECT' ? g.projectName : g.unitName) ?? '', 'Governance item': g.title,
    'Type': GOV_ITEM_TYPE[g.type] ?? 'Other', 'Owner': g.owner, 'Status': GOV_ITEM_STATUS[g.status]?.label ?? 'Planned',
    'Due date': g.due ?? '', 'Last review': g.lastReview ?? '', 'Next review': g.nextReview ?? '', 'Evidence link': g.evidence, 'Notes': g.notes,
  }));
  return { ids, errors, snapshot, lists: await lists() };
}
