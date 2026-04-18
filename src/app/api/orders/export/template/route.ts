// src/app/api/orders/export/template/route.ts
// GET /api/orders/export/template
// Returns a ready-to-fill Excel template for bulk order import
// Includes: sample row, validation hints, allowed values reference sheet

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  // Load reference data for the "Reference" sheet
  const [units, projects, users] = await Promise.all([
    prisma.unit.findMany({
      where: { isActive: true },
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.project.findMany({
      select: { code: true, name: true },
      orderBy: { code: 'asc' },
    }),
    prisma.user.findMany({
      where: { isActive: true },
      select: { name: true, email: true },
      orderBy: { name: 'asc' },
    }),
  ]);

  const wb = XLSX.utils.book_new();

  // ── Sheet 1: Orders Import Template ───────────────────────────
  const headers = [
    'name*', 'type', 'status', 'priority',
    'unitCode', 'projectCode', 'ownerEmail',
    'startDate', 'dueDate', 'percentComplete',
    'notes', 'links', 'dependencies',
  ];

  const sampleRows = [
    [
      'Implement New HR Onboarding Process',
      'PROJECT', 'NOT_STARTED', 'HIGH',
      units[0]?.code ?? 'UNIT1',
      projects[0]?.code ?? 'PROJ1',
      users[0]?.email ?? 'user@dgcc.edu.sa',
      '2025-03-01', '2025-06-30', 0,
      'New hire integration program', '', '',
    ],
    [
      'Update Procurement Policy Documentation',
      'TASK', 'IN_PROGRESS', 'MEDIUM',
      units[1]?.code ?? 'UNIT2',
      '', users[1]?.email ?? 'user2@dgcc.edu.sa',
      '2025-02-01', '2025-04-15', 35,
      'Annual policy review', 'https://sharepoint/doc1', '',
    ],
  ];

  const templateData = [headers, ...sampleRows];
  const ws1 = XLSX.utils.aoa_to_sheet(templateData);

  // Column widths
  ws1['!cols'] = [
    { wch: 50 }, // name
    { wch: 14 }, // type
    { wch: 14 }, // status
    { wch: 12 }, // priority
    { wch: 10 }, // unitCode
    { wch: 12 }, // projectCode
    { wch: 28 }, // ownerEmail
    { wch: 12 }, // startDate
    { wch: 12 }, // dueDate
    { wch: 16 }, // percentComplete
    { wch: 40 }, // notes
    { wch: 40 }, // links
    { wch: 30 }, // dependencies
  ];

  XLSX.utils.book_append_sheet(wb, ws1, 'Orders Import');

  // ── Sheet 2: Instructions ──────────────────────────────────────
  const instructions = [
    ['DGCC PES — Orders Import Template'],
    [''],
    ['INSTRUCTIONS:'],
    ['1. Fill in the "Orders Import" sheet. Row 1 is the header, Row 2+ are your data rows.'],
    ['2. Columns marked with * are required. All others are optional.'],
    ['3. Remove the sample rows (rows 2-3) before importing.'],
    ['4. Use the "Reference" sheet for valid unit codes, project codes, and user emails.'],
    ['5. Dates must be in YYYY-MM-DD format (e.g., 2025-03-15).'],
    ['6. percentComplete must be a number between 0 and 100.'],
    ['7. Save as .xlsx or .csv before uploading.'],
    [''],
    ['COLUMN GUIDE:'],
    ['Column', 'Required', 'Valid Values / Notes'],
    ['name', 'YES', 'Any text up to 500 characters'],
    ['type', 'no', 'PROGRAM, PROJECT, DELIVERABLE, TASK, SUBTASK  (default: TASK)'],
    ['status', 'no', 'NOT_STARTED, IN_PROGRESS, UNDER_REVIEW, BLOCKED, ON_HOLD, DONE, CANCELLED  (default: NOT_STARTED)'],
    ['priority', 'no', 'LOW, MEDIUM, HIGH, CRITICAL  (default: MEDIUM)'],
    ['unitCode', 'no', 'See "Reference" sheet for valid codes'],
    ['projectCode', 'no', 'See "Reference" sheet for valid codes'],
    ['ownerEmail', 'no', 'Must match a user email in the system — see "Reference" sheet'],
    ['startDate', 'no', 'YYYY-MM-DD format'],
    ['dueDate', 'no', 'YYYY-MM-DD format'],
    ['percentComplete', 'no', '0 to 100 (integer). Default: 0'],
    ['notes', 'no', 'Free text, up to 2000 characters'],
    ['links', 'no', 'URLs or references, up to 1000 characters'],
    ['dependencies', 'no', 'Free text describing dependencies, up to 500 characters'],
  ];

  const ws2 = XLSX.utils.aoa_to_sheet(instructions);
  ws2['!cols'] = [{ wch: 20 }, { wch: 10 }, { wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // ── Sheet 3: Reference data ────────────────────────────────────
  const refData: any[][] = [
    ['UNITS', '', 'PROJECTS', '', 'USERS (email for ownerEmail)'],
    ['Code', 'Name', 'Code', 'Name', 'Email', 'Name'],
    ...Array.from({ length: Math.max(units.length, projects.length, users.length) }, (_, i) => [
      units[i]?.code ?? '',
      units[i]?.name ?? '',
      projects[i]?.code ?? '',
      projects[i]?.name ?? '',
      users[i]?.email ?? '',
      users[i]?.name ?? '',
    ]),
  ];

  const ws3 = XLSX.utils.aoa_to_sheet(refData);
  ws3['!cols'] = [{ wch: 12 }, { wch: 35 }, { wch: 12 }, { wch: 35 }, { wch: 35 }, { wch: 25 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Reference');

  // ── Generate buffer ────────────────────────────────────────────
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-import-template-${today}.xlsx"`,
      'Cache-Control':       'no-store',
    },
  });
}
