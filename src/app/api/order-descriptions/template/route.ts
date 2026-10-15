// src/app/api/order-descriptions/template/route.ts
// GET /api/order-descriptions/template — generates a ready-to-fill template
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const wb = XLSX.utils.book_new();

  // Sheet 1: Template
  const headers = [
    'legacyOrderId',
    'orderCode',
    'objective',
    'scope',
    'rationale',
    'governanceImpact',
    'affectedUnit',
    'relatedPolicies',
    'requiredEvidence',
    'risks',
  ];
  const sample1 = [
    'SU-SS-001',
    '',
    'Collect baseline scheduling data',
    'Phases 1-2 of the Scheduling System pipeline',
    'Required for accurate term scheduling',
    '',
    'SU',
    '',
    'Source spreadsheets, attendance logs',
    'Data quality may vary across terms',
  ];
  const ws1 = XLSX.utils.aoa_to_sheet([headers, sample1]);
  ws1['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 45 }, { wch: 50 }, { wch: 30 },
    { wch: 30 }, { wch: 14 }, { wch: 30 }, { wch: 30 }, { wch: 30 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Order Descriptions');

  // Sheet 2: Instructions
  const instr = [
    ['DET — Order Descriptions Import Template'],
    [''],
    ['You must provide ONE of these two columns to identify the order:'],
    ['  • legacyOrderId  — e.g. SU-SS-001 (matched against the order"s notes)'],
    ['  • orderCode      — e.g. ORD-0001 (matched directly)'],
    [''],
    ['How matching works:'],
    ['  1. If orderCode is filled, the system uses it directly.'],
    ['  2. Otherwise, the system searches for an order whose notes field contains'],
    ['     the text "Legacy ID: <legacyOrderId>".'],
    ['  3. If no order matches, that row is skipped (reported in insertErrors).'],
    ['  4. If multiple orders match the same legacyOrderId, that row is skipped.'],
    [''],
    ['Behavior on existing descriptions:'],
    ['  • If the order already has a description, it will be UPDATED (overwritten).'],
    ['  • If not, a new description is created.'],
    [''],
    ['Field rules:'],
    ['  • objective / scope / rationale / governanceImpact / requiredEvidence /'],
    ['    risks / relatedPolicies — free text, up to 5000 chars each'],
    ['  • affectedUnit — short text up to 200 chars (e.g. unit code)'],
    [''],
    ['Permission: Only users with orders:edit can import descriptions.'],
    [''],
    ['Tip: After bulk-importing Orders (which stores "Legacy ID: ..." in notes),'],
    ['     fill in this sheet using the same legacyOrderId values from your tracker.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instr);
  ws2['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="DET-Order-Descriptions-Import-Template-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
