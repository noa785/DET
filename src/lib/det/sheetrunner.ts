// src/lib/det/sheetrunner.ts
// Two-way sync between DET and the three Google Sheets, run by DET itself every 5 minutes
// (see /api/sync/run). Same rules as the earlier Apps Script:
//  - only the cells changed in a sheet since the last sync are sent, so an edit on the website to another
//    cell of the same row stays; when the very same cell changed in both places, the sheet wins
//  - only rows that really change are written, and never a row someone typed in while the sync ran
//  - deleted on the website: the row is struck through in the sheet; a row deleted in the sheet comes back
// The hidden "Sync" column keeps the values of each row as last synced.

import { createHash } from 'crypto';
import { prisma } from '@/lib/prisma/client';
import { Book, a1, grid, serialToIso, type Cell } from './gsheets';
import { syncGovernance, syncOrders, type SyncResult, type SyncRow } from './sheetsync';

export const SHEET_FILES = {
  se:  { id: '1E-rAdVAxTLdEbpHCeToHthqEIIEQXze6o19BHaRlP0Q', kind: 'orders', section: 'SYSTEMS_ENGINEERING', name: 'Systems Engineering' },
  au:  { id: '1euU4Lr-hIAm1zvGdKtGnhJ-Sn6cbn8JGhdxnAEaxCU0', kind: 'orders', section: 'AUTOMATION', name: 'Automation' },
  gov: { id: '15LF46ihd6vh2hCDbqJ0kW7RRJ20OUCSmbTAKkEywqD8', kind: 'governance', section: null, name: 'Governance' },
} as const;
export type FileKey = keyof typeof SHEET_FILES;

const PER_RUN = 40;   // changed rows sent per file per run; the rest go next run
const GOV_COLS = ['Item ID', 'About', 'Project or unit', 'Governance item', 'Type', 'Owner', 'Status', 'Due date', 'Last review', 'Next review', 'Evidence link', 'Notes'];
const GOV_DATES = new Set([7, 8, 9]);
const T_DATA: Record<string, string> = {
  'Order ID': 'Order ID', 'Project Name': 'Project', 'Task/Subtask Name': 'Order', 'Owner / Assignee': 'Responsible',
  'Unit Code': 'Unit', 'Start Date': 'Start date', 'Due Date': 'Due date', '% Complete': 'Progress %', 'Status': 'Status', 'Governance': 'Governance',
};
const T_DESC: Record<string, string> = { 'Weekly Bullet': 'Description', 'Weekly Narrative': 'Narrative' };
const TEAL = { red: 0x15 / 255, green: 0x8b / 255, blue: 0x87 / 255 };
const GREY = { red: 0x9a / 255, green: 0xa5 / 255, blue: 0xa4 / 255 };

type Row = Record<string, string>;
type Snap = Record<string, string | number | null | undefined>;

/* ── Small helpers ────────────────────────────────────────────────────────── */
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
/** A date typed as text ("19 Sep 2025", "2025-09-19", "19/09/2025") as "yyyy-mm-dd"; anything else unchanged. */
function isoOf(s: string): string {
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})[\s-]([A-Za-z]{3})[A-Za-z]*[\s-](\d{4})$/);
  if (m && MONTHS.includes(m[2].toLowerCase())) return `${m[3]}-${String(MONTHS.indexOf(m[2].toLowerCase()) + 1).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return s;
}
const text = (x: Cell | undefined, isDate = false): string => {
  if (x === null || x === undefined) return '';
  if (isDate && typeof x === 'number') return serialToIso(x);
  return isDate ? isoOf(String(x).trim()) : String(x).trim();
};
const same = (x: unknown) => (x === null || x === undefined ? '' : String(x)).replace(/\s+/g, ' ').trim();
const pad = (r: Cell[], w: number) => { const o = r.slice(0, w); while (o.length < w) o.push(''); return o; };
const pick = (cols: string[], v: Snap): Row => { const o: Row = {}; cols.forEach(c => { o[c] = v[c] === null || v[c] === undefined ? '' : String(v[c]); }); return o; };
/** The hash the Apps Script used to keep, so rows it already synced are recognised. */
function legacyHash(values: Row): string {
  const s = Object.keys(values).sort().map(k => `${k}=${String(values[k] ?? '').trim()}`).join('|');
  return createHash('md5').update(s, 'utf8').digest('base64');
}
function changedFields(values: Row, saved: string): string[] {
  if (saved === 'DELETED') return [];
  if (saved.startsWith('{')) {
    try { const b = JSON.parse(saved) as Row; return Object.keys(values).filter(k => same(values[k]) !== same(b[k])); } catch { /* damaged copy */ }
  }
  return legacyHash(values) === saved ? [] : Object.keys(values);
}
const cellKey = (x: Cell | undefined, isDate: boolean) => {
  if (x === null || x === undefined) return '';
  if (typeof x === 'number') return isDate ? serialToIso(x) : String(Math.round(x * 1e6) / 1e6);
  return isDate ? isoOf(String(x).trim()) : String(x);
};
const rowEq = (a: Cell[] | undefined, b: Cell[] | undefined, dates: Set<number>) => {
  if (!a || !b) return false;
  for (let j = 0; j < Math.max(a.length, b.length); j++) if (cellKey(a[j], dates.has(j)) !== cellKey(b[j], dates.has(j))) return false;
  return true;
};

/**
 * Writes the cells that change, and only in rows nobody edited since they were read at the start of this run.
 * Returns the rows it left alone (picked up next run).
 */
async function safeWrite(book: Book, tab: string, width: number, orig: Cell[][], next: Cell[][], dates: Set<number>): Promise<Set<number>> {
  const skipped = new Set<number>();
  const todo = orig.map((r, i) => i).filter(i => !rowEq(orig[i], next[i], dates));
  if (!todo.length) return skipped;
  const now = (await book.read(tab)).slice(1).map(r => pad(r, width));
  const data: { range: string; values: Cell[][] }[] = [];
  for (const i of todo) {
    if (!now[i] || !rowEq(now[i], orig[i], dates)) { skipped.add(i); continue; }
    // Only the cells that differ, in runs of neighbouring columns.
    for (let j = 0; j < width;) {
      if (cellKey(orig[i][j], dates.has(j)) === cellKey(next[i][j], dates.has(j))) { j++; continue; }
      let e = j;
      while (e + 1 < width && cellKey(orig[i][e + 1], dates.has(e + 1)) !== cellKey(next[i][e + 1], dates.has(e + 1))) e++;
      data.push({ range: a1(tab, i + 2, j + 1, 1, e - j + 1), values: [next[i].slice(j, e + 1)] });
      j = e + 1;
    }
  }
  await book.write(data);
  return skipped;
}
async function strike(book: Book, tab: string, rows: number[], cols: number, on: boolean) {
  const t = await book.tab(tab);
  if (!t || !rows.length) return;
  await book.batch(rows.map(i => ({
    repeatCell: {
      range: grid(t.sheetId, i + 2, 1, 1, cols),
      cell: { userEnteredFormat: { textFormat: on ? { strikethrough: true, foregroundColor: GREY } : { strikethrough: false } } },
      fields: on ? 'userEnteredFormat.textFormat.strikethrough,userEnteredFormat.textFormat.foregroundColor' : 'userEnteredFormat.textFormat.strikethrough,userEnteredFormat.textFormat.foregroundColor',
    },
  })));
}
async function log(book: Book, row: string, message: string) {
  try {
    let t = await book.tab('Sync log');
    if (!t) { t = await book.addTab('Sync log'); await book.write([{ range: a1('Sync log', 1, 1, 1, 3), values: [['Time', 'Row', 'Message']] }]); }
    await book.batch([{ insertDimension: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: 1, endIndex: 2 }, inheritFromBefore: false } }]);
    const when = new Date().toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', hour12: false }).replace(',', '');
    await book.write([{ range: a1('Sync log', 2, 1, 1, 3), values: [[when, row, message]] }]);
    if (t.rows > 330) await book.batch([{ deleteDimension: { range: { sheetId: t.sheetId, dimension: 'ROWS', startIndex: 300, endIndex: t.rows } } }]);
  } catch { /* the log must never stop the sync */ }
}
function summary(sent: number, waiting: number, extra: number, struck: number, later: number, problems: number) {
  return `Synced: ${sent} sent${waiting ? ` (${waiting} next run)` : ''}, ${extra} added from DET, ${struck} deleted on the website, ${later} typed during the sync (next run), ${problems} problems`;
}
async function refreshLists(book: Book, lists: Record<string, string[]>, kind: 'orders' | 'governance') {
  let t = await book.tab('Lists');
  if (!t) t = await book.addTab('Lists', { hidden: true });
  const cols: [string, string[]][] = kind === 'orders'
    ? [['Projects', lists.projects], ['Units', lists.units], ['Status', lists.orderStatus], ['Governance', lists.orderGovernance]]
    : [['About', lists.govAbout], ['Projects', lists.projects], ['Units', lists.units], ['Type', lists.govType], ['Status', lists.govStatus]];
  await book.clear([`'Lists'`]);
  await book.write(cols.map(([h, v], j) => ({ range: a1('Lists', 1, j + 1, v.length + 1, 1), values: [[h], ...v.map(x => [x])] })));
}

/* ── Governance file: tab "Governance", fixed columns, Sync column after them ── */
async function syncGovFile(book: Book): Promise<SyncResult['snapshot']> {
  const tab = 'Governance', cols = GOV_COLS, n = cols.length, width = n + 1;
  if (!(await book.tab(tab))) throw new Error('Tab "Governance" not found');
  const data = (await book.read(tab)).slice(1).map(r => pad(r, width));
  const orig = data.map(r => r.slice());
  const vals = (r: Cell[]) => { const v: Row = {}; cols.forEach((c, j) => { v[c] = text(r[j], GOV_DATES.has(j)); }); return v; };

  const changed: SyncRow[] = [];
  data.forEach((r, i) => {
    const v = vals(r);
    if (cols.slice(1).every(c => v[c] === '')) return;
    const saved = text(r[n]);
    if (v['Item ID'] && saved === '') return;                     // never synced: DET's copy is taken
    const fields = changedFields(v, saved);
    if (fields.length) changed.push({ key: String(i + 2), values: v, fields });
  });
  const sent = changed.slice(0, PER_RUN), waiting = new Set(changed.slice(PER_RUN).map(c => c.key));
  const out = await syncGovernance(sent);
  for (const [key, id] of Object.entries(out.ids)) { const r = data[Number(key) - 2]; if (r) r[0] = id; }
  const byId = new Map(out.snapshot.map(v => [String(v['Item ID']), v]));
  const failed = new Set(out.errors.map(e => e.key)), gone = new Set(out.deleted);
  for (const e of out.errors) await log(book, e.key, e.message);

  const struck: number[] = [], unstruck: number[] = [];
  data.forEach((r, i) => {
    const key = String(i + 2), id = text(r[0]), saved = text(r[n]);
    if (!id) return;
    const fresh = byId.get(id);
    byId.delete(id);
    if (gone.has(key) || (!fresh && saved !== '' && saved !== 'edited' && saved !== 'DELETED' && !failed.has(key) && !waiting.has(key))) { r[n] = 'DELETED'; struck.push(i); return; }
    if (failed.has(key) || waiting.has(key)) return;
    if (!fresh) { if (saved === '') r[n] = 'edited'; return; }
    cols.forEach((c, j) => { r[j] = fresh[c] === null || fresh[c] === undefined ? '' : fresh[c] as Cell; });
    r[n] = JSON.stringify(pick(cols, fresh));
    if (saved === 'DELETED') unstruck.push(i);
  });
  const skipped = await safeWrite(book, tab, width, orig, data, GOV_DATES);
  await strike(book, tab, struck.filter(i => !skipped.has(i)), n, true);
  await strike(book, tab, unstruck.filter(i => !skipped.has(i)), n, false);
  const extra = [...byId.values()];
  await book.append(tab, extra.map(v => [...cols.map(c => (v[c] ?? '') as Cell), JSON.stringify(pick(cols, v))]));
  await refreshLists(book, out.lists, 'governance');
  if (sent.length || extra.length || out.errors.length || struck.length || skipped.size) {
    await log(book, '', summary(sent.length, waiting.size, extra.length, struck.length, skipped.size, out.errors.length));
  }
  return out.snapshot;
}

/* ── Tracker file (Systems Engineering, Automation): tabs Data and Description ── */
const headerIndex = (h: Cell[]) => { const o: Record<string, number> = {}; h.forEach((x, j) => { o[String(x ?? '').trim()] = j; }); return o; };
const dateCols = (h: Cell[]) => new Set(h.map((x, j) => (/date/i.test(String(x ?? '')) ? j : -1)).filter(j => j >= 0));

async function syncTrackerFile(book: Book, section: 'SYSTEMS_ENGINEERING' | 'AUTOMATION', sectionName: string) {
  if (!(await book.tab('Data')) || !(await book.tab('Description'))) throw new Error('Tabs "Data" and "Description" are needed');
  const dAll = await book.read('Data');
  const dh = (dAll[0] ?? []).map(x => String(x ?? '').trim());
  let dw = Math.max(dh.length, ...dAll.map(r => r.length));
  if (!dh.includes('Sync')) {
    const t = (await book.tab('Data'))!;
    if (t.cols < dw + 1) await book.batch([{ appendDimension: { sheetId: t.sheetId, dimension: 'COLUMNS', length: dw + 1 - t.cols } }]);
    await book.write([{ range: a1('Data', 1, dw + 1), values: [['Sync']] }]);
    await book.batch([{ updateDimensionProperties: { range: { sheetId: t.sheetId, dimension: 'COLUMNS', startIndex: dw, endIndex: dw + 1 }, properties: { hiddenByUser: true }, fields: 'hiddenByUser' } }]);
    while (dh.length < dw) dh.push('');
    dh.push('Sync'); dw += 1;
  }
  const D = headerIndex(dh), dDates = dateCols(dh);
  for (const h of ['Order ID', 'Project Name', 'Task/Subtask Name', 'Status', 'Sync']) if (D[h] === undefined) throw new Error(`Data tab: column "${h}" not found`);
  const data = dAll.slice(1).map(r => pad(r, dw));
  const dOrig = data.map(r => r.slice());

  const eAll = await book.read('Description');
  const eh = (eAll[0] ?? []).map(x => String(x ?? '').trim());
  const ew = Math.max(eh.length, ...eAll.map(r => r.length));
  const E = headerIndex(eh);
  const desc = eAll.slice(1).map(r => pad(r, ew));
  const eOrig = desc.map(r => r.slice());
  const descOf = new Map<string, Cell[]>(), descByName = new Map<string, Cell[]>();
  desc.forEach(r => {
    const id = text(r[E['Order ID']]);
    if (id) descOf.set(id, r);
    else if (E['Task/Subtask Name'] !== undefined && r[E['Task/Subtask Name']]) descByName.set(text(r[E['Task/Subtask Name']]).toLowerCase(), r);
  });
  const descFor = (r: Cell[]) => { const id = text(r[D['Order ID']]); return id ? descOf.get(id) : descByName.get(text(r[D['Task/Subtask Name']]).toLowerCase()); };
  const values = (r: Cell[], d: Cell[] | undefined): Row => {
    const v: Row = {};
    for (const h of Object.keys(T_DATA)) if (D[h] !== undefined) v[T_DATA[h]] = text(r[D[h]], dDates.has(D[h]));
    if (!v['Unit'] && D['Unit Name'] !== undefined) v['Unit'] = text(r[D['Unit Name']]);
    if (!v['Project'] && D['Project Code'] !== undefined) v['Project'] = text(r[D['Project Code']]);
    const p = r[D['% Complete']];
    v['Progress %'] = typeof p === 'number' ? String(Math.round(p <= 1 ? p * 100 : p)) : String(p ?? '').replace('%', '').trim();
    for (const h of Object.keys(T_DESC)) {
      const x = d && E[h] !== undefined ? text(d[E[h]]) : '';
      v[T_DESC[h]] = h === 'Weekly Bullet' ? x.split('\n').map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(Boolean).join('\n') : x;
    }
    return v;
  };

  const changed: SyncRow[] = [];
  data.forEach((r, i) => {
    const v = values(r, descFor(r));
    if (!v['Order'] && !v['Order ID']) return;
    const saved = text(r[D['Sync']]);
    if (v['Order ID'] && saved === '') return;
    const fields = changedFields(v, saved);
    if (fields.length) changed.push({ key: String(i + 2), values: v, fields });
  });
  const sent = changed.slice(0, PER_RUN), waiting = new Set(changed.slice(PER_RUN).map(c => c.key));
  const out = await syncOrders(section, sent);
  for (const [key, id] of Object.entries(out.ids)) {
    const r = data[Number(key) - 2];
    if (!r || text(r[D['Order ID']]) === id) continue;
    const d = descFor(r);
    r[D['Order ID']] = id;
    if (d && !text(d[E['Order ID']])) { d[E['Order ID']] = id; descOf.set(id, d); }
  }
  const byId = new Map(out.snapshot.map(v => [String(v['Order ID']), v]));
  const failed = new Set(out.errors.map(e => e.key)), gone = new Set(out.deleted);
  for (const e of out.errors) await log(book, e.key, e.message);

  const set = (r: Cell[], idx: Record<string, number>, h: string, v: unknown) => { if (idx[h] !== undefined) r[idx[h]] = v === null || v === undefined ? '' : v as Cell; };
  const newDesc: Cell[][] = [];
  const apply = (r: Cell[], v: Snap) => {
    set(r, D, 'Order ID', v['Order ID']);
    set(r, D, 'Project Code', v['Project code']); set(r, D, 'Project Name', v['Project']);
    set(r, D, 'Task/Subtask Name', v['Order']); set(r, D, 'Owner / Assignee', v['Responsible']);
    set(r, D, 'Unit Code', v['Unit code']); set(r, D, 'Unit Name', v['Unit']);
    set(r, D, 'Start Date', v['Start date'] || ''); set(r, D, 'Due Date', v['Due date'] || '');
    set(r, D, '% Complete', (Number(v['Progress %']) || 0) / 100);
    set(r, D, 'Status', v['Status detail'] || v['Status']); set(r, D, 'Simple Status', v['Status']);
    set(r, D, 'Governance', v['Governance']); set(r, D, 'Late', v['Late']);
    const bullets = String(v['Description'] ?? '').split('\n').filter(Boolean).map(x => `• ${x}`).join('\n');
    let d = descOf.get(String(v['Order ID']));
    if (!d && (bullets || v['Narrative'])) { d = eh.map(() => '' as Cell); while (d.length < ew) d.push(''); newDesc.push(d); descOf.set(String(v['Order ID']), d); }
    if (d) {
      set(d, E, 'Order ID', v['Order ID']); set(d, E, 'Unit Code', v['Unit code']); set(d, E, 'Task/Subtask Name', v['Order']);
      set(d, E, 'Weekly Bullet', bullets); set(d, E, 'Weekly Narrative', v['Narrative'] || '');
    }
    r[D['Sync']] = JSON.stringify(values(r, d));
  };
  const struck: number[] = [], unstruck: number[] = [];
  data.forEach((r, i) => {
    const key = String(i + 2), id = text(r[D['Order ID']]), saved = text(r[D['Sync']]);
    if (!id) return;
    const fresh = byId.get(id);
    byId.delete(id);
    if (gone.has(key) || (!fresh && saved !== '' && saved !== 'edited' && saved !== 'DELETED' && !failed.has(key) && !waiting.has(key))) { r[D['Sync']] = 'DELETED'; struck.push(i); return; }
    if (failed.has(key) || waiting.has(key)) return;
    if (!fresh) { if (saved === '') r[D['Sync']] = 'edited'; return; }
    apply(r, fresh);
    if (saved === 'DELETED') unstruck.push(i);
  });
  const added: Cell[][] = [...byId.values()].map(v => {
    const r: Cell[] = dh.map(() => '');
    set(r, D, 'Order Type', 'Task'); set(r, D, 'Section', sectionName);
    apply(r, v);
    return r;
  });
  const skipped = await safeWrite(book, 'Data', dw, dOrig, data, dDates);
  await strike(book, 'Data', struck.filter(i => !skipped.has(i)), dw - 1, true);
  await strike(book, 'Data', unstruck.filter(i => !skipped.has(i)), dw - 1, false);
  await book.append('Data', added);
  const eSkipped = await safeWrite(book, 'Description', ew, eOrig, desc, dateCols(eh));
  await book.append('Description', newDesc);
  await refreshLists(book, out.lists, 'orders');
  const later = skipped.size + eSkipped.size;
  if (sent.length || added.length || out.errors.length || struck.length || later) {
    await log(book, '', summary(sent.length, waiting.size, added.length, struck.length, later, out.errors.length));
  }
}

/* ── Data governance views: the "Data Governance" tab of each tracker file and "Team Updates" in the Governance file ── */
async function mirrorGovernance(items: SyncResult['snapshot']) {
  const all: Cell[][] = [];
  for (const key of ['se', 'au'] as const) {
    const f = SHEET_FILES[key];
    const book = new Book(f.id);
    try {
      const dv = await book.read('Data');
      if (dv.length < 2) continue;
      const D = headerIndex(dv[0]), dDates = dateCols(dv[0]);
      const byId = new Map<string, Cell[]>(), mine = new Set<string>();
      dv.slice(1).forEach(r => { const id = text(r[D['Order ID']]), pj = text(r[D['Project Name']]); if (pj) mine.add(pj.toLowerCase()); if (id) byId.set(id, r); });
      const updates: { when: string; project: string; id: string; task: string; what: string; domain: string }[] = [];
      const desc = (await book.tab('Description')) ? await book.read('Description') : [];
      if (desc.length > 1) {
        const E = headerIndex(desc[0]);
        if (E['Data Governance'] !== undefined) {
          for (const r of desc.slice(1)) {
            const note = text(r[E['Data Governance']]), id = text(r[E['Order ID']]);
            if (!note || !id) continue;
            const d = byId.get(id) ?? [];
            const when = text(d[D['Start Date']], dDates.has(D['Start Date'])) || text(d[D['Due Date']], dDates.has(D['Due Date']));
            const cut = note.indexOf(': ');
            const domain = cut > 0 ? note.slice(0, cut) : 'Data Governance', raw = cut > 0 ? note.slice(cut + 2) : note;
            updates.push({ when, project: text(d[D['Project Name']]), id, task: text(d[D['Task/Subtask Name']]) || text(r[E['Task/Subtask Name']]), what: raw.charAt(0).toUpperCase() + raw.slice(1), domain });
          }
        }
      }
      updates.sort((x, y) => (x.when || '9999').localeCompare(y.when || '9999') || x.id.localeCompare(y.id));
      updates.forEach(u => all.push([u.when, f.name, u.project, u.id, u.task, u.what, u.domain]));

      const t = await book.tab('Data Governance');
      if (!t) continue;
      const gv = await book.read('Data Governance');
      const s2 = gv.findIndex(r => text(r[1]).startsWith('2. '));
      if (s2 < 0) continue;
      const start = s2 + 2;
      const last = Math.max(gv.length, start);
      const govRows: Cell[][] = items.filter(g => g['About'] === 'Project' && mine.has(String(g['Project or unit'] ?? '').trim().toLowerCase()))
        .map(g => [g['Item ID'], g['Project or unit'], g['Governance item'], g['Type'], g['Owner'], g['Status'], g['Next review'] || '', g['Notes']].map(x => (x ?? '') as Cell));
      const out: Cell[][] = [['Date', 'Project', 'What changed', 'Order ID', 'NDMO domain', '', '', ''],
        ...updates.map(u => [u.when, u.project, u.what, u.id, u.domain, '', '', ''] as Cell[]),
        ['', '', '', '', '', '', '', ''],
        ['3. Governance items (kept in step with the Governance file every 5 minutes; edit items there)', '', '', '', '', '', '', ''],
        ['Item ID', 'Project', 'Governance item', 'Type', 'Owner', 'Status', 'Next review', 'Notes'], ...govRows];
      const s3 = start + 1 + updates.length + 1;
      const head = (row: number, cols: number) => ({ repeatCell: { range: grid(t.sheetId, row, 2, 1, cols), cell: { userEnteredFormat: { backgroundColor: TEAL, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat' } });
      await book.clear([a1('Data Governance', start, 2, last - start + 1, 8)]);
      await book.batch([
        { repeatCell: { range: grid(t.sheetId, start, 2, Math.max(last, start + out.length) - start + 1, 8), cell: { userEnteredFormat: {} }, fields: 'userEnteredFormat' } },
        { repeatCell: { range: grid(t.sheetId, start, 2, out.length, 8), cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } }, fields: 'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment' } },
      ]);
      await book.write([{ range: a1('Data Governance', start, 2, out.length, 8), values: out }]);
      await book.batch([
        head(start, 5), head(s3 + 1, 8),
        { repeatCell: { range: grid(t.sheetId, s3, 2, 1, 1), cell: { userEnteredFormat: { textFormat: { bold: true, fontSize: 12, foregroundColor: TEAL } } }, fields: 'userEnteredFormat.textFormat' } },
        ...(updates.length ? [{ repeatCell: { range: grid(t.sheetId, start + 1, 2, updates.length, 1), cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd mmm yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } }] : []),
      ]);
    } catch (e) { await log(book, '', `Data Governance tab: ${(e as Error).message}`); }
  }
  const gov = new Book(SHEET_FILES.gov.id);
  try {
    let t = await gov.tab('Team Updates');
    if (!t) t = await gov.addTab('Team Updates', { index: 1 });
    const rows: Cell[][] = [['Date', 'Section', 'Project', 'Order ID', 'Task', 'Data governance update', 'NDMO domain'], ...all];
    await gov.clear([`'Team Updates'`]);
    await gov.batch([
      { repeatCell: { range: { sheetId: t.sheetId }, cell: { userEnteredFormat: {} }, fields: 'userEnteredFormat' } },
      { updateSheetProperties: { properties: { sheetId: t.sheetId, gridProperties: { frozenRowCount: 1 } }, fields: 'gridProperties.frozenRowCount' } },
    ]);
    await gov.write([{ range: a1('Team Updates', 1, 1, rows.length, 7), values: rows }]);
    await gov.batch([
      { repeatCell: { range: grid(t.sheetId, 1, 1, rows.length, 7), cell: { userEnteredFormat: { wrapStrategy: 'WRAP', verticalAlignment: 'TOP' } }, fields: 'userEnteredFormat.wrapStrategy,userEnteredFormat.verticalAlignment' } },
      { repeatCell: { range: grid(t.sheetId, 1, 1, 1, 7), cell: { userEnteredFormat: { backgroundColor: TEAL, textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } } } }, fields: 'userEnteredFormat.backgroundColor,userEnteredFormat.textFormat' } },
      ...(all.length ? [{ repeatCell: { range: grid(t.sheetId, 2, 1, all.length, 1), cell: { userEnteredFormat: { numberFormat: { type: 'DATE', pattern: 'dd mmm yyyy' } } }, fields: 'userEnteredFormat.numberFormat' } }] : []),
    ]);
  } catch (e) { await log(gov, '', `Team Updates tab: ${(e as Error).message}`); }
}

/* ── One file per call, with a lock so two runs never work on the same file at once ── */
async function lock(file: FileKey): Promise<boolean> {
  const id = `SYNC-LOCK-${file}`, now = Math.floor(Date.now() / 1000);
  await prisma.sequence.upsert({ where: { id }, update: {}, create: { id, prefix: 'LOCK', padding: 0, current: 0 } });
  const r = await prisma.sequence.updateMany({ where: { id, current: { lt: now - 170 } }, data: { current: now } });
  return r.count === 1;
}
async function unlock(file: FileKey) {
  await prisma.sequence.update({ where: { id: `SYNC-LOCK-${file}` }, data: { current: 0 } }).catch(() => undefined);
}

export async function runSheetSync(file: FileKey): Promise<{ file: FileKey; ok: boolean; message: string }> {
  if (!(await lock(file))) return { file, ok: true, message: 'Another sync of this file is still running' };
  const f = SHEET_FILES[file];
  const book = new Book(f.id);
  try {
    if (f.kind === 'governance') await mirrorGovernance(await syncGovFile(book));
    else await syncTrackerFile(book, f.section, f.name);
    return { file, ok: true, message: 'Synced' };
  } catch (e) {
    const message = (e as Error).message;
    await log(book, '', `Error: ${message}`);
    return { file, ok: false, message };
  } finally {
    await unlock(file);
  }
}
