// src/app/api/work/admin-log/route.ts
// Admin Log data: GET ?person=&action=&section=&from=&to=&q=&page=   (add &format=xlsx to download)

import { NextRequest, NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { loadLog, type LogFilters } from '@/lib/det/adminlog';
import { SECTIONS } from '@/lib/det/shared';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const PAGE = 50;

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const xlsx = sp.get('format') === 'xlsx';
  const user = await requirePermission(xlsx ? 'audit:export' : 'audit:view');
  if (isErrorResponse(user)) return user;
  const f: LogFilters = {
    person: sp.get('person') || undefined, action: sp.get('action') || undefined, section: sp.get('section') || undefined,
    from: sp.get('from') || undefined, to: sp.get('to') || undefined, q: sp.get('q') || undefined,
  };

  if (!xlsx) {
    const page = Math.max(1, Number(sp.get('page')) || 1);
    const { rows, total } = await loadLog(f, (page - 1) * PAGE, PAGE);
    return NextResponse.json({ data: { rows, total, page, pages: Math.max(1, Math.ceil(total / PAGE)) } });
  }

  // Excel download of everything that matches the filters
  const { rows } = await loadLog(f, 0, 50000);
  const wb = new ExcelJS.Workbook();
  wb.creator = user.name;
  const ws = wb.addWorksheet('Admin Log', { views: [{ state: 'frozen', ySplit: 1 }] });
  ws.columns = [
    { header: 'Date and Time (Riyadh)', width: 22 }, { header: 'Person', width: 22 }, { header: 'Email', width: 28 },
    { header: 'Action', width: 15 }, { header: 'Section', width: 20 }, { header: 'Order ID', width: 15 },
    { header: 'Order', width: 40 }, { header: 'Details', width: 60 }, { header: 'IP Address', width: 16 },
  ];
  const head = ws.getRow(1);
  head.height = 26;
  head.eachCell(c => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A4542' } };
    c.alignment = { vertical: 'middle' };
  });
  for (const r of rows) {
    const local = new Date(new Date(r.at).getTime() + 3 * 3600e3); // shown as Riyadh time
    ws.addRow([local, r.person, r.email, r.label, r.section ? SECTIONS[r.section].name : 'General', r.code, r.orderName, r.details, r.ip])
      .eachCell(c => { c.alignment = { vertical: 'top', wrapText: true }; c.border = { bottom: { style: 'hair', color: { argb: 'FFD9E5E3' } } }; });
  }
  ws.getColumn(1).numFmt = 'dd mmm yyyy hh:mm';
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: 9 } };
  await audit({ action: 'EXPORT', module: 'export', user, notes: `Downloaded the Admin Log as Excel (${rows.length} entries)` });
  const buf = Buffer.from(await wb.xlsx.writeBuffer());
  const d = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="DET_Admin_Log_${d}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
