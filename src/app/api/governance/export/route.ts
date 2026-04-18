// src/app/api/governance/export/route.ts
// GET /api/governance/export?status=&type=&format=xlsx|csv

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

export async function GET(req: NextRequest) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const fmt    = searchParams.get('format') ?? 'xlsx';
  const status = searchParams.get('status');
  const type   = searchParams.get('type');

  const where: any = { isDeleted: false };
  if (status) where.status = status;
  if (type)   where.type   = type;

  const [items, tasks] = await Promise.all([
    prisma.governanceItem.findMany({
      where,
      include: {
        unit:      { select: { code: true, name: true } },
        owner:     { select: { name: true } },
        reviewer:  { select: { name: true } },
        govTasks:  {
          where: { isDeleted: false },
          select: { id: true, status: true, isOverdue: true },
        },
      },
      orderBy: { govCode: 'asc' },
      take: 2000,
    }),
    prisma.governanceTask.findMany({
      where: { isDeleted: false },
      include: {
        govItem:  { select: { govCode: true } },
        assignee: { select: { name: true } },
        approver: { select: { name: true } },
      },
      orderBy: { taskCode: 'asc' },
      take: 5000,
    }),
  ]);

  // ── Governance items rows ────────────────────────────────────
  const itemRows = items.map(g => ({
    'Gov Code':         g.govCode,
    'Title':            g.title,
    'Type':             g.type.replace(/_/g, ' '),
    'Status':           g.status,
    'Priority':         g.priority,
    'Risk Level':       g.riskLevel,
    'Unit':             g.unit?.code   ?? '',
    'Unit Name':        g.unit?.name   ?? '',
    'Owner':            g.owner?.name  ?? '',
    'Reviewer':         g.reviewer?.name ?? '',
    'Version':          g.version,
    'Source':           g.source           ?? '',
    'Compliance Impact':g.complianceImpact ?? '',
    'Effective Date':   g.effectiveDate  ? g.effectiveDate.toISOString().slice(0, 10)  : '',
    'Next Review Date': g.nextReviewDate ? g.nextReviewDate.toISOString().slice(0, 10) : '',
    'Review Cycle (days)': g.reviewCycleDays ?? '',
    'Open Tasks':       g.govTasks.filter(t => t.status !== 'DONE' && t.status !== 'CANCELLED').length,
    'Overdue Tasks':    g.govTasks.filter(t => t.isOverdue).length,
    'Notes':            g.notes         ?? '',
    'Evidence Links':   g.evidenceLinks ?? '',
    'Created At':       g.createdAt?.toISOString().slice(0,10) ?? '',
    'Created At':       g.createdAt.toISOString().slice(0, 10),
  }));

  // ── Tasks rows ───────────────────────────────────────────────
  const taskRows = tasks.map(t => ({
    'Task Code':       t.taskCode,
    'Gov Item':        t.govItem?.govCode ?? '',
    'Title':           t.title,
    'Type':            t.type.replace(/_/g, ' '),
    'Status':          t.status,
    'Priority':        t.priority,
    'Assignee':        t.assignee?.name ?? '',
    'Approver':        t.approver?.name ?? '',
    'Approval Required': t.approvalRequired ? 'Yes' : 'No',
    'Approved At':     t.approvedAt ? t.approvedAt.toISOString().slice(0, 10) : '',
    'Due Date':        t.dueDate ? t.dueDate.toISOString().slice(0, 10) : '',
    'Is Overdue':      t.isOverdue ? 'Yes' : 'No',
    'Required Evidence':   t.requiredEvidence   ?? '',
    'Completion Evidence': t.completionEvidence ?? '',
  }));

  await audit({
    action:   'EXPORT',
    module:   'governance',
    user,
    recordId: 'bulk',
    notes:    `Exported ${items.length} governance items + ${tasks.length} tasks as ${fmt.toUpperCase()}`,
  });

  if (fmt === 'csv') {
    const ws  = XLSX.utils.json_to_sheet(itemRows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="governance-export-${isoDate()}.csv"`,
      },
    });
  }

  const wb = XLSX.utils.book_new();

  const wsItems = XLSX.utils.json_to_sheet(itemRows.length ? itemRows : [{ Note: 'No governance items match the filter' }]);
  wsItems['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };
  wsItems['!cols'] = [10,40,18,14,10,12,10,24,20,20,8,30,35,12,14,14,8,8,35,35,20,12].map(w => ({ wch: w }));
  if (itemRows.length) wsItems['!autofilter'] = { ref: `A1:V1` };
  XLSX.utils.book_append_sheet(wb, wsItems, 'Governance Items');

  const wsTasks = XLSX.utils.json_to_sheet(taskRows.length ? taskRows : [{ Note: 'No tasks found' }]);
  wsTasks['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };
  wsTasks['!cols'] = [12,10,40,18,14,10,20,20,12,12,12,10,35,35].map(w => ({ wch: w }));
  XLSX.utils.book_append_sheet(wb, wsTasks, 'Governance Tasks');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="governance-export-${isoDate()}.xlsx"`,
    },
  });
}

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}
