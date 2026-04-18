// src/app/api/gov-tasks/export/route.ts
// GET /api/gov-tasks/export?govItemId=&status=&format=xlsx|csv
import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

export async function GET(req: NextRequest) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const fmt        = searchParams.get('format') ?? 'xlsx';
  const govItemId  = searchParams.get('govItemId');
  const statusFilt = searchParams.get('status');

  const where: any = { isDeleted: false };
  if (govItemId)  where.govItemId = govItemId;
  if (statusFilt) where.status    = statusFilt;

  const tasks = await prisma.governanceTask.findMany({
    where,
    include: {
      govItem:  { select: { govCode: true, title: true } },
      assignee: { select: { name: true, email: true } },
      approver: { select: { name: true } },
    },
    orderBy: [{ isOverdue: 'desc' }, { dueDate: 'asc' }],
    take: 2000,
  });

  const rows = tasks.map(t => ({
    'Task Code':        t.taskCode,
    'Gov. Item Code':   t.govItem?.govCode   ?? '',
    'Gov. Item Title':  t.govItem?.title     ?? '',
    'Title':            t.title,
    'Type':             t.type.replace(/_/g, ' '),
    'Status':           t.status.replace(/_/g, ' '),
    'Priority':         t.priority,
    'Assignee':         t.assignee?.name     ?? '',
    'Assignee Email':   t.assignee?.email    ?? '',
    'Due Date':         t.dueDate  ? t.dueDate.toISOString().slice(0, 10) : '',
    'Is Overdue':       t.isOverdue ? 'YES' : 'NO',
    'Approval Required':t.approvalRequired ? 'YES' : 'NO',
    'Approver':         t.approver?.name     ?? '',
    'Approved At':      t.approvedAt ? t.approvedAt.toISOString().slice(0, 10) : '',
    'Required Evidence':t.requiredEvidence   ?? '',
    'Completion Evidence': t.completionEvidence ?? '',
    'Description':      t.description        ?? '',
    'Created At':       t.createdAt.toISOString().slice(0, 10),
  }));

  await audit({
    action: 'EXPORT', module: 'gov_tasks', user,
    recordId: 'bulk',
    notes: `Exported ${tasks.length} governance tasks as ${fmt.toUpperCase()}`,
  });

  const isoDate = () => new Date().toISOString().slice(0, 10);

  if (fmt === 'csv') {
    const ws  = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="gov-tasks-export-${isoDate()}.csv"`,
      },
    });
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Tasks
  const wsTasks = XLSX.utils.json_to_sheet(rows);
  const colCount = Object.keys(rows[0] ?? {}).length;
  wsTasks['!freeze']     = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };
  if (colCount > 0) wsTasks['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(colCount - 1)}1` };
  wsTasks['!cols'] = [12,14,40,40,20,20,10,20,28,12,10,10,20,12,35,35,35,12].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Gov Tasks');

  // Sheet 2: Summary
  const pending   = tasks.filter(t => t.status === 'AWAITING_APPROVAL').length;
  const overdue   = tasks.filter(t => t.isOverdue).length;
  const done      = tasks.filter(t => t.status === 'DONE').length;

  const summaryRows = [
    ['DGCC PES — Governance Tasks Export'],
    ['Generated:', new Date().toLocaleString('en-GB')],
    ['Total Tasks:', tasks.length],
    [],
    ['Status Breakdown'],
    ['Status', 'Count'],
    ...Object.entries(
      tasks.reduce((acc, t) => { acc[t.status] = (acc[t.status] ?? 0) + 1; return acc; }, {} as Record<string, number>)
    ).map(([k, v]) => [k.replace(/_/g, ' '), v]),
    [],
    ['Key Metrics'],
    ['Overdue Tasks',          overdue],
    ['Pending Approval',       pending],
    ['Done',                   done],
    ['Needs Approval (total)', tasks.filter(t => t.approvalRequired).length],
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryRows);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Summary');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="gov-tasks-export-${isoDate()}.xlsx"`,
    },
  });
}
