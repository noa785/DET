// scripts/tracker-parse.ts
// Reads the DTC Enterprise Tracker Excel workbook and turns it into clean records.
// Pure functions only (no database), so the result can be checked with --dry-run.
//
// Sheets used:
//   Data    -> one row per order
//   Description (or الوصف) -> description per order (narrative, bullet points, risks, next steps)
//   Units   -> unit master list
// Rows in الوصف whose Order ID starts with "PRJ-" are older project-level write-ups.
// Every order already has its own description row, so PRJ rows are skipped.

import * as XLSX from 'xlsx';

export type ParsedOrder = {
  orderCode: string;
  type: 'PROGRAM' | 'PROJECT' | 'DELIVERABLE' | 'TASK' | 'SUBTASK';
  unitCode: string | null;
  projectCode: string | null;
  name: string;
  parentCode: string | null;
  ownerName: string | null;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  startDate: string | null;
  dueDate: string | null;
  percentComplete: number;
  status: 'NOT_STARTED' | 'IN_PROGRESS' | 'UNDER_REVIEW' | 'BLOCKED' | 'ON_HOLD' | 'DONE' | 'CANCELLED';
  rescheduleCount: number;
  dependencies: string | null;
  links: string | null;
  notes: string | null;
  narrative: string | null;
  points: string[];
  risks: string | null;
  nextSteps: string | null;
  sheetOrder: number;        // row number in the Data sheet (1 = first order)
};
export type ParsedUnit = { code: string; name: string; unitIndex: number | null; colorHex: string | null };
export type ParsedProject = { code: string; name: string; unitCode: string | null };
export type ParsedTracker = { units: ParsedUnit[]; projects: ParsedProject[]; orders: ParsedOrder[]; skippedDescriptions: string[] };

const STATUS: Record<string, ParsedOrder['status']> = {
  'done': 'DONE', 'in progress': 'IN_PROGRESS', 'not started': 'NOT_STARTED', 'under review': 'UNDER_REVIEW',
  'on hold': 'ON_HOLD', 'blocked': 'BLOCKED', 'stuck': 'BLOCKED', 'cancelled': 'CANCELLED',
};
const TYPE: Record<string, ParsedOrder['type']> = {
  'subtask': 'SUBTASK', 'deliverable': 'DELIVERABLE', 'task': 'TASK', 'project': 'PROJECT', 'program': 'PROGRAM',
};
const PRIORITY: Record<string, ParsedOrder['priority']> = { 'high': 'HIGH', 'medium': 'MEDIUM', 'low': 'LOW', 'critical': 'CRITICAL' };

/** The committee was renamed: DGCC (Digital Governance & Compliance Committee) is now DTC
 *  (Digital Transformation Committee). Orders, projects and systems under DGCC go to DTC.
 *  Order IDs such as DGCC-T-501 are kept, since they are the Excel's own IDs. */
export const UNIT_ALIAS: Record<string, string> = { DGCC: 'DTC' };
const unitCodeOf = (v: unknown): string | null => { const c = nz(v); return c ? UNIT_ALIAS[c] ?? c : null; };

/** Empty-ish cells ("-", "0", "None", formula errors) become null. */
function nz(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v).trim();
  return ['', '-', 'None', '0', '#NAME?', '#N/A', '#REF!'].includes(s) ? null : s;
}

/** Normalise long dashes to plain hyphens and trim; refer to the AI workspace in neutral words. */
function tidy(v: unknown): string | null {
  const s = nz(v);
  if (!s) return null;
  return s.replace(/\s*\u2014\s*/g, ' - ').replace(/\u2013/g, '-').replace(/\u2019/g, "'")
    .replace(/\bClaude Project\b/g, 'project workspace').trim();
}

/** Responsible person: people only (an AI assistant is a tool, not an owner). */
function owner(v: unknown): string | null {
  const s = tidy(v);
  if (!s) return null;
  const cleaned = s.replace(/\s*[+&,/]\s*Claude\b/gi, '').replace(/^Claude\s*[+&,/]\s*/i, '').replace(/^Claude$/i, '').trim();
  return cleaned || null;
}

function toDate(v: unknown): string | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    // Excel date serial number: read the calendar day directly (no time-zone drift)
    const p = XLSX.SSF.parse_date_code(v);
    return `${p.y}-${String(p.m).padStart(2, '0')}-${String(p.d).padStart(2, '0')}`;
  }
  const s = String(v).trim();
  let m = s.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);           // 25-09-2025
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);                            // 2026-05-14
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

function toPercent(v: unknown): number {
  if (v === null || v === undefined) return 0;
  const raw = String(v).trim();
  const n = parseFloat(raw.replace('%', ''));
  if (isNaN(n)) return 0;
  const pct = raw.includes('%') ? n : n <= 1 ? n * 100 : n;
  return Math.max(0, Math.min(100, Math.round(pct)));
}

/**
 * Turn the "Weekly Bullet" text into a clean list of points.
 * Top-level bullets (•, -, *, 1.) become points; "o" sub-bullets are joined to the point above;
 * short heading lines such as "Key tasks completed" or "Objective:" are dropped.
 */
export function toPoints(text: unknown): string[] {
  const s = nz(text);
  if (!s) return [];
  const out: string[] = [];
  const bullet = /^\s*([•●▪·\-*]|o(?=\s)|\d+[.)])\s*/;
  const headings = ['key points', 'key tasks completed', 'key tasks', 'tasks completed', 'objective', 'outcome', 'outcomes'];
  for (const raw0 of s.split(/\r?\n/)) {
    const raw = raw0.replace(/\t/g, ' ');
    let line = raw.trim();
    if (!line) continue;
    const m = raw.match(bullet);
    let kind: 'top' | 'sub' | null = null;
    if (m) { kind = m[1] === 'o' ? 'sub' : 'top'; line = raw.slice(m[0].length).trim(); }
    if (!line) continue;
    if (!kind && (headings.includes(line.toLowerCase().replace(/:$/, '')) || (line.endsWith(':') && line.length < 40))) continue;
    line = tidy(line) ?? line;
    if (kind === 'sub' && out.length) {
      const last = out[out.length - 1];
      out[out.length - 1] = last + (last.endsWith(':') ? ' ' : '; ') + line;
    } else out.push(line);
  }
  return out;
}

function rowsOf(wb: XLSX.WorkBook, name: string): unknown[][] {
  const ws = wb.Sheets[name];
  if (!ws) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: true, defval: null }).slice(1);
}

export function parseTracker(file: string): ParsedTracker {
  const wb = XLSX.readFile(file);

  // Units: the sheet uses "SC" twice (Student Council and Speaking Center). The second one keeps the
  // code the system already uses for it (SPEAK) so neither name overwrites the other.
  const KNOWN_CODES: Record<string, string> = { 'speaking center': 'SPEAK' };
  const units: ParsedUnit[] = [];
  for (const r of rowsOf(wb, 'Units')) {
    if (!nz(r[0])) continue;
    if (UNIT_ALIAS[String(r[0]).trim()]) continue;   // renamed committee: its new unit is already in the list
    const name = tidy(r[1]) ?? String(r[0]).trim();
    let code = String(r[0]).trim();
    if (units.some(u => u.code === code)) code = KNOWN_CODES[name.toLowerCase()] ?? `${code}2`;
    units.push({
      code, name,
      unitIndex: Number.isFinite(Number(r[2])) && nz(r[2]) ? Number(r[2]) : null,
      colorHex: /^#[0-9a-f]{6}$/i.test(String(r[3] ?? '')) ? String(r[3]) : null,
    });
  }

  // Descriptions: "Description" in files downloaded from DET, "الوصف" in the original tracker
  const descSheet = wb.SheetNames.find(n => ['description', 'الوصف'].includes(n.trim().toLowerCase())) ?? 'Description';
  const desc = new Map<string, unknown[]>();
  const skippedDescriptions: string[] = [];
  for (const r of rowsOf(wb, descSheet)) {
    const id = nz(r[0]);
    if (!id) continue;
    if (id.startsWith('PRJ-')) { skippedDescriptions.push(id); continue; }
    desc.set(id, r);
  }

  const seen = new Map<string, number>();
  const projects = new Map<string, ParsedProject>();
  const orders: ParsedOrder[] = [];

  let row = 0;
  for (const r of rowsOf(wb, 'Data')) {
    const id = nz(r[0]);
    if (!id) continue;
    row++;
    const count = (seen.get(id) ?? 0) + 1;
    seen.set(id, count);
    const code = count > 1 ? `${id}-${String.fromCharCode(64 + count)}` : id;   // duplicate IDs get -B, -C
    const d = count === 1 ? desc.get(id) : undefined;

    const projectCode = nz(r[4]);
    const projectName = tidy(r[5]);
    if (projectCode && projectName && !projects.has(projectCode)) {
      projects.set(projectCode, { code: projectCode, name: projectName, unitCode: unitCodeOf(r[2]) });
    }

    const status = STATUS[(nz(r[13]) ?? '').toLowerCase()] ?? 'NOT_STARTED';
    const resched = Number(nz(r[14]));

    orders.push({
      orderCode: code,
      type: TYPE[(nz(r[1]) ?? '').toLowerCase()] ?? 'TASK',
      unitCode: unitCodeOf(r[2]),
      projectCode: projectCode && projectName ? projectCode : null,
      name: tidy(r[6]) ?? code,
      parentCode: nz(r[7]),
      ownerName: owner(r[8]),
      priority: PRIORITY[(nz(r[9]) ?? '').toLowerCase()] ?? 'MEDIUM',
      startDate: toDate(r[10]),
      dueDate: toDate(r[11]),
      percentComplete: status === 'DONE' ? 100 : toPercent(r[12]),
      status,
      rescheduleCount: Number.isFinite(resched) ? resched : 0,
      dependencies: tidy(r[15]),
      links: nz(r[16]),
      notes: tidy(r[17]),
      narrative: d ? tidy(d[2]) : null,
      points: d ? toPoints(d[3]).filter(p => p.toLowerCase().replace(/[.\s]+$/, '') !== (tidy(r[6]) ?? '').toLowerCase().replace(/[.\s]+$/, '')) : [],
      risks: d ? tidy(d[4]) : null,
      nextSteps: d ? tidy(d[5]) : null,
      sheetOrder: row,
    });
  }

  const codes = new Set(orders.map(o => o.orderCode));
  for (const o of orders) if (o.parentCode && !codes.has(o.parentCode)) o.parentCode = null;

  return { units, projects: [...projects.values()], orders, skippedDescriptions };
}

// ── Systems register (data/DET_Systems_Register.xlsx, sheet "Systems") ──────────
export type ParsedSystem = {
  code: string; name: string; type: 'ADMINISTRATIVE' | 'ACADEMIC'; unitCode: string | null;
  status: 'LIVE' | 'PILOT' | 'IN_DEVELOPMENT' | 'PLANNED'; summary: string | null; link: string | null;
  match: string[]; includeInKpi: boolean;
};
const SYS_STATUS: Record<string, ParsedSystem['status']> = { 'live': 'LIVE', 'pilot': 'PILOT', 'in development': 'IN_DEVELOPMENT', 'planned': 'PLANNED' };

export function parseSystems(file: string): ParsedSystem[] {
  const wb = XLSX.readFile(file);
  return rowsOf(wb, 'Systems')
    .filter(r => nz(r[0]) && nz(r[1]))
    .map(r => ({
      code: String(r[0]).trim(),
      name: tidy(r[1]) ?? String(r[1]),
      type: (nz(r[2]) ?? '').toLowerCase().startsWith('acad') ? 'ACADEMIC' : 'ADMINISTRATIVE',
      unitCode: unitCodeOf(r[3]),
      status: SYS_STATUS[(nz(r[4]) ?? '').toLowerCase()] ?? 'PLANNED',
      summary: tidy(r[5]),
      link: nz(r[6]),
      match: (nz(r[7]) ?? '').split(';').map(s => s.trim().toLowerCase()).filter(Boolean),
      includeInKpi: (nz(r[8]) ?? 'yes').toLowerCase() !== 'no',
    }));
}

/** Which system an order belongs to: its own Project Code first, then the name keywords. */
export function systemFor(o: ParsedOrder, systems: ParsedSystem[]): string | null {
  if (o.projectCode && systems.some(s => s.code === o.projectCode)) return o.projectCode;
  // A match word can be limited to one unit with "@": e.g. "meeting 1@do" only matches orders of unit DO.
  const name = o.name.toLowerCase();
  const unit = (o.unitCode ?? '').toLowerCase();
  const hit = systems.find(s => s.match.some(m => {
    const [word, onlyUnit] = m.split('@').map(x => x.trim());
    return !!word && name.includes(word) && (!onlyUnit || onlyUnit === unit);
  }));
  return hit?.code ?? null;
}
