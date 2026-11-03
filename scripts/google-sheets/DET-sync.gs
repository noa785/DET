/**
 * DET sync for Google Sheets: Systems Engineering, Automation and Governance.
 * Paste this file into Extensions > Apps Script of ONE of the three files, paste the token into CONFIG, run "setup" once.
 * Every 5 minutes it sends the cells changed in each sheet to DET, then writes back what changed in DET.
 * Fill in either place: changes merge cell by cell, so an edit on the website and an edit in the sheet to
 * different cells of the same row both stay. Only when the very same cell changed in both places within the
 * same 5 minutes does the sheet win. A cell typed while a sync is running is never overwritten (it goes next run).
 * Delete on the website: the row is then struck through here. A row deleted in the sheet comes back.
 */
const CONFIG = {
  DET_URL: 'https://eli-det.vercel.app/api/sync',
  TOKEN: 'PASTE_THE_SYNC_TOKEN_HERE',
  SHEETS: [
    // The tracker files: same tabs as the DET export (Summary, Data, Description, Systems, Units, Change Log).
    { id: '1E-rAdVAxTLdEbpHCeToHthqEIIEQXze6o19BHaRlP0Q', kind: 'orders', section: 'SYSTEMS_ENGINEERING', layout: 'tracker' },   // DET_Systems_Engineering_2026-11-01
    { id: '1euU4Lr-hIAm1zvGdKtGnhJ-Sn6cbn8JGhdxnAEaxCU0', kind: 'orders', section: 'AUTOMATION', layout: 'tracker' },            // DET_Automation
    { id: '15LF46ihd6vh2hCDbqJ0kW7RRJ20OUCSmbTAKkEywqD8', kind: 'governance' },                                                  // DET - Governance
  ],
};

const COLS = {
  orders: ['Order ID', 'Project', 'Order', 'Responsible', 'Unit', 'Start date', 'Due date', 'Progress %', 'Status', 'Governance', 'Description', 'Narrative'],
  governance: ['Item ID', 'About', 'Project or unit', 'Governance item', 'Type', 'Owner', 'Status', 'Due date', 'Last review', 'Next review', 'Evidence link', 'Notes'],
};
const TAB = { orders: 'Orders', governance: 'Governance' };
const DATE_COLS = ['Start date', 'Due date', 'Last review', 'Next review'];
const SECTION_NAME = { SYSTEMS_ENGINEERING: 'Systems Engineering', AUTOMATION: 'Automation' };

/** Run once: creates the 5-minute timer and runs a first sync. */
function setup() {
  ScriptApp.getProjectTriggers().filter(t => t.getHandlerFunction() === 'syncAll').forEach(t => ScriptApp.deleteTrigger(t));
  ScriptApp.newTrigger('syncAll').timeBased().everyMinutes(5).create();
  syncAll();
}

/** Adds a DET menu to the sheet this script lives in. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('DET')
    .addItem('Sync now', 'syncAll')
    .addToUi();
}

function syncAll() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;            // another run is still working
  try { CONFIG.SHEETS.forEach(s => { try { s.layout === 'tracker' ? syncTracker(s) : syncOne(s); } catch (e) { log(s, '', 'Error: ' + e.message); } }); }
  finally { lock.releaseLock(); }
}

/** Sends the changed rows (at most 60 per run) and returns DET's answer. */
function post(cfg, rows) {
  const res = UrlFetchApp.fetch(CONFIG.DET_URL, {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-det-sync-token': CONFIG.TOKEN },
    payload: JSON.stringify({ kind: cfg.kind, section: cfg.section, rows: rows }),
  });
  if (res.getResponseCode() !== 200) throw new Error('DET answered ' + res.getResponseCode() + ': ' + res.getContentText().slice(0, 200));
  return JSON.parse(res.getContentText()).data;
}

/* ── Simple sheet (Automation, Governance): one tab, fixed columns, hidden Sync column ── */
function syncOne(cfg) {
  const ss = SpreadsheetApp.openById(cfg.id);
  const tz = ss.getSpreadsheetTimeZone();
  const sh = ss.getSheetByName(TAB[cfg.kind]);
  if (!sh) throw new Error('Tab "' + TAB[cfg.kind] + '" not found');
  const cols = COLS[cfg.kind], n = cols.length, width = n + 1;
  const last = sh.getLastRow();
  const data = last > 1 ? sh.getRange(2, 1, last - 1, width).getValues() : [];
  const orig = data.map(r => r.slice());

  // 1. Cells that changed in the sheet since the last sync (compared with the copy kept in the hidden Sync column).
  //    A row with an ID but nothing in Sync has never been synced: DET's copy is taken as it is.
  const changed = [];
  data.forEach((r, i) => {
    const values = toValues(cols, r, tz);
    if (cols.slice(1).every(c => values[c] === '')) return;   // empty row
    const saved = String(r[n]);
    if (values[cols[0]] && saved === '') return;               // first sync of an existing record
    const fields = changedFields(values, saved);
    if (fields.length) changed.push({ key: String(i + 2), values: values, fields: fields });
  });
  const sent = changed.slice(0, 60);
  const waiting = {};
  changed.slice(60).forEach(c => { waiting[c.key] = true; });

  // 2. Send them; DET answers with every record.
  const out = post(cfg, sent);
  Object.keys(out.ids).forEach(key => { const r = data[Number(key) - 2]; if (r) r[0] = out.ids[key]; });
  const byId = {};
  out.snapshot.forEach(v => { byId[v[cols[0]]] = v; });
  const failed = {}, gone = {};
  out.errors.forEach(e => { failed[e.key] = true; log(cfg, e.key, e.message); });
  (out.deleted || []).forEach(k => { gone[k] = true; });

  // 3. Put DET's values in the rows (changes made on the website) and keep the synced copy.
  const struck = [], unstruck = [];
  data.forEach((r, i) => {
    const key = String(i + 2), id = String(r[0] || ''), saved = String(r[n]);
    if (!id) return;
    const fresh = byId[id];
    delete byId[id];
    if (gone[key] || (!fresh && saved !== '' && saved !== 'edited' && saved !== 'DELETED' && !failed[key] && !waiting[key])) {
      r[n] = 'DELETED'; struck.push(i); return;                 // deleted on the website
    }
    if (failed[key] || waiting[key]) return;
    if (!fresh) { if (saved === '') r[n] = 'edited'; return; }  // typed ID that DET does not have yet: send it next run
    cols.forEach((c, j) => { r[j] = cell(c, fresh[c]); });
    r[n] = JSON.stringify(pick(cols, fresh));
    if (saved === 'DELETED') unstruck.push(i);
  });
  const skipped = safeWrite(sh, 2, width, orig, data, tz);
  struck.forEach(i => { if (!skipped[i]) sh.getRange(i + 2, 1, 1, n).setFontLine('line-through').setFontColor('#9AA5A4'); });
  unstruck.forEach(i => { if (!skipped[i]) sh.getRange(i + 2, 1, 1, n).setFontLine('none').setFontColor(null); });

  // Records added on the website that the sheet does not have yet go at the end.
  const extra = Object.keys(byId).map(id => byId[id]);
  if (extra.length) {
    const start = sh.getLastRow() + 1;
    sh.getRange(start, 1, extra.length, width).setValues(extra.map(v => cols.map(c => cell(c, v[c])).concat([JSON.stringify(pick(cols, v))])));
  }
  refreshLists(ss, out.lists, cfg.kind);
  if (cfg.kind === 'governance') mirrorGovernance(out.snapshot);
  const later = Object.keys(skipped).length;
  if (sent.length || extra.length || out.errors.length || struck.length || later) log(cfg, '', 'Synced: ' + sent.length + ' sent' + (changed.length > sent.length ? ' (' + (changed.length - sent.length) + ' next run)' : '') + ', ' + extra.length + ' added from DET, ' + struck.length + ' deleted on the website, ' + later + ' typed during the sync (next run), ' + out.errors.length + ' problems');
}

/* ── Tracker file (Systems Engineering): the DET export layout, tabs Data and Description ── */
// Data tab header -> DET field. Other columns of the file stay as they are.
const T_DATA = {
  'Order ID': 'Order ID', 'Project Name': 'Project', 'Task/Subtask Name': 'Order', 'Owner / Assignee': 'Responsible',
  'Unit Code': 'Unit', 'Start Date': 'Start date', 'Due Date': 'Due date', '% Complete': 'Progress %', 'Status': 'Status', 'Governance': 'Governance',
};
const T_DESC = { 'Weekly Bullet': 'Description', 'Weekly Narrative': 'Narrative' };

function syncTracker(cfg) {
  const ss = SpreadsheetApp.openById(cfg.id);
  const tz = ss.getSpreadsheetTimeZone();
  const dsh = ss.getSheetByName('Data'), esh = ss.getSheetByName('Description');
  if (!dsh || !esh) throw new Error('Tabs "Data" and "Description" are needed');

  // Data tab, with the hidden Sync column added at the end the first time.
  let dw = dsh.getLastColumn();
  let dh = dsh.getRange(1, 1, 1, dw).getValues()[0].map(String);
  if (dh.indexOf('Sync') < 0) { dsh.getRange(1, dw + 1).setValue('Sync'); dsh.hideColumns(dw + 1); dw += 1; dh.push('Sync'); }
  const D = {}; dh.forEach((h, j) => { D[h.trim()] = j; });
  ['Order ID', 'Project Name', 'Task/Subtask Name', 'Status', 'Sync'].forEach(h => { if (D[h] === undefined) throw new Error('Data tab: column "' + h + '" not found'); });
  const dLast = dsh.getLastRow();
  const data = dLast > 1 ? dsh.getRange(2, 1, dLast - 1, dw).getValues() : [];
  const dOrig = data.map(r => r.slice());

  const ew = esh.getLastColumn();
  const eh = esh.getRange(1, 1, 1, ew).getValues()[0].map(String);
  const E = {}; eh.forEach((h, j) => { E[h.trim()] = j; });
  const eLast = esh.getLastRow();
  const desc = eLast > 1 ? esh.getRange(2, 1, eLast - 1, ew).getValues() : [];
  const eOrig = desc.map(r => r.slice());
  const descOf = {}, descByName = {};
  desc.forEach(r => {
    const id = String(r[E['Order ID']] || '').trim();
    if (id) descOf[id] = r;
    else if (E['Task/Subtask Name'] !== undefined && r[E['Task/Subtask Name']]) descByName[String(r[E['Task/Subtask Name']]).trim().toLowerCase()] = r;
  });
  const descFor = r => {
    const id = String(r[D['Order ID']] || '').trim();
    return id ? descOf[id] : descByName[String(r[D['Task/Subtask Name']] || '').trim().toLowerCase()];
  };
  const read = r => trackerValues(r, descFor(r), D, E, tz);

  // 1. Changed rows.
  const changed = [];
  data.forEach((r, i) => {
    const values = read(r);
    if (!values['Order'] && !values['Order ID']) return;
    const saved = String(r[D['Sync']] || '');
    if (values['Order ID'] && saved === '') return;            // first sync of an existing order: DET's copy is taken
    const fields = changedFields(values, saved);
    if (fields.length) changed.push({ key: String(i + 2), values: values, fields: fields });
  });
  const sent = changed.slice(0, 60);
  const waiting = {};
  changed.slice(60).forEach(c => { waiting[c.key] = true; });

  // 2. Send.
  const out = post(cfg, sent);
  Object.keys(out.ids).forEach(key => {
    const r = data[Number(key) - 2];
    if (!r || String(r[D['Order ID']]) === out.ids[key]) return;
    const d = descFor(r);
    r[D['Order ID']] = out.ids[key];
    if (d && !String(d[E['Order ID']] || '')) { d[E['Order ID']] = out.ids[key]; descOf[out.ids[key]] = d; }
  });
  const byId = {};
  out.snapshot.forEach(v => { byId[v['Order ID']] = v; });
  const failed = {}, gone = {};
  out.errors.forEach(e => { failed[e.key] = true; log(cfg, e.key, e.message); });
  (out.deleted || []).forEach(k => { gone[k] = true; });

  // 3. Write DET's values into the file (only the columns DET owns), and remember the hash.
  const newDesc = [];
  const apply = (r, v) => {
    setIf(r, D, 'Order ID', v['Order ID']);
    setIf(r, D, 'Project Code', v['Project code']); setIf(r, D, 'Project Name', v['Project']);
    setIf(r, D, 'Task/Subtask Name', v['Order']); setIf(r, D, 'Owner / Assignee', v['Responsible']);
    setIf(r, D, 'Unit Code', v['Unit code']); setIf(r, D, 'Unit Name', v['Unit']);
    setIf(r, D, 'Start Date', v['Start date'] || ''); setIf(r, D, 'Due Date', v['Due date'] || '');
    setIf(r, D, '% Complete', (Number(v['Progress %']) || 0) / 100);
    setIf(r, D, 'Status', v['Status detail'] || v['Status']); setIf(r, D, 'Simple Status', v['Status']);
    setIf(r, D, 'Governance', v['Governance']); setIf(r, D, 'Late', v['Late']);
    const bullets = String(v['Description'] || '').split('\n').filter(String).map(x => '• ' + x).join('\n');
    let d = descOf[v['Order ID']];
    if (!d && (bullets || v['Narrative'])) { d = eh.map(() => ''); newDesc.push(d); descOf[v['Order ID']] = d; }
    if (d) {
      setIf(d, E, 'Order ID', v['Order ID']); setIf(d, E, 'Unit Code', v['Unit code']); setIf(d, E, 'Task/Subtask Name', v['Order']);
      setIf(d, E, 'Weekly Bullet', bullets); setIf(d, E, 'Weekly Narrative', v['Narrative'] || '');
    }
    r[D['Sync']] = JSON.stringify(trackerValues(r, d, D, E, tz));
  };
  const struck = [], unstruck = [];
  data.forEach((r, i) => {
    const key = String(i + 2), id = String(r[D['Order ID']] || ''), saved = String(r[D['Sync']] || '');
    if (!id) return;
    const fresh = byId[id];
    delete byId[id];
    if (gone[key] || (!fresh && saved !== '' && saved !== 'edited' && saved !== 'DELETED' && !failed[key] && !waiting[key])) {
      r[D['Sync']] = 'DELETED'; struck.push(i); return;         // deleted on the website
    }
    if (failed[key] || waiting[key]) return;
    if (!fresh) { if (saved === '') r[D['Sync']] = 'edited'; return; }   // typed ID that DET does not have yet: send it next run
    apply(r, fresh);
    if (saved === 'DELETED') unstruck.push(i);
  });
  const extra = Object.keys(byId).map(id => byId[id]);
  extra.forEach(v => {
    const r = dh.map(() => '');
    setIf(r, D, 'Order Type', 'Task'); setIf(r, D, 'Section', SECTION_NAME[cfg.section] || '');
    apply(r, v);
    data.push(r);
  });
  // Only the rows that really change are written, and never a row someone typed in while this sync was running.
  const base = dOrig.length;
  const skipped = safeWrite(dsh, 2, dw, dOrig, data.slice(0, base), tz);
  struck.forEach(i => { if (!skipped[i]) dsh.getRange(i + 2, 1, 1, dw - 1).setFontLine('line-through').setFontColor('#9AA5A4'); });
  unstruck.forEach(i => { if (!skipped[i]) dsh.getRange(i + 2, 1, 1, dw - 1).setFontLine('none').setFontColor(null); });
  const added = data.slice(base);
  if (added.length) dsh.getRange(dsh.getLastRow() + 1, 1, added.length, dw).setValues(added);
  const eSkipped = safeWrite(esh, 2, ew, eOrig, desc, tz);
  if (newDesc.length) esh.getRange(esh.getLastRow() + 1, 1, newDesc.length, ew).setValues(newDesc);
  const later = Object.keys(skipped).length + Object.keys(eSkipped).length;
  if (sent.length || extra.length || out.errors.length || struck.length || later) log(cfg, '', 'Synced: ' + sent.length + ' sent' + (changed.length > sent.length ? ' (' + (changed.length - sent.length) + ' next run)' : '') + ', ' + extra.length + ' added from DET, ' + struck.length + ' deleted on the website, ' + later + ' typed during the sync (next run), ' + out.errors.length + ' problems');
}

/**
 * Keeps the data governance views in step (runs after the Governance file sync):
 *  - in each tracker file, the "Data Governance" tab: section 2 (log built from the Data Governance column of the
 *    Description tab) and section 3 (governance items of the file's projects). Section 1 is written by hand.
 *  - in the Governance file, the "Team Updates" tab: the same log from every tracker file, for the Governance Officer.
 */
function mirrorGovernance(items) {
  const all = [];
  CONFIG.SHEETS.filter(c => c.layout === 'tracker').forEach(c => {
    try {
      const ss = SpreadsheetApp.openById(c.id), tz = ss.getSpreadsheetTimeZone();
      const tab = ss.getSheetByName('Data Governance'), data = ss.getSheetByName('Data'), desc = ss.getSheetByName('Description');
      if (!data || data.getLastRow() < 2) return;
      const D = headerIndex(data), dv = data.getRange(2, 1, data.getLastRow() - 1, data.getLastColumn()).getValues();
      const byId = {}, mine = {};
      dv.forEach(r => {
        const id = String(r[D['Order ID']] || '').trim(), pj = String(r[D['Project Name']] || '').trim();
        if (pj) mine[pj.toLowerCase()] = true;
        if (id) byId[id] = r;
      });
      // Section 2: one line per task that has a Data Governance note in the Description tab.
      const updates = [];
      if (desc && desc.getLastRow() > 1) {
        const E = headerIndex(desc);
        if (E['Data Governance'] !== undefined) {
          desc.getRange(2, 1, desc.getLastRow() - 1, desc.getLastColumn()).getValues().forEach(r => {
            const note = String(r[E['Data Governance']] || '').trim(), id = String(r[E['Order ID']] || '').trim();
            if (!note || !id) return;
            const d = byId[id] || [];
            const when = text(d[D['Start Date']], tz) || text(d[D['Due Date']], tz);
            const cut = note.indexOf(': ');
            const domain = cut > 0 ? note.slice(0, cut) : 'Data Governance', raw = cut > 0 ? note.slice(cut + 2) : note;
            const what = raw.charAt(0).toUpperCase() + raw.slice(1);
            updates.push({ when: when, project: String(d[D['Project Name']] || ''), id: id, task: String(d[D['Task/Subtask Name']] || r[E['Task/Subtask Name']] || ''), what: what, domain: domain });
          });
        }
      }
      updates.sort((x, y) => (x.when || '9999').localeCompare(y.when || '9999') || x.id.localeCompare(y.id));
      updates.forEach(u => all.push([u.when, SECTION_NAME[c.section] || '', u.project, u.id, u.task, u.what, u.domain]));

      if (!tab) return;
      const govRows = items.filter(g => g['About'] === 'Project' && mine[String(g['Project or unit']).trim().toLowerCase()])
        .map(g => [g['Item ID'], g['Project or unit'], g['Governance item'], g['Type'], g['Owner'], g['Status'], g['Next review'] || '', g['Notes']]);
      const colB = tab.getRange(1, 2, Math.max(tab.getLastRow(), 1), 1).getValues().map(r => String(r[0]).trim());
      const s2 = colB.findIndex(v => v.indexOf('2. ') === 0);
      if (s2 < 0) return;
      const start = s2 + 2;                                   // first row under the section 2 title
      const last = Math.max(tab.getLastRow(), start);
      tab.getRange(start, 2, last - start + 1, 8).clear();
      const out = [['Date', 'Project', 'What changed', 'Order ID', 'NDMO domain', '', '', '']]
        .concat(updates.map(u => [u.when, u.project, u.what, u.id, u.domain, '', '', '']))
        .concat([['', '', '', '', '', '', '', ''], ['3. Governance items (kept in step with the Governance file every 5 minutes; edit items there)', '', '', '', '', '', '', ''],
          ['Item ID', 'Project', 'Governance item', 'Type', 'Owner', 'Status', 'Next review', 'Notes']])
        .concat(govRows);
      tab.getRange(start, 2, out.length, 8).setValues(out).setWrap(true).setVerticalAlignment('top');
      const head = r => tab.getRange(r, 2, 1, 8).setBackground('#158B87').setFontColor('#FFFFFF').setFontWeight('bold');
      head(start).offset(0, 5, 1, 3).setBackground(null);       // section 2 header has 5 columns
      const s3 = start + 1 + updates.length + 1;
      tab.getRange(s3, 2).setFontWeight('bold').setFontColor('#158B87').setFontSize(12);
      head(s3 + 1);
      if (updates.length) tab.getRange(start + 1, 2, updates.length, 1).setNumberFormat('dd mmm yyyy');
    } catch (e) { log(c, '', 'Data Governance tab: ' + e.message); }
  });
  // The Governance Officer sees every team's data governance updates in one tab.
  try {
    const gcfg = CONFIG.SHEETS.filter(c => c.kind === 'governance')[0];
    if (!gcfg) return;
    const gss = SpreadsheetApp.openById(gcfg.id);
    let t = gss.getSheetByName('Team Updates');
    if (!t) { t = gss.insertSheet('Team Updates', 1); t.setFrozenRows(1); }
    t.clear();
    const rows = [['Date', 'Section', 'Project', 'Order ID', 'Task', 'Data governance update', 'NDMO domain']].concat(all);
    t.getRange(1, 1, rows.length, 7).setValues(rows).setWrap(true).setVerticalAlignment('top');
    t.getRange(1, 1, 1, 7).setBackground('#158B87').setFontColor('#FFFFFF').setFontWeight('bold');
    if (all.length) t.getRange(2, 1, all.length, 1).setNumberFormat('dd mmm yyyy');
  } catch (e) { log({ id: CONFIG.SHEETS.filter(c => c.kind === 'governance')[0].id }, '', 'Team Updates tab: ' + e.message); }
}

function headerIndex(sh) {
  const idx = {};
  sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].forEach((h, j) => { idx[String(h).trim()] = j; });
  return idx;
}

/** The DET fields of one tracker row, read the way they will be compared. */
function trackerValues(r, d, D, E, tz) {
  const v = {};
  Object.keys(T_DATA).forEach(h => { if (D[h] !== undefined) v[T_DATA[h]] = text(r[D[h]], tz); });
  if (!v['Unit'] && D['Unit Name'] !== undefined) v['Unit'] = text(r[D['Unit Name']], tz);
  if (!v['Project'] && D['Project Code'] !== undefined) v['Project'] = text(r[D['Project Code']], tz);
  const p = r[D['% Complete']];
  v['Progress %'] = typeof p === 'number' ? String(Math.round(p <= 1 ? p * 100 : p)) : String(p || '').replace('%', '').trim();
  Object.keys(T_DESC).forEach(h => {
    const x = d && E[h] !== undefined ? text(d[E[h]], tz) : '';
    v[T_DESC[h]] = h === 'Weekly Bullet' ? x.split('\n').map(s => s.replace(/^[•\-*]\s*/, '').trim()).filter(String).join('\n') : x;
  });
  return v;
}
function text(x, tz) {
  if (x instanceof Date) return Utilities.formatDate(x, tz, 'yyyy-MM-dd');
  return x === null || x === undefined ? '' : String(x).trim();
}
function setIf(r, idx, h, value) { if (idx[h] !== undefined) r[idx[h]] = value === null || value === undefined ? '' : value; }
function pick(cols, v) { const o = {}; cols.forEach(c => { o[c] = v[c]; }); return o; }

function toValues(cols, r, tz) {
  const v = {};
  cols.forEach((c, j) => {
    const x = r[j];
    if (x instanceof Date) v[c] = Utilities.formatDate(x, tz, 'yyyy-MM-dd');
    else if (c === 'Progress %' && typeof x === 'number') v[c] = String(x > 0 && x <= 1 && !Number.isInteger(x) ? Math.round(x * 100) : x);
    else v[c] = x === null || x === undefined ? '' : String(x).trim();
  });
  return v;
}
function cell(c, x) {
  if (x === null || x === undefined) return '';
  if (DATE_COLS.indexOf(c) >= 0) return String(x);   // "2026-11-10": the sheet turns it into a date in its own time zone
  return x;
}
/** The fields that differ from the copy saved at the last sync. An old-style saved value (a hash) means the whole row. */
function changedFields(values, saved) {
  if (saved === 'DELETED') return [];
  if (saved.charAt(0) === '{') {
    try {
      const b = JSON.parse(saved);
      return Object.keys(values).filter(k => same(values[k]) !== same(b[k]));
    } catch (e) { /* damaged copy: treat as a full change */ }
  }
  return hash(values) === saved ? [] : Object.keys(values);
}
function same(x) { return (x === null || x === undefined ? '' : String(x)).replace(/\s+/g, ' ').trim(); }

/**
 * Writes only the rows that change, and only if nobody edited them since they were read at the start of this sync.
 * Returns the rows it left alone (they are picked up by the next run).
 */
function safeWrite(sh, startRow, width, orig, next, tz) {
  const skipped = {};
  const todo = [];
  orig.forEach((r, i) => { if (!rowEq(r, next[i], tz)) todo.push(i); });
  if (!todo.length) return skipped;
  const now = sh.getRange(startRow, 1, orig.length, width).getValues();
  const ok = todo.filter(i => { if (now[i] && rowEq(now[i], orig[i], tz)) return true; skipped[i] = true; return false; });
  for (let k = 0; k < ok.length;) {
    let e = k;
    while (e + 1 < ok.length && ok[e + 1] === ok[e] + 1) e++;
    sh.getRange(startRow + ok[k], 1, e - k + 1, width).setValues(next.slice(ok[k], ok[e] + 1));
    k = e + 1;
  }
  return skipped;
}
function rowEq(a, b, tz) {
  if (!a || !b) return false;
  const len = Math.max(a.length, b.length);
  for (let j = 0; j < len; j++) if (cellKey(a[j], tz) !== cellKey(b[j], tz)) return false;
  return true;
}
function cellKey(x, tz) {
  if (x instanceof Date) return Utilities.formatDate(x, tz, 'yyyy-MM-dd');
  if (typeof x === 'number') return String(Math.round(x * 1e6) / 1e6);
  return x === null || x === undefined ? '' : String(x);
}
function hash(values) {
  const keys = Object.keys(values).sort();
  const s = keys.map(k => k + '=' + String(values[k] === null || values[k] === undefined ? '' : values[k]).trim()).join('|');
  return Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, s, Utilities.Charset.UTF_8));
}

/** Keeps the dropdown lists (projects, units, statuses) in step with DET. */
function refreshLists(ss, lists, kind) {
  let sh = ss.getSheetByName('Lists');
  if (!sh) { sh = ss.insertSheet('Lists'); sh.hideSheet(); }
  const cols = kind === 'orders'
    ? [['Projects', lists.projects], ['Units', lists.units], ['Status', lists.orderStatus], ['Governance', lists.orderGovernance]]
    : [['About', lists.govAbout], ['Projects', lists.projects], ['Units', lists.units], ['Type', lists.govType], ['Status', lists.govStatus]];
  sh.clearContents();
  cols.forEach((c, j) => {
    const vals = [[c[0]]].concat(c[1].map(x => [x]));
    sh.getRange(1, j + 1, vals.length, 1).setValues(vals);
  });
}

function log(cfg, row, message) {
  const ss = SpreadsheetApp.openById(cfg.id);
  let sh = ss.getSheetByName('Sync log');
  if (!sh) { sh = ss.insertSheet('Sync log'); sh.appendRow(['Time', 'Row', 'Message']); }
  sh.insertRowAfter(1);
  sh.getRange(2, 1, 1, 3).setValues([[new Date(), row, message]]);
  if (sh.getLastRow() > 300) sh.deleteRows(301, sh.getLastRow() - 300);
}
