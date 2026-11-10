// src/lib/det/excel.ts
// Excel export for one section (Systems Engineering or Automation).
//
// The workbook keeps the layout of the DTC tracker Excel, so it can be read back with
// `npm run db:import -- --file <exported file>`:
//   Summary  key numbers, the Goal 4 indicator and a table per unit (formulas, so they update when the sheet is edited)
//   Data     one row per order, same columns as the tracker (A to S), then the DET fields
//   Description  description of each order (narrative, points, risks, next steps)
//   Systems  the systems register with their orders
//   Units    ELI leadership, committees, departments, centers and units
//   Change Log  every recorded change to these orders

import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma/client';
import {
  AUTOMATION_TARGETS, BUCKETS, GOV, SECTIONS, SYSTEM_STATUS, automationRate, bucketOf, nextTarget, unitGroup,
  type DbStatus, type GovStatus, type SectionKey, type SystemStatus,
} from './shared';
import { loadSystems } from './server';
import { locale, makeT, type Lang, type T } from '@/lib/i18n/core';

const TEAL = 'FF158B87', DARK = 'FF0A4542', GOLD = 'FFC9A24E', LINE = 'FFD9E5E3', SOFT = 'FFF4F8F7', MUTED = 'FF6B7F7D';
const STATUS_WORD: Record<DbStatus, string> = {
  NOT_STARTED: 'Not Started', IN_PROGRESS: 'In Progress', UNDER_REVIEW: 'Under Review', BLOCKED: 'Blocked',
  ON_HOLD: 'On Hold', DONE: 'Done', CANCELLED: 'Cancelled',
};
const STATUS_FILL: Record<string, string> = {
  'Done': 'FFE3F4EC', 'In Progress': 'FFE4F0FA', 'Under Review': 'FFE4F0FA', 'Blocked': 'FFFBE5E3',
  'On Hold': 'FFFBE5E3', 'Not Started': 'FFF0F3F2', 'Cancelled': 'FFF0F3F2',
};
const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();
/** A sheet name as used inside a formula (quoted when it is not a plain word, e.g. an Arabic name). */
const ref = (name: string) => (/^\w+$/.test(name) ? name : `'${name.replace(/'/g, "''")}'`);
/** Sheet view options; Arabic sheets read right to left. */
const view = (lang: Lang, v: Partial<ExcelJS.WorksheetView> = {}): Partial<ExcelJS.WorksheetView>[] =>
  [lang === 'ar' ? { ...v, rightToLeft: true } : v];
/** Excel sheet names: at most 31 characters, none of []:*?/\ */
const sheetName = (t: T, name: string) => t(name).replace(/[[\]:*?/\\]/g, ' ').slice(0, 31);
const today = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };

const isRtl = (ws: ExcelJS.Worksheet) => !!ws.views?.[0]?.rightToLeft;

function header(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  const start = isRtl(ws) ? 'right' : 'left';
  r.height = 30;
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    cell.alignment = { vertical: 'middle', horizontal: start, wrapText: true };
    cell.border = { bottom: { style: 'thin', color: { argb: TEAL } } };
  }
}
function grid(ws: ExcelJS.Worksheet, fromRow: number, toRow: number, cols: number) {
  for (let r = fromRow; r <= toRow; r++) {
    const row = ws.getRow(r);
    for (let c = 1; c <= cols; c++) {
      const cell = row.getCell(c);
      cell.border = { bottom: { style: 'hair', color: { argb: LINE } } };
      cell.alignment = { vertical: 'top', wrapText: true, ...(cell.alignment ?? {}) };
    }
  }
}

export async function buildSectionWorkbook(section: SectionKey, generatedBy: string, lang: Lang = 'en'): Promise<{ buffer: Buffer; fileName: string; count: number }> {
  const sec = SECTIONS[section];
  const t = makeT(lang);
  const secName = t(sec.name);
  // Sheet names (translated) and how formulas refer to them
  const SH = { sum: sheetName(t, 'Summary'), data: sheetName(t, 'Data'), desc: sheetName(t, 'Description'), sys: sheetName(t, 'Systems'), units: sheetName(t, 'Units'), log: sheetName(t, 'Change Log') };
  const DATA = ref(SH.data), UNITS = ref(SH.units);
  const [ordersRaw, units, systems] = await Promise.all([
    prisma.order.findMany({
      where: { isDeleted: false, section },
      orderBy: [{ sheetOrder: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }, { orderCode: 'asc' }],
      include: {
        unit: { select: { code: true, name: true } },
        project: { select: { code: true, name: true, isSystem: true } },
        parent: { select: { orderCode: true } },
        owner: { select: { name: true } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        description: true,
      },
    }),
    prisma.unit.findMany({ where: { isActive: true }, orderBy: [{ unitIndex: { sort: 'asc', nulls: 'last' } }, { name: 'asc' }] }),
    loadSystems(),
  ]);
  // Orders grouped by project (A to Z, no project last); the Excel order is kept inside each project.
  const orders = ordersRaw.map((o, i) => ({ o, i })).sort((a, b) => {
    const pa = a.o.project?.name ?? '', pb = b.o.project?.name ?? '';
    if (pa !== pb) return !pa ? 1 : !pb ? -1 : pa.localeCompare(pb);
    return a.i - b.i;
  }).map(x => x.o);
  const ids = orders.map(o => o.id);
  const history = ids.length ? await prisma.auditLog.findMany({
    where: { orderId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, userName: true, userEmail: true, action: true, recordCode: true, notes: true, field: true, oldValue: true, newValue: true, orderId: true },
  }) : [];
  const nameOf = new Map(orders.map(o => [o.id, o.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy;
  wb.company = t('English Language Institute, Princess Nourah bint Abdulrahman University');
  wb.title = t('Digital Enterprise Tracker: {section}', { section: secName });
  wb.created = new Date();

  const now = new Date();
  const stamp = now.toLocaleString(locale(lang), { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const t0 = today();

  /* ── Summary (first sheet) ───────────────────────────────────────────── */
  const sum = wb.addWorksheet(SH.sum, { views: view(lang, { showGridLines: false }), properties: { tabColor: { argb: TEAL } } });
  sum.columns = [{ width: 3 }, { width: 34 }, { width: 38 }, { width: 12 }, { width: 12 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 14 }];

  /* ── Data ────────────────────────────────────────────────────────────── */
  const data = wb.addWorksheet(SH.data, { views: view(lang, { state: 'frozen', xSplit: 1, ySplit: 1 }), properties: { tabColor: { argb: DARK } } });
  const DATA_COLS: [string, number][] = [
    ['Order ID', 15], ['Order Type', 11], ['Unit Code', 10], ['Unit Name', 28], ['Project Code', 11], ['Project Name', 26],
    ['Task/Subtask Name', 46], ['Parent ID (if Subtask)', 14], ['Owner / Assignee', 18], ['Priority', 9],
    ['Start Date', 12], ['Due Date', 12], ['% Complete', 11], ['Status', 13], ['Reschedule Count', 13],
    ['Dependencies', 20], ['Links / Artifacts', 24], ['Notes', 30], ['Last Updated', 17],
    // DET fields (after the tracker's columns, so the file can be imported again)
    ['Section', 18], ['Simple Status', 12], ['Late', 7], ['Governance', 14], ['Governance Note', 26],
    ['System', 26], ['Created', 17], ['Created By', 16], ['Last Updated By', 16], ['Governance Note (Arabic)', 30],
  ];
  data.columns = DATA_COLS.map(([h, w]) => ({ header: t(h), width: w }));
  header(data, 1, DATA_COLS.length);
  orders.forEach(o => {
    const word = STATUS_WORD[o.status as DbStatus];
    const late = o.status !== 'DONE' && o.status !== 'CANCELLED' && !!o.dueDate && o.dueDate < t0;
    const row = data.addRow([
      o.orderCode, t(cap(o.type)), o.unit?.code ?? null, o.unit?.name ?? null, o.project?.code ?? null, o.project?.name ?? null,
      o.name, o.parent?.orderCode ?? null, o.ownerName || o.owner?.name || null, t(cap(o.priority)),
      o.startDate, o.dueDate, o.percentComplete / 100, t(word), o.rescheduleCount,
      o.dependencies, o.links, o.notes, o.updatedAt,
      secName, t(BUCKETS[bucketOf(o.status as DbStatus)].label), late ? t('Yes') : t('No'),
      t(GOV[o.govStatus as GovStatus].label), o.govNote, o.project?.isSystem ? o.project.name : null,
      o.createdAt, o.createdBy?.name ?? null, o.updatedBy?.name ?? null, o.govNoteAr ?? null,
    ]);
    row.getCell(14).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[word] ?? SOFT } };
    if (late) { row.getCell(12).font = { color: { argb: 'FFCC3D33' }, bold: true }; row.getCell(22).font = { color: { argb: 'FFCC3D33' }, bold: true }; }
  });
  const last = Math.max(2, orders.length + 1);
  grid(data, 2, orders.length + 1, DATA_COLS.length);
  for (const c of [11, 12]) data.getColumn(c).numFmt = 'dd mmm yyyy';
  for (const c of [19, 26]) data.getColumn(c).numFmt = 'dd mmm yyyy hh:mm';
  data.getColumn(13).numFmt = '0%';
  data.getColumn(13).alignment = { horizontal: 'center', vertical: 'top' };
  data.getColumn(15).alignment = { horizontal: 'center', vertical: 'top' };
  data.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: DATA_COLS.length } };
  // Dropdowns, so edits in Excel stay valid for the next import
  const dv = (data as unknown as { dataValidations: { add: (ref: string, v: ExcelJS.DataValidation) => void } }).dataValidations;
  const LIMIT = Math.max(last + 300, 1000);
  const list = (formula: string): ExcelJS.DataValidation => ({ type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: t('Pick from the list'), error: t('Please choose a value from the list.') });
  const options = (words: string[]) => `"${words.map(w => t(w)).join(',')}"`;
  dv.add(`B2:B${LIMIT}`, list(options(['Task', 'Subtask', 'Deliverable', 'Project', 'Program'])));
  dv.add(`J2:J${LIMIT}`, list(options(['Low', 'Medium', 'High', 'Critical'])));
  dv.add(`N2:N${LIMIT}`, list(options(['Not Started', 'In Progress', 'Under Review', 'Blocked', 'On Hold', 'Done', 'Cancelled'])));
  dv.add(`C2:C${LIMIT}`, list(`${UNITS}!$A$2:$A$${units.length + 1}`));
  dv.add(`M2:M${LIMIT}`, { type: 'decimal', operator: 'between', allowBlank: true, formulae: [0, 1], showErrorMessage: true, error: t('Use a percentage from 0% to 100%.') });

  /* ── Description ────────────────────────────────────────────── */
  const desc = wb.addWorksheet(SH.desc, { views: view(lang, { state: 'frozen', xSplit: 1, ySplit: 1 }), properties: { tabColor: { argb: GOLD } } });
  // Older description fields are added only when at least one order uses them.
  const EXTRA: [keyof NonNullable<typeof orders[number]['description']>, string][] = [
    ['objective', 'Objective'], ['scope', 'Scope'], ['rationale', 'Rationale'], ['keyDeliverables', 'Key Deliverables'],
    ['institutionalImpact', 'Institutional Impact'], ['stakeholders', 'Stakeholders'], ['dependencies', 'Description Dependencies'],
    ['approvalNeeds', 'Approval Needs'], ['governanceImpact', 'Governance Impact'], ['affectedUnit', 'Affected Unit'],
    ['relatedPolicies', 'Related Policies'], ['requiredEvidence', 'Required Evidence'],
  ];
  const extras = EXTRA.filter(([k]) => orders.some(o => o.description && o.description[k]));
  const DESC_COLS: [string, number][] = [
    ['Order ID', 15], ['Unit Code', 10], ['Weekly Narrative', 60], ['Weekly Bullet', 60], ['Risks', 34], ['Next Week Plan (Brief)', 34], ['Task/Subtask Name', 40],
    ...extras.map(([, h]) => [h, 30] as [string, number]),
  ];
  desc.columns = DESC_COLS.map(([h, w]) => ({ header: t(h), width: w }));
  header(desc, 1, DESC_COLS.length);
  let descRows = 0;
  orders.forEach(o => {
    const d = o.description;
    const points = (d?.bulletSummary ?? '').split('\n').map(s => s.trim()).filter(Boolean);
    if (!d || (!d.narrativeSummary && !points.length && !d.risks && !d.nextSteps && !extras.some(([k]) => d[k]))) return;
    desc.addRow([
      o.orderCode, o.unit?.code ?? null, d.narrativeSummary, points.length ? points.map(p => `• ${p}`).join('\n') : null,
      d.risks, d.nextSteps, o.name, ...extras.map(([k]) => d[k] as string | null),
    ]);
    descRows++;
  });
  grid(desc, 2, descRows + 1, DESC_COLS.length);
  desc.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: DESC_COLS.length } };

  /* ── Systems ─────────────────────────────────────────────────────────── */
  const sys = wb.addWorksheet(SH.sys, { views: view(lang, { state: 'frozen', ySplit: 1 }) });
  const SYS_COLS: [string, number][] = [
    ['System Code', 12], ['System Name', 32], ['Type', 15], ['Unit Code', 10], ['Status', 15], ['Summary', 60],
    ['Link', 28], ['Match Words', 14], ['Include in KPI', 13], ['Orders', 9], ['Orders Done', 11],
  ];
  sys.columns = SYS_COLS.map(([h, w]) => ({ header: t(h), width: w }));
  header(sys, 1, SYS_COLS.length);
  systems.forEach(s => {
    const row = sys.addRow([s.code, s.name, t(s.type === 'ACADEMIC' ? 'Academic' : 'Administrative'), s.unitCode, t(SYSTEM_STATUS[s.status].label),
      s.summary, s.link, null, s.includeInKpi ? t('Yes') : t('No'), s.orders, s.done]);
    row.getCell(5).font = { bold: true, color: { argb: 'FF' + SYSTEM_STATUS[s.status as SystemStatus].color.slice(1) } };
  });
  grid(sys, 2, systems.length + 1, SYS_COLS.length);

  /* ── Units ───────────────────────────────────────────────────────────── */
  const un = wb.addWorksheet(SH.units, { views: view(lang, { state: 'frozen', ySplit: 1 }) });
  const UNIT_COLS: [string, number][] = [['Unit Code', 12], ['Unit Name', 46], ['Unit Index', 10], ['ColorHex', 11], ['Group', 22], [t('Orders in {section}', { section: secName }), 16]];
  un.columns = UNIT_COLS.map(([h, w]) => ({ header: t(h), width: w }));
  header(un, 1, UNIT_COLS.length);
  units.forEach((u, i) => {
    un.addRow([u.code, u.name, u.unitIndex, u.colorHex, t(unitGroup(u.name)), { formula: `COUNTIF(${DATA}!$C:$C,A${i + 2})`, result: orders.filter(o => o.unit?.code === u.code).length }]);
  });
  grid(un, 2, units.length + 1, UNIT_COLS.length);
  un.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: UNIT_COLS.length } };

  /* ── History ─────────────────────────────────────────────────────────── */
  const hi = wb.addWorksheet(SH.log, { views: view(lang, { state: 'frozen', ySplit: 1 }) });
  const HIST_COLS: [string, number][] = [['Date and Time', 18], ['Person', 20], ['Email', 26], ['Action', 14], ['Order ID', 15], ['Order', 40], ['Change', 60]];
  hi.columns = HIST_COLS.map(([h, w]) => ({ header: t(h), width: w }));
  header(hi, 1, HIST_COLS.length);
  history.forEach(h => {
    const change = h.notes || (h.field ? t('{field}: {old} to {new}', { field: h.field, old: h.oldValue ?? '', new: h.newValue ?? '' }) : '');
    hi.addRow([h.createdAt, h.userName, h.userEmail, t(cap(h.action.replace('_', ' '))), h.recordCode, h.orderId ? nameOf.get(h.orderId) ?? null : null, change]);
  });
  hi.getColumn(1).numFmt = 'dd mmm yyyy hh:mm';
  grid(hi, 2, history.length + 1, HIST_COLS.length);
  if (history.length) hi.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: HIST_COLS.length } };

  /* ── Summary content (formulas read the Data sheet) ──────────────────── */
  const count = (b: string) => orders.filter(o => STATUS_WORD[o.status as DbStatus] === b).length;
  const done = count('Done');
  const live = orders.filter(o => o.status !== 'CANCELLED');
  const late = live.filter(o => o.status !== 'DONE' && o.dueDate && o.dueDate < t0).length;
  const govNeed = orders.filter(o => o.govStatus !== 'NOT_REQUIRED').length;
  const govOk = orders.filter(o => o.govStatus === 'APPROVED').length;
  const N = `${DATA}!$N$2:$N$${LIMIT}`, L = `${DATA}!$L$2:$L$${LIMIT}`, W = `${DATA}!$W$2:$W$${LIMIT}`, A = `${DATA}!$A$2:$A$${LIMIT}`, C = `${DATA}!$C$2:$C$${LIMIT}`;
  // Text values the formulas count, in the language of the Data sheet
  const q = (word: string) => `"${t(word)}"`;

  sum.mergeCells('B2:J2'); sum.getCell('B2').value = t('Digital Enterprise Tracker');
  sum.getCell('B2').font = { bold: true, size: 20, color: { argb: DARK } };
  sum.mergeCells('B3:J3'); sum.getCell('B3').value = t('{section}: orders export', { section: secName });
  sum.getCell('B3').font = { bold: true, size: 13, color: { argb: TEAL } };
  sum.mergeCells('B4:J4'); sum.getCell('B4').value = t('Princess Nourah bint Abdulrahman University  |  English Language Institute  |  Digital Transformation Committee');
  sum.getCell('B4').font = { size: 10, color: { argb: MUTED } };
  sum.mergeCells('B5:J5'); sum.getCell('B5').value = t('Generated by {name} on {date} (Riyadh time)', { name: generatedBy, date: stamp });
  sum.getCell('B5').font = { size: 10, italic: true, color: { argb: MUTED } };
  for (let c = 2; c <= 10; c++) sum.getRow(6).getCell(c).border = { bottom: { style: 'medium', color: { argb: GOLD } } };

  const block = (row: number, title: string) => {
    sum.getCell(`B${row}`).value = t(title);
    sum.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: TEAL } };
  };
  const kv = (row: number, label: string, value: ExcelJS.CellValue, fmt?: string, note?: string) => {
    const l = sum.getCell(`B${row}`), v = sum.getCell(`C${row}`);
    l.value = label; l.font = { color: { argb: DARK } };
    v.value = value; v.font = { bold: true, size: 12, color: { argb: DARK } }; v.alignment = { horizontal: lang === 'ar' ? 'right' : 'left' };
    if (fmt) v.numFmt = fmt;
    if (note) { sum.getCell(`D${row}`).value = note; sum.getCell(`D${row}`).font = { size: 9, color: { argb: MUTED } }; }
    for (const c of ['B', 'C']) sum.getCell(`${c}${row}`).border = { bottom: { style: 'hair', color: { argb: LINE } } };
  };

  block(8, 'Key numbers');
  kv(9, t('Orders'), { formula: `COUNTA(${A})`, result: orders.length });
  kv(10, t('Done'), { formula: `COUNTIF(${N},${q('Done')})`, result: done });
  kv(11, t('In progress'), { formula: `COUNTIF(${N},${q('In Progress')})+COUNTIF(${N},${q('Under Review')})`, result: count('In Progress') + count('Under Review') });
  kv(12, t('Not started'), { formula: `COUNTIF(${N},${q('Not Started')})`, result: count('Not Started') });
  kv(13, t('Stuck'), { formula: `COUNTIF(${N},${q('Blocked')})+COUNTIF(${N},${q('On Hold')})`, result: count('Blocked') + count('On Hold') });
  kv(14, t('Late'), { formula: `COUNTIFS(${L},"<"&TODAY(),${N},"<>${t('Done')}",${N},"<>${t('Cancelled')}")`, result: late }, undefined, t('Past the due date and not done'));
  kv(15, t('Completion'), { formula: `IFERROR(C10/(C9-COUNTIF(${N},${q('Cancelled')})),0)`, result: live.length ? done / live.length : 0 }, '0%');
  kv(16, t('On time'), { formula: `IFERROR(1-C14/(C9-COUNTIF(${N},${q('Cancelled')})),0)`, result: live.length ? 1 - late / live.length : 0 }, '0%');
  kv(17, t('Governance approved'), { formula: `IFERROR(COUNTIF(${W},${q('Approved')})/(COUNTA(${W})-COUNTIF(${W},${q('Not required')})),0)`, result: govNeed ? govOk / govNeed : 0 }, '0%', t('{done} of {total} reviews', { done: govOk, total: govNeed }));
  kv(18, t('Waiting governance review'), { formula: `COUNTIF(${W},${q('Waiting review')})`, result: orders.filter(o => o.govStatus === 'PENDING').length });

  const a = automationRate(systems), nt = nextTarget();
  block(20, 'Strategic plan, Goal 4: automation of administrative and academic systems');
  kv(21, t('Actual'), a.rate / 100, '0%', t('{live} of {total} systems live', { live: a.live, total: a.total }));
  kv(22, t('Target {year}', { year: nt.year }), nt.target / 100, '0%');
  kv(23, t('Formula'), t('Live systems / all systems in scope x 100'));
  kv(24, t('Plan targets'), AUTOMATION_TARGETS.map(x => `${x.year}: ${x.target}%${x.year === 2030 ? '+' : ''}`).join('   '));

  block(26, 'Orders by unit');
  const UH = ['Unit Code', 'Unit Name', 'Orders', 'Done', 'In progress', 'Not started', 'Stuck', 'Late', 'Completion'];
  UH.forEach((h, i) => { sum.getRow(27).getCell(i + 2).value = t(h); });
  header(sum, 27, 10); sum.getRow(27).getCell(1).fill = { type: 'pattern', pattern: 'none' }; sum.getRow(27).getCell(1).border = {};
  const usedUnits = units.filter(u => orders.some(o => o.unit?.code === u.code));
  usedUnits.forEach((u, i) => {
    const r = 28 + i, U = `$B${r}`, mine = orders.filter(o => o.unit?.code === u.code);
    const c2 = (w: string) => mine.filter(o => STATUS_WORD[o.status as DbStatus] === w).length;
    const lateU = mine.filter(o => o.status !== 'DONE' && o.status !== 'CANCELLED' && o.dueDate && o.dueDate < t0).length;
    const vals: ExcelJS.CellValue[] = [
      u.code, u.name,
      { formula: `COUNTIF(${C},${U})`, result: mine.length },
      { formula: `COUNTIFS(${C},${U},${N},${q('Done')})`, result: c2('Done') },
      { formula: `COUNTIFS(${C},${U},${N},${q('In Progress')})+COUNTIFS(${C},${U},${N},${q('Under Review')})`, result: c2('In Progress') + c2('Under Review') },
      { formula: `COUNTIFS(${C},${U},${N},${q('Not Started')})`, result: c2('Not Started') },
      { formula: `COUNTIFS(${C},${U},${N},${q('Blocked')})+COUNTIFS(${C},${U},${N},${q('On Hold')})`, result: c2('Blocked') + c2('On Hold') },
      { formula: `COUNTIFS(${C},${U},${L},"<"&TODAY(),${N},"<>${t('Done')}",${N},"<>${t('Cancelled')}")`, result: lateU },
      { formula: `IFERROR(E${r}/D${r},0)`, result: mine.length ? c2('Done') / mine.length : 0 },
    ];
    vals.forEach((v, j) => {
      const cell = sum.getRow(r).getCell(j + 2);
      cell.value = v;
      cell.border = { bottom: { style: 'hair', color: { argb: LINE } } };
      if (j >= 2) cell.alignment = { horizontal: 'center' };
    });
    sum.getRow(r).getCell(10).numFmt = '0%';
  });
  const noUnit = orders.filter(o => !o.unit).length;
  let r = 28 + usedUnits.length;
  if (noUnit) {
    sum.getRow(r).getCell(3).value = t('No unit');
    sum.getRow(r).getCell(4).value = { formula: `COUNTIF(${C},"")-COUNTIF(${A},"")`, result: noUnit };
    sum.getRow(r).getCell(4).alignment = { horizontal: 'center' };
    r++;
  }

  r += 1;
  block(r, 'What is in this file'); r++;
  const guide: [string, string][] = [
    [SH.data, t('One row per order, in the tracker order. Columns A to S match the DTC tracker; the DET fields follow.')],
    [SH.desc, t('Description of each order: narrative, points, risks and next steps.')],
    [SH.sys, t('The systems behind the Goal 4 indicator, with their status and orders.')],
    [SH.units, t('ELI leadership, committees, departments, centers and units.')],
    [SH.log, t('Every recorded change to these orders: who, when and what.')],
    // The import reads the English layout, so an Arabic file says to use the English download for it
    [t('Re-import'), lang === 'en'
      ? 'This file can be loaded back with: npm run db:import -- --file "<this file>"'
      : t('To load the data back, download the English version of this file and use: npm run db:import -- --file "<this file>"')],
  ];
  guide.forEach(([k, v]) => {
    sum.getCell(`B${r}`).value = k; sum.getCell(`B${r}`).font = { bold: true, color: { argb: DARK } };
    sum.mergeCells(`C${r}:J${r}`); sum.getCell(`C${r}`).value = v; sum.getCell(`C${r}`).font = { color: { argb: MUTED } };
    r++;
  });
  sum.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
  data.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, printTitlesRow: '1:1' };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  const d = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return { buffer, fileName: `DET_${sec.name.replace(/\s+/g, '_')}_${d}.xlsx`, count: orders.length };
}


/** Governance register as an Excel workbook: Summary + Governance items. */
export async function buildGovernanceWorkbook(generatedBy: string, lang: Lang = 'en'): Promise<{ buffer: Buffer; fileName: string; count: number }> {
  const { loadGovItems } = await import('./server');
  const { GOV_ITEM_STATUS, GOV_ITEM_TYPE, GOV_SCOPE, govOverdue } = await import('./shared');
  const items = await loadGovItems();
  const t = makeT(lang);
  const wb = new ExcelJS.Workbook();
  wb.creator = t('Digital Enterprise Tracker');
  wb.created = new Date();

  // Summary
  const s = wb.addWorksheet(sheetName(t, 'Summary'), { views: view(lang, { showGridLines: false }) });
  s.columns = [{ width: 34 }, { width: 16 }];
  s.getCell('A1').value = t('Governance register');
  s.getCell('A1').font = { bold: true, size: 16, color: { argb: DARK } };
  s.getCell('A2').value = t('Downloaded by {name} on {date}', { name: generatedBy, date: new Date().toISOString().slice(0, 10) });
  s.getCell('A2').font = { color: { argb: MUTED }, size: 10 };
  const approved = items.filter(i => i.status === 'APPROVED').length;
  const overdue = items.filter(i => govOverdue(i)).length;
  const rows: [string, number][] = [
    [t('Governance items'), items.length],
    [t('Project items'), items.filter(i => i.scope === 'PROJECT').length],
    [t('Unit items'), items.filter(i => i.scope === 'UNIT').length],
    [t('Approved'), approved],
    [t('Reviews overdue'), overdue],
  ];
  for (const k of Object.keys(GOV_ITEM_STATUS) as (keyof typeof GOV_ITEM_STATUS)[]) {
    rows.push([t('Status: {status}', { status: t(GOV_ITEM_STATUS[k].label) }), items.filter(i => i.status === k).length]);
  }
  s.getCell('A4').value = t('Measure'); s.getCell('B4').value = t('Count');
  header(s, 4, 2);
  rows.forEach(([a, b], i) => { s.getCell(`A${5 + i}`).value = a; s.getCell(`B${5 + i}`).value = b; });
  grid(s, 5, 4 + rows.length, 2);

  // Items
  const ws = wb.addWorksheet(sheetName(t, 'Governance'), { views: view(lang, { state: 'frozen', ySplit: 1 }) });
  const cols: [string, number][] = [
    ['Item ID', 11], ['About', 10], ['Project or unit', 30], ['Governance item', 44], ['Governance item (Arabic)', 44], ['Type', 18], ['Owner', 20],
    ['Status', 14], ['Due', 12], ['Last review', 12], ['Next review', 12], ['Evidence', 36], ['Notes', 40], ['Notes (Arabic)', 40],
  ];
  ws.columns = cols.map(([h, w]) => ({ header: t(h), width: w }));
  header(ws, 1, cols.length);
  const d = (v: string | null) => (v ? new Date(`${v}T00:00:00Z`) : null);
  for (const g of items) {
    const where = g.scope === 'PROJECT'
      ? [g.projectCode, g.projectName].filter(Boolean).join(' ')
      : [g.unitCode, g.unitName].filter(Boolean).join(' ');
    const r = ws.addRow([
      g.code, t(GOV_SCOPE[g.scope]), where, g.title === g.titleAr ? '' : g.title, g.titleAr, t(GOV_ITEM_TYPE[g.type]), g.owner,
      t(GOV_ITEM_STATUS[g.status].label), d(g.due), d(g.lastReview), d(g.nextReview), g.evidence, g.notes, g.notesAr,
    ]);
    for (const c of [9, 10, 11]) r.getCell(c).numFmt = 'yyyy-mm-dd';
    for (const c of [5, 14]) r.getCell(c).alignment = { horizontal: 'right', readingOrder: 'rtl', wrapText: true };
    if (govOverdue(g)) r.getCell(11).font = { color: { argb: 'FFC0392B' }, bold: true };
    if (g.status === 'APPROVED') r.getCell(8).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE3F4EC' } };
  }
  grid(ws, 2, items.length + 1, cols.length);
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };

  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, fileName: `DET-Governance-${new Date().toISOString().slice(0, 10)}.xlsx`, count: items.length };
}
