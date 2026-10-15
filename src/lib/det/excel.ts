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
const today = () => { const d = new Date(); return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); };

function header(ws: ExcelJS.Worksheet, row: number, cols: number) {
  const r = ws.getRow(row);
  r.height = 30;
  for (let c = 1; c <= cols; c++) {
    const cell = r.getCell(c);
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: DARK } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
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

export async function buildSectionWorkbook(section: SectionKey, generatedBy: string): Promise<{ buffer: Buffer; fileName: string; count: number }> {
  const sec = SECTIONS[section];
  const [orders, units, systems] = await Promise.all([
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
  const ids = orders.map(o => o.id);
  const history = ids.length ? await prisma.auditLog.findMany({
    where: { orderId: { in: ids } },
    orderBy: { createdAt: 'desc' },
    select: { createdAt: true, userName: true, userEmail: true, action: true, recordCode: true, notes: true, field: true, oldValue: true, newValue: true, orderId: true },
  }) : [];
  const nameOf = new Map(orders.map(o => [o.id, o.name]));

  const wb = new ExcelJS.Workbook();
  wb.creator = generatedBy;
  wb.company = 'English Language Institute, Princess Nourah bint Abdulrahman University';
  wb.title = `DTC Enterprise Tracker: ${sec.name}`;
  wb.created = new Date();

  const now = new Date();
  const stamp = now.toLocaleString('en-GB', { timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const t0 = today();

  /* ── Summary (first sheet) ───────────────────────────────────────────── */
  const sum = wb.addWorksheet('Summary', { views: [{ showGridLines: false }], properties: { tabColor: { argb: TEAL } } });
  sum.columns = [{ width: 3 }, { width: 34 }, { width: 38 }, { width: 12 }, { width: 12 }, { width: 13 }, { width: 13 }, { width: 11 }, { width: 11 }, { width: 14 }];

  /* ── Data ────────────────────────────────────────────────────────────── */
  const data = wb.addWorksheet('Data', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }], properties: { tabColor: { argb: DARK } } });
  const DATA_COLS: [string, number][] = [
    ['Order ID', 15], ['Order Type', 11], ['Unit Code', 10], ['Unit Name', 28], ['Project Code', 11], ['Project Name', 26],
    ['Task/Subtask Name', 46], ['Parent ID (if Subtask)', 14], ['Owner / Assignee', 18], ['Priority', 9],
    ['Start Date', 12], ['Due Date', 12], ['% Complete', 11], ['Status', 13], ['Reschedule Count', 13],
    ['Dependencies', 20], ['Links / Artifacts', 24], ['Notes', 30], ['Last Updated', 17],
    // DET fields (after the tracker's columns, so the file can be imported again)
    ['Section', 18], ['Simple Status', 12], ['Late', 7], ['Governance', 14], ['Governance Note', 26],
    ['System', 26], ['Created', 17], ['Created By', 16], ['Last Updated By', 16],
  ];
  data.columns = DATA_COLS.map(([h, w]) => ({ header: h, width: w }));
  header(data, 1, DATA_COLS.length);
  orders.forEach(o => {
    const word = STATUS_WORD[o.status as DbStatus];
    const late = o.status !== 'DONE' && o.status !== 'CANCELLED' && !!o.dueDate && o.dueDate < t0;
    const row = data.addRow([
      o.orderCode, cap(o.type), o.unit?.code ?? null, o.unit?.name ?? null, o.project?.code ?? null, o.project?.name ?? null,
      o.name, o.parent?.orderCode ?? null, o.ownerName || o.owner?.name || null, cap(o.priority),
      o.startDate, o.dueDate, o.percentComplete / 100, word, o.rescheduleCount,
      o.dependencies, o.links, o.notes, o.updatedAt,
      sec.name, BUCKETS[bucketOf(o.status as DbStatus)].label, late ? 'Yes' : 'No',
      GOV[o.govStatus as GovStatus].label, o.govNote, o.project?.isSystem ? o.project.name : null,
      o.createdAt, o.createdBy?.name ?? null, o.updatedBy?.name ?? null,
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
  const list = (formula: string): ExcelJS.DataValidation => ({ type: 'list', allowBlank: true, formulae: [formula], showErrorMessage: true, errorTitle: 'Pick from the list', error: 'Please choose a value from the list.' });
  dv.add(`B2:B${LIMIT}`, list('"Task,Subtask,Deliverable,Project,Program"'));
  dv.add(`J2:J${LIMIT}`, list('"Low,Medium,High,Critical"'));
  dv.add(`N2:N${LIMIT}`, list('"Not Started,In Progress,Under Review,Blocked,On Hold,Done,Cancelled"'));
  dv.add(`C2:C${LIMIT}`, list(`Units!$A$2:$A$${units.length + 1}`));
  dv.add(`M2:M${LIMIT}`, { type: 'decimal', operator: 'between', allowBlank: true, formulae: [0, 1], showErrorMessage: true, error: 'Use a percentage from 0% to 100%.' });

  /* ── Description ────────────────────────────────────────────── */
  const desc = wb.addWorksheet('Description', { views: [{ state: 'frozen', xSplit: 1, ySplit: 1 }], properties: { tabColor: { argb: GOLD } } });
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
  desc.columns = DESC_COLS.map(([h, w]) => ({ header: h, width: w }));
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
  const sys = wb.addWorksheet('Systems', { views: [{ state: 'frozen', ySplit: 1 }] });
  const SYS_COLS: [string, number][] = [
    ['System Code', 12], ['System Name', 32], ['Type', 15], ['Unit Code', 10], ['Status', 15], ['Summary', 60],
    ['Link', 28], ['Match Words', 14], ['Include in KPI', 13], ['Orders', 9], ['Orders Done', 11],
  ];
  sys.columns = SYS_COLS.map(([h, w]) => ({ header: h, width: w }));
  header(sys, 1, SYS_COLS.length);
  systems.forEach(s => {
    const row = sys.addRow([s.code, s.name, s.type === 'ACADEMIC' ? 'Academic' : 'Administrative', s.unitCode, SYSTEM_STATUS[s.status].label,
      s.summary, s.link, null, s.includeInKpi ? 'Yes' : 'No', s.orders, s.done]);
    row.getCell(5).font = { bold: true, color: { argb: 'FF' + SYSTEM_STATUS[s.status as SystemStatus].color.slice(1) } };
  });
  grid(sys, 2, systems.length + 1, SYS_COLS.length);

  /* ── Units ───────────────────────────────────────────────────────────── */
  const un = wb.addWorksheet('Units', { views: [{ state: 'frozen', ySplit: 1 }] });
  const UNIT_COLS: [string, number][] = [['Unit Code', 12], ['Unit Name', 46], ['Unit Index', 10], ['ColorHex', 11], ['Group', 22], [`Orders in ${sec.name}`, 16]];
  un.columns = UNIT_COLS.map(([h, w]) => ({ header: h, width: w }));
  header(un, 1, UNIT_COLS.length);
  units.forEach((u, i) => {
    un.addRow([u.code, u.name, u.unitIndex, u.colorHex, unitGroup(u.name), { formula: `COUNTIF(Data!$C:$C,A${i + 2})`, result: orders.filter(o => o.unit?.code === u.code).length }]);
  });
  grid(un, 2, units.length + 1, UNIT_COLS.length);
  un.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: UNIT_COLS.length } };

  /* ── History ─────────────────────────────────────────────────────────── */
  const hi = wb.addWorksheet('Change Log', { views: [{ state: 'frozen', ySplit: 1 }] });
  const HIST_COLS: [string, number][] = [['Date and Time', 18], ['Person', 20], ['Email', 26], ['Action', 14], ['Order ID', 15], ['Order', 40], ['Change', 60]];
  hi.columns = HIST_COLS.map(([h, w]) => ({ header: h, width: w }));
  header(hi, 1, HIST_COLS.length);
  history.forEach(h => {
    const change = h.notes || (h.field ? `${h.field}: ${h.oldValue ?? ''} to ${h.newValue ?? ''}` : '');
    hi.addRow([h.createdAt, h.userName, h.userEmail, cap(h.action.replace('_', ' ')), h.recordCode, h.orderId ? nameOf.get(h.orderId) ?? null : null, change]);
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
  const N = `Data!$N$2:$N$${LIMIT}`, L = `Data!$L$2:$L$${LIMIT}`, W = `Data!$W$2:$W$${LIMIT}`, A = `Data!$A$2:$A$${LIMIT}`, C = `Data!$C$2:$C$${LIMIT}`;

  sum.mergeCells('B2:J2'); sum.getCell('B2').value = 'DTC Enterprise Tracker';
  sum.getCell('B2').font = { bold: true, size: 20, color: { argb: DARK } };
  sum.mergeCells('B3:J3'); sum.getCell('B3').value = `${sec.name}: orders export`;
  sum.getCell('B3').font = { bold: true, size: 13, color: { argb: TEAL } };
  sum.mergeCells('B4:J4'); sum.getCell('B4').value = 'Princess Nourah bint Abdulrahman University  |  English Language Institute  |  Digital Transformation Committee';
  sum.getCell('B4').font = { size: 10, color: { argb: MUTED } };
  sum.mergeCells('B5:J5'); sum.getCell('B5').value = `Generated by ${generatedBy} on ${stamp} (Riyadh time)`;
  sum.getCell('B5').font = { size: 10, italic: true, color: { argb: MUTED } };
  for (let c = 2; c <= 10; c++) sum.getRow(6).getCell(c).border = { bottom: { style: 'medium', color: { argb: GOLD } } };

  const block = (row: number, title: string) => {
    sum.getCell(`B${row}`).value = title;
    sum.getCell(`B${row}`).font = { bold: true, size: 12, color: { argb: TEAL } };
  };
  const kv = (row: number, label: string, value: ExcelJS.CellValue, fmt?: string, note?: string) => {
    const l = sum.getCell(`B${row}`), v = sum.getCell(`C${row}`);
    l.value = label; l.font = { color: { argb: DARK } };
    v.value = value; v.font = { bold: true, size: 12, color: { argb: DARK } }; v.alignment = { horizontal: 'left' };
    if (fmt) v.numFmt = fmt;
    if (note) { sum.getCell(`D${row}`).value = note; sum.getCell(`D${row}`).font = { size: 9, color: { argb: MUTED } }; }
    for (const c of ['B', 'C']) sum.getCell(`${c}${row}`).border = { bottom: { style: 'hair', color: { argb: LINE } } };
  };

  block(8, 'Key numbers');
  kv(9, 'Orders', { formula: `COUNTA(${A})`, result: orders.length });
  kv(10, 'Done', { formula: `COUNTIF(${N},"Done")`, result: done });
  kv(11, 'In progress', { formula: `COUNTIF(${N},"In Progress")+COUNTIF(${N},"Under Review")`, result: count('In Progress') + count('Under Review') });
  kv(12, 'Not started', { formula: `COUNTIF(${N},"Not Started")`, result: count('Not Started') });
  kv(13, 'Stuck', { formula: `COUNTIF(${N},"Blocked")+COUNTIF(${N},"On Hold")`, result: count('Blocked') + count('On Hold') });
  kv(14, 'Late', { formula: `COUNTIFS(${L},"<"&TODAY(),${N},"<>Done",${N},"<>Cancelled")`, result: late }, undefined, 'Past the due date and not done');
  kv(15, 'Completion', { formula: `IFERROR(C10/(C9-COUNTIF(${N},"Cancelled")),0)`, result: live.length ? done / live.length : 0 }, '0%');
  kv(16, 'On time', { formula: `IFERROR(1-C14/(C9-COUNTIF(${N},"Cancelled")),0)`, result: live.length ? 1 - late / live.length : 0 }, '0%');
  kv(17, 'Governance approved', { formula: `IFERROR(COUNTIF(${W},"Approved")/(COUNTA(${W})-COUNTIF(${W},"Not required")),0)`, result: govNeed ? govOk / govNeed : 0 }, '0%', `${govOk} of ${govNeed} reviews`);
  kv(18, 'Waiting governance review', { formula: `COUNTIF(${W},"Waiting review")`, result: orders.filter(o => o.govStatus === 'PENDING').length });

  const a = automationRate(systems), t = nextTarget();
  block(20, 'Strategic plan, Goal 4: automation of administrative and academic systems');
  kv(21, 'Actual', a.rate / 100, '0%', `${a.live} of ${a.total} systems live`);
  kv(22, `Target ${t.year}`, t.target / 100, '0%');
  kv(23, 'Formula', 'Live systems / all systems in scope x 100');
  kv(24, 'Plan targets', AUTOMATION_TARGETS.map(x => `${x.year}: ${x.target}%${x.year === 2030 ? '+' : ''}`).join('   '));

  block(26, 'Orders by unit');
  const UH = ['Unit Code', 'Unit Name', 'Orders', 'Done', 'In progress', 'Not started', 'Stuck', 'Late', 'Completion'];
  UH.forEach((h, i) => { sum.getRow(27).getCell(i + 2).value = h; });
  header(sum, 27, 10); sum.getRow(27).getCell(1).fill = { type: 'pattern', pattern: 'none' }; sum.getRow(27).getCell(1).border = {};
  const usedUnits = units.filter(u => orders.some(o => o.unit?.code === u.code));
  usedUnits.forEach((u, i) => {
    const r = 28 + i, U = `$B${r}`, mine = orders.filter(o => o.unit?.code === u.code);
    const c2 = (w: string) => mine.filter(o => STATUS_WORD[o.status as DbStatus] === w).length;
    const lateU = mine.filter(o => o.status !== 'DONE' && o.status !== 'CANCELLED' && o.dueDate && o.dueDate < t0).length;
    const vals: ExcelJS.CellValue[] = [
      u.code, u.name,
      { formula: `COUNTIF(${C},${U})`, result: mine.length },
      { formula: `COUNTIFS(${C},${U},${N},"Done")`, result: c2('Done') },
      { formula: `COUNTIFS(${C},${U},${N},"In Progress")+COUNTIFS(${C},${U},${N},"Under Review")`, result: c2('In Progress') + c2('Under Review') },
      { formula: `COUNTIFS(${C},${U},${N},"Not Started")`, result: c2('Not Started') },
      { formula: `COUNTIFS(${C},${U},${N},"Blocked")+COUNTIFS(${C},${U},${N},"On Hold")`, result: c2('Blocked') + c2('On Hold') },
      { formula: `COUNTIFS(${C},${U},${L},"<"&TODAY(),${N},"<>Done",${N},"<>Cancelled")`, result: lateU },
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
    sum.getRow(r).getCell(3).value = 'No unit';
    sum.getRow(r).getCell(4).value = { formula: `COUNTIF(${C},"")-COUNTIF(${A},"")`, result: noUnit };
    sum.getRow(r).getCell(4).alignment = { horizontal: 'center' };
    r++;
  }

  r += 1;
  block(r, 'What is in this file'); r++;
  const guide: [string, string][] = [
    ['Data', 'One row per order, in the tracker order. Columns A to S match the DTC tracker; the DET fields follow.'],
    ['Description', 'Description of each order: narrative, points, risks and next steps.'],
    ['Systems', 'The systems behind the Goal 4 indicator, with their status and orders.'],
    ['Units', 'ELI leadership, committees, departments, centers and units.'],
    ['Change Log', 'Every recorded change to these orders: who, when and what.'],
    ['Re-import', 'This file can be loaded back with: npm run db:import -- --file "<this file>"'],
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

