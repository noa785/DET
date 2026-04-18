// src/lib/excel/utils.ts
// Shared Excel helpers for import/export (SheetJS / xlsx)
// Works in Node.js API routes only (not browser)

import * as XLSX from 'xlsx';

// ── Orders column definitions ──────────────────────────────────
export const ORDER_EXPORT_COLS = [
  { key: 'orderCode',       header: 'Order Code',      width: 12 },
  { key: 'type',            header: 'Type',            width: 14 },
  { key: 'name',            header: 'Name / Title',    width: 40 },
  { key: 'unitCode',        header: 'Unit Code',       width: 10 },
  { key: 'unitName',        header: 'Unit Name',       width: 28 },
  { key: 'projectCode',     header: 'Project Code',    width: 14 },
  { key: 'projectName',     header: 'Project Name',    width: 28 },
  { key: 'ownerName',       header: 'Owner',           width: 22 },
  { key: 'priority',        header: 'Priority',        width: 10 },
  { key: 'status',          header: 'Status',          width: 14 },
  { key: 'percentComplete', header: '% Complete',      width: 12 },
  { key: 'startDate',       header: 'Start Date',      width: 12 },
  { key: 'dueDate',         header: 'Due Date',        width: 12 },
  { key: 'effectiveRAG',    header: 'RAG',             width: 8  },
  { key: 'rescheduleCount', header: 'Reschedules',     width: 13 },
  { key: 'notes',           header: 'Notes',           width: 35 },
  { key: 'links',           header: 'Links',           width: 30 },
  { key: 'dependencies',    header: 'Dependencies',    width: 20 },
  { key: 'createdAt',       header: 'Created',         width: 12 },
  { key: 'updatedAt',       header: 'Last Updated',    width: 12 },
] as const;

export const ORDER_IMPORT_COLS = [
  { key: 'name',            header: 'Name / Title',   required: true  },
  { key: 'type',            header: 'Type',           required: true  },
  { key: 'unitCode',        header: 'Unit Code',      required: false },
  { key: 'projectCode',     header: 'Project Code',   required: false },
  { key: 'ownerEmail',      header: 'Owner Email',    required: false },
  { key: 'priority',        header: 'Priority',       required: false },
  { key: 'status',          header: 'Status',         required: false },
  { key: 'percentComplete', header: '% Complete',     required: false },
  { key: 'startDate',       header: 'Start Date',     required: false },
  { key: 'dueDate',         header: 'Due Date',       required: false },
  { key: 'notes',           header: 'Notes',          required: false },
  { key: 'links',           header: 'Links',          required: false },
  { key: 'dependencies',    header: 'Dependencies',   required: false },
] as const;

// ── Governance column definitions ──────────────────────────────
export const GOV_EXPORT_COLS = [
  { key: 'govCode',          header: 'Gov Code',        width: 12 },
  { key: 'title',            header: 'Title',           width: 40 },
  { key: 'type',             header: 'Type',            width: 22 },
  { key: 'status',           header: 'Status',          width: 14 },
  { key: 'priority',         header: 'Priority',        width: 10 },
  { key: 'riskLevel',        header: 'Risk Level',      width: 12 },
  { key: 'unitCode',         header: 'Unit Code',       width: 10 },
  { key: 'unitName',         header: 'Unit Name',       width: 28 },
  { key: 'ownerName',        header: 'Owner',           width: 22 },
  { key: 'reviewerName',     header: 'Reviewer',        width: 22 },
  { key: 'version',          header: 'Version',         width: 10 },
  { key: 'effectiveDate',    header: 'Effective Date',  width: 14 },
  { key: 'nextReviewDate',   header: 'Next Review',     width: 14 },
  { key: 'reviewCycleDays',  header: 'Review Cycle (d)',width: 14 },
  { key: 'source',           header: 'Source',          width: 25 },
  { key: 'complianceImpact', header: 'Compliance Impact',width: 30},
  { key: 'openTasks',        header: 'Open Tasks',      width: 11 },
  { key: 'notes',            header: 'Notes',           width: 35 },
  { key: 'createdAt',        header: 'Created',         width: 12 },
] as const;

// ── Styling helpers ────────────────────────────────────────────

/** Header row style — dark blue, bold, white text */
export function headerStyle() {
  return {
    font:      { bold: true, color: { rgb: 'FFFFFF' }, sz: 10, name: 'Arial' },
    fill:      { fgColor: { rgb: '0F1F3D' }, patternType: 'solid' },
    alignment: { horizontal: 'center', vertical: 'center', wrapText: false },
    border: {
      bottom: { style: 'medium', color: { rgb: '1E3A6E' } },
    },
  };
}

/** Alternating row style */
export function rowStyle(even: boolean) {
  return {
    fill: even
      ? { fgColor: { rgb: 'F0F4FA' }, patternType: 'solid' }
      : { fgColor: { rgb: 'FFFFFF' }, patternType: 'solid' },
    font: { sz: 10, name: 'Arial' },
    alignment: { vertical: 'center' },
  };
}

/** Status badge colors (approximate with fill) */
const STATUS_FILLS: Record<string, string> = {
  DONE:         'D1FAE5', IN_PROGRESS: 'DBEAFE', BLOCKED:  'FEE2E2',
  UNDER_REVIEW: 'FEF3C7', ON_HOLD:     'F3F4F6', CANCELLED:'1F2937',
  NOT_STARTED:  'F9FAFB', ACTIVE:      'D1FAE5', DRAFT:    'F3F4F6',
};
const RISK_FILLS: Record<string, string> = {
  CRITICAL: 'FEE2E2', HIGH: 'FECACA', MEDIUM: 'FEF3C7', LOW: 'D1FAE5',
};

export function statusCellStyle(status: string) {
  const fill = STATUS_FILLS[status];
  return fill ? { fill: { fgColor: { rgb: fill }, patternType: 'solid' }, font: { sz: 10, bold: true } } : {};
}
export function riskCellStyle(risk: string) {
  const fill = RISK_FILLS[risk];
  return fill ? { fill: { fgColor: { rgb: fill }, patternType: 'solid' }, font: { sz: 10, bold: true } } : {};
}

// ── Date formatting ────────────────────────────────────────────
export function fmtDate(d: Date | string | null | undefined): string {
  if (!d) return '';
  const dt = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(dt.getTime())) return '';
  return dt.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── Apply column widths ────────────────────────────────────────
export function applyColWidths(
  ws: XLSX.WorkSheet,
  cols: readonly { width: number }[]
) {
  ws['!cols'] = cols.map(c => ({ wch: c.width }));
}

// ── Freeze top row ─────────────────────────────────────────────
export function freezeHeader(ws: XLSX.WorkSheet) {
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2', activePane: 'bottomLeft' };
}

// ── Auto-filter ────────────────────────────────────────────────
export function addAutoFilter(ws: XLSX.WorkSheet, range: string) {
  ws['!autofilter'] = { ref: range };
}

// ── Build workbook and return buffer ──────────────────────────
export function buildWorkbook(sheets: { name: string; ws: XLSX.WorkSheet }[]): Buffer {
  const wb = XLSX.utils.book_new();
  for (const { name, ws } of sheets) {
    XLSX.utils.book_append_sheet(wb, ws, name);
  }
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
}

// ── Parse uploaded Excel buffer ────────────────────────────────
export function parseExcelBuffer(buffer: Buffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'buffer', cellDates: true });
}

/** Read first sheet of wb as array of row objects */
export function sheetToRows(wb: XLSX.WorkBook, sheetIndex = 0): Record<string, any>[] {
  const sheetName = wb.SheetNames[sheetIndex];
  if (!sheetName) return [];
  const ws = wb.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(ws, { raw: false, defval: '' });
}

// ── Validation helpers ─────────────────────────────────────────
const VALID_TYPES    = new Set(['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK']);
const VALID_STATUSES = new Set(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED']);
const VALID_PRIOS    = new Set(['LOW','MEDIUM','HIGH','CRITICAL']);

export function normalizeEnum(val: string, validSet: Set<string>, fallback: string): string {
  const up = String(val ?? '').toUpperCase().trim().replace(/\s+/g,'_');
  return validSet.has(up) ? up : fallback;
}

export function validateOrderRow(
  row: Record<string, any>,
  rowNum: number,
): { valid: boolean; errors: string[]; normalized: Record<string, any> } {
  const errors: string[] = [];

  const name = String(row['Name / Title'] ?? row['name'] ?? '').trim();
  if (!name) errors.push(`Row ${rowNum}: Name is required`);

  const type = normalizeEnum(
    String(row['Type'] ?? row['type'] ?? 'TASK'),
    VALID_TYPES, 'TASK'
  );
  const status = normalizeEnum(
    String(row['Status'] ?? row['status'] ?? 'NOT_STARTED'),
    VALID_STATUSES, 'NOT_STARTED'
  );
  const priority = normalizeEnum(
    String(row['Priority'] ?? row['priority'] ?? 'MEDIUM'),
    VALID_PRIOS, 'MEDIUM'
  );

  const pctRaw = row['% Complete'] ?? row['percentComplete'] ?? 0;
  const pct = Math.min(100, Math.max(0, parseInt(String(pctRaw)) || 0));

  const parseDate = (v: any): string | null => {
    if (!v) return null;
    // SheetJS may parse as Date object when cellDates: true
    if (v instanceof Date) return isNaN(v.getTime()) ? null : v.toISOString().slice(0, 10);
    const s = String(v).trim();
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  };

  return {
    valid: errors.length === 0,
    errors,
    normalized: {
      name,
      type,
      status,
      priority,
      percentComplete: pct,
      startDate:       parseDate(row['Start Date'] ?? row['startDate']),
      dueDate:         parseDate(row['Due Date']   ?? row['dueDate']),
      unitCode:        String(row['Unit Code']     ?? row['unitCode']     ?? '').trim().toUpperCase(),
      projectCode:     String(row['Project Code']  ?? row['projectCode']  ?? '').trim().toUpperCase(),
      ownerEmail:      String(row['Owner Email']   ?? row['ownerEmail']   ?? '').trim().toLowerCase(),
      notes:           String(row['Notes']         ?? row['notes']        ?? '').trim() || null,
      links:           String(row['Links']         ?? row['links']        ?? '').trim() || null,
      dependencies:    String(row['Dependencies']  ?? row['dependencies'] ?? '').trim() || null,
    },
  };
}
