// src/app/api/orders/template/route.ts
// GET /api/orders/template — generates a ready-to-fill Excel import template
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const [units, projects, users] = await Promise.all([
    prisma.unit.findMany({ where: { isActive: true }, select: { code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({ select: { code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { name: true, email: true }, orderBy: { name: 'asc' } }),
  ]);

  const wb = XLSX.utils.book_new();

  // Sheet 1: Template
  const headers = ['name*','type','status','priority','unitCode','projectCode','ownerEmail','startDate','dueDate','percentComplete','notes','links','dependencies'];
  const sample1 = ['Implement HR Onboarding','PROJECT','NOT_STARTED','HIGH', units[0]?.code ?? 'UNIT1', projects[0]?.code ?? 'PROJ1', users[0]?.email ?? 'user@dgcc.edu.sa','2025-03-01','2025-06-30',0,'Sample order','',''];
  const ws1 = XLSX.utils.aoa_to_sheet([headers, sample1]);
  ws1['!cols'] = [{ wch: 50 },{ wch: 14 },{ wch: 14 },{ wch: 12 },{ wch: 10 },{ wch: 12 },{ wch: 30 },{ wch: 12 },{ wch: 12 },{ wch: 16 },{ wch: 40 },{ wch: 40 },{ wch: 30 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Orders Import');

  // Sheet 2: Instructions
  const instr = [
    ['DGCC PES — Orders Import Template'],[''],
    ['• Column name* is required. All others optional.'],
    ['• Remove the sample row before importing.'],
    ['• Dates: YYYY-MM-DD format.'],
    ['• percentComplete: 0-100 integer.'],
    ['• type: PROGRAM, PROJECT, DELIVERABLE, TASK, SUBTASK'],
    ['• status: NOT_STARTED, IN_PROGRESS, UNDER_REVIEW, BLOCKED, ON_HOLD, DONE, CANCELLED'],
    ['• priority: LOW, MEDIUM, HIGH, CRITICAL'],
    ['• Use the Reference sheet for valid unit/project codes and owner emails.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instr);
  ws2['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // Sheet 3: Reference
  const refData: any[][] = [['UNITS','','PROJECTS','','USERS'],['Code','Name','Code','Name','Email / Name']];
  for (let i = 0; i < Math.max(units.length, projects.length, users.length); i++) {
    refData.push([units[i]?.code??'', units[i]?.name??'', projects[i]?.code??'', projects[i]?.name??'', users[i] ? `${users[i].email} (${users[i].name})` : '']);
  }
  const ws3 = XLSX.utils.aoa_to_sheet(refData);
  ws3['!cols'] = [{ wch: 12 },{ wch: 35 },{ wch: 12 },{ wch: 35 },{ wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Reference');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="PES-Orders-Import-Template-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}

