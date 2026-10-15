// src/lib/det/shared.ts
// DET v2 shared definitions (safe to import on server and client).

export type SectionKey = 'SYSTEMS_ENGINEERING' | 'AUTOMATION';
export type SectionSlug = 'systems-engineering' | 'automation';
export type GovStatus = 'NOT_REQUIRED' | 'PENDING' | 'APPROVED';
export type DbStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'BLOCKED' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
/** The four simple states people see. */
export type Bucket = 'NOT_STARTED' | 'IN_PROGRESS' | 'STUCK' | 'DONE';

export const SECTIONS: Record<SectionKey, { key: SectionKey; slug: SectionSlug; name: string; short: string; color: string; badge: string; hint: string }> = {
  SYSTEMS_ENGINEERING: { key: 'SYSTEMS_ENGINEERING', slug: 'systems-engineering', name: 'Systems Engineering', short: 'SE', color: '#158B87', badge: '#5FD1C9', hint: 'Systems and platforms' },
  AUTOMATION:          { key: 'AUTOMATION',          slug: 'automation',          name: 'Automation',          short: 'AU', color: '#2F74C0', badge: '#9CC3F0', hint: 'Scripts and automatic tasks' },
};
export const SECTION_LIST = [SECTIONS.SYSTEMS_ENGINEERING, SECTIONS.AUTOMATION];
export function sectionFromSlug(slug: string): SectionKey | null {
  return SECTION_LIST.find(s => s.slug === slug)?.key ?? null;
}

export const BUCKETS: Record<Bucket, { label: string; color: string; db: DbStatus }> = {
  NOT_STARTED: { label: 'Not started', color: '#93A3A1', db: 'NOT_STARTED' },
  IN_PROGRESS: { label: 'In progress', color: '#158B87', db: 'IN_PROGRESS' },
  STUCK:       { label: 'Stuck',       color: '#CC3D33', db: 'BLOCKED' },
  DONE:        { label: 'Done',        color: '#1E9E6A', db: 'DONE' },
};
export const BUCKET_KEYS = Object.keys(BUCKETS) as Bucket[];

/** Map the detailed database status onto the four simple states. */
export function bucketOf(status: DbStatus): Bucket {
  switch (status) {
    case 'DONE': return 'DONE';
    case 'BLOCKED':
    case 'ON_HOLD': return 'STUCK';
    case 'IN_PROGRESS':
    case 'UNDER_REVIEW': return 'IN_PROGRESS';
    default: return 'NOT_STARTED';
  }
}

export const GOV: Record<GovStatus, { label: string; color: string }> = {
  NOT_REQUIRED: { label: 'Not required',   color: '#93A3A1' },
  PENDING:      { label: 'Waiting review', color: '#D48A0B' },
  APPROVED:     { label: 'Approved',       color: '#1E9E6A' },
};
export const GOV_KEYS = Object.keys(GOV) as GovStatus[];

/** What a page needs to know about one order. */
export type DetOrder = {
  id: string;
  code: string;
  section: SectionKey;
  name: string;
  owner: string;
  unitCode: string | null;
  unitName: string | null;
  status: DbStatus;
  bucket: Bucket;
  progress: number;
  start: string | null;      // YYYY-MM-DD
  due: string | null;        // YYYY-MM-DD
  gov: GovStatus;
  govNote: string;
  points: string[];
  narrative: string;
  risks: string;
  nextSteps: string;
  updatedAt: string;
};

export function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function isLate(o: Pick<DetOrder, 'bucket' | 'due'>, today = todayISO()): boolean {
  return o.bucket !== 'DONE' && !!o.due && o.due < today;
}
export function fdate(iso: string | null): string {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}
export const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : 0);
export function initials(name: string): string {
  const parts = name.replace(/[^\p{L}\s]/gu, ' ').trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || '?';
}
/** Stable colour per person name. */
export function personColor(name: string): string {
  const palette = ['#158B87', '#6B5BB5', '#C9A24E', '#2F74C0', '#E0663A', '#93506F', '#1E9E6A', '#0F6F6B'];
  let h = 0;
  for (const ch of name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

/* ── ELI departments, units and committees ─────────────────────────────── */
export type DetUnit = { code: string; name: string };
export const UNIT_GROUPS = ['Leadership and councils', 'Committees', 'Departments', 'Centers', 'Units'] as const;
export type UnitGroup = typeof UNIT_GROUPS[number];
/** Which group a unit belongs to, read from its name. */
export function unitGroup(name: string): UnitGroup {
  const n = name.toLowerCase();
  if (/committee/.test(n)) return 'Committees';
  if (/council|board|dean/.test(n)) return 'Leadership and councils';
  if (/department|administration/.test(n)) return 'Departments';
  if (/cent(er|re)/.test(n)) return 'Centers';
  return 'Units';
}
/** Units grouped for a dropdown, each group sorted by name. */
export function groupUnits(units: DetUnit[]): { group: UnitGroup; units: DetUnit[] }[] {
  return UNIT_GROUPS.map(group => ({
    group,
    units: units.filter(u => unitGroup(u.name) === group).sort((a, b) => a.name.localeCompare(b.name)),
  })).filter(g => g.units.length);
}

/* ── Systems register and the strategic indicator (Goal 4) ─────────────── */
export type SystemStatus = 'LIVE' | 'PILOT' | 'IN_DEVELOPMENT' | 'PLANNED';
export const SYSTEM_STATUS: Record<SystemStatus, { label: string; color: string }> = {
  LIVE:           { label: 'Live',           color: '#1E9E6A' },
  PILOT:          { label: 'Pilot',          color: '#2F74C0' },
  IN_DEVELOPMENT: { label: 'In development', color: '#D48A0B' },
  PLANNED:        { label: 'Planned',        color: '#93A3A1' },
};
export type DetSystem = {
  code: string; name: string; type: 'ADMINISTRATIVE' | 'ACADEMIC'; unitCode: string | null;
  status: SystemStatus; summary: string; link: string | null; includeInKpi: boolean;
  orders: number; done: number;
};
/** Strategic plan, Goal 4: automation of administrative and academic systems. */
export const AUTOMATION_TARGETS: { year: number; target: number }[] = [
  { year: 2027, target: 50 }, { year: 2028, target: 70 }, { year: 2029, target: 85 }, { year: 2030, target: 95 },
];
/** Automation rate = live systems / systems counted in the indicator. */
export function automationRate(systems: DetSystem[]) {
  const scope = systems.filter(s => s.includeInKpi);
  const live = scope.filter(s => s.status === 'LIVE').length;
  return { live, total: scope.length, rate: pct(live, scope.length) };
}
export function nextTarget(now = new Date()) {
  return AUTOMATION_TARGETS.find(t => t.year >= now.getFullYear()) ?? AUTOMATION_TARGETS[AUTOMATION_TARGETS.length - 1];
}
