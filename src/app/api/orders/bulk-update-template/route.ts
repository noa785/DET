// src/app/api/orders/bulk-update-template/route.ts
// GET /api/orders/bulk-update-template?unitId=&status=
// Exports existing orders as an editable Excel file ready for bulk update.
// User edits status/priority/% etc., then uploads to /api/orders/bulk-update

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:edit');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const unitId  = searchParams.get('unitId');
  const status  = searchParams.get('status');

  const where: any = { isDeleted: false };
  if (unitId) where.unitId = unitId;
  if (status) where.status = status;

  const orders = await prisma.order.findMany({
    where,
    include: {
      unit:    { select: { code: true } },
      owner:   { select: { email: true } },
      project: { select: { code: true } },
    },
    orderBy: { orderCode: 'asc' },
    take: 500,
  });

  // Editable columns only (orderCode is the key, readonly)
  const rows = orders.map(o => ({
    'orderCode':        o.orderCode,          // key — do NOT change
    'name (readonly)':  o.name,               // readonly — for reference
    'status':           o.status,
    'priority':         o.priority,
    '% complete':       o.percentComplete,
    'dueDate':          o.dueDate  ? o.dueDate.toISOString().slice(0, 10) : '',
    'ragOverride':      o.ragOverride ?? '',
    'ownerEmail':       o.owner?.email ?? '',
    'notes':            o.notes ?? '',
    'unit (readonly)':  o.unit?.code  ?? '',  // readonly — reference
  }));

  const wb = XLSX.utils.book_new();

  // Sheet 1: Editable Orders
  const ws = XLSX.utils.json_to_sheet(rows);
  ws['!freeze'] = { xSplit: 2, ySplit: 1, topLeftCell: 'C2' }; // freeze orderCode + name
  const colCount = Object.keys(rows[0] ?? {}).length;
  if (colCount > 0) ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(colCount - 1)}1` };
  ws['!cols'] = [14, 40, 16, 12, 12, 14, 14, 30, 40, 12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, ws, 'Orders (Editable)');

  // Sheet 2: Instructions
  const instr = XLSX.utils.aoa_to_sheet([
    ['DGCC PES — Bulk Update Template'],
    [''],
    ['Instructions:'],
    ['  1. Edit status, priority, % complete, dueDate, ragOverride, ownerEmail, or notes columns.'],
    ['  2. Do NOT change the orderCode column — it is used to match the record.'],
    ['  3. Leave a cell unchanged if you do not want to update that field.'],
    ['  4. Delete rows for orders you do NOT want to update (optional, for clarity).'],
    ['  5. Upload the file to the Import/Export → Update tab in PES.'],
    [''],
    ['Valid values:'],
    ['  status:      NOT_STARTED | IN_PROGRESS | UNDER_REVIEW | BLOCKED | ON_HOLD | DONE | CANCELLED'],
    ['  priority:    LOW | MEDIUM | HIGH | CRITICAL'],
    ['  ragOverride: GREEN | AMBER | RED | (leave blank to clear override)'],
    ['  dueDate:     YYYY-MM-DD format'],
    ['  ownerEmail:  Must match a registered user email in the system'],
    [''],
    [`Generated: ${new Date().toLocaleString('en-GB')}`],
    [`Orders in this file: ${orders.length}`],
  ]);
  instr['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, instr, 'Instructions');

  const buf   = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PES-Bulk-Update-${today}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  });
}
