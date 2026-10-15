// src/app/api/projects/template/route.ts
// GET /api/projects/template — generates a ready-to-fill Excel import template for Projects
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { code: true, name: true },
    orderBy: { code: 'asc' },
  });

  const wb = XLSX.utils.book_new();

  // Sheet 1: Template
  const headers = ['code*', 'name*', 'unitCode', 'phase', 'startDate', 'endDate', 'sponsor', 'description'];
  const sample1 = ['PROJ1', 'Sample Project Name', units[0]?.code ?? 'DGCC', 'PLANNING', '2026-01-01', '2026-12-31', 'Dean of ELI', 'Brief description of the project'];
  const ws1 = XLSX.utils.aoa_to_sheet([headers, sample1]);
  ws1['!cols'] = [{ wch: 12 }, { wch: 50 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 30 }, { wch: 60 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Projects Import');

  // Sheet 2: Instructions
  const instr = [
    ['DET — Projects Import Template'],
    [''],
    ['• Columns code* and name* are required.'],
    ['• If a project with the same code exists, it will be UPDATED (overwrite).'],
    ['• If the code is new, a new project will be created.'],
    ['• Remove the sample row before importing.'],
    [''],
    ['Field rules:'],
    ['• code: 2-20 chars, uppercase letters/numbers/dashes only (e.g. ODS, DGCC-P)'],
    ['• name: 2-200 chars'],
    ['• phase: INITIATION, PLANNING, EXECUTION, MONITORING, CLOSURE'],
    ['• unitCode: must match an existing unit code (see Reference sheet)'],
    ['• Dates: YYYY-MM-DD format (optional)'],
    ['• description: up to 2000 chars'],
    [''],
    ['Permission: Only users with admin:settings can import projects.'],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(instr);
  ws2['!cols'] = [{ wch: 80 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Instructions');

  // Sheet 3: Reference (valid unit codes)
  const refData: any[][] = [['Valid Unit Codes'], ['Code', 'Name']];
  for (const u of units) refData.push([u.code, u.name]);
  const ws3 = XLSX.utils.aoa_to_sheet(refData);
  ws3['!cols'] = [{ wch: 14 }, { wch: 50 }];
  XLSX.utils.book_append_sheet(wb, ws3, 'Reference');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  const today = new Date().toISOString().slice(0, 10);
  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="DET-Projects-Import-Template-${today}.xlsx"`,
      'Cache-Control': 'no-store',
    },
  });
}
