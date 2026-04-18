// src/app/api/orders/export/route.ts
// GET /api/orders/export?status=&unitId=&format=xlsx|csv
// Streams a formatted Excel workbook of orders with their descriptions

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { computeRAG } from '@/lib/business-logic/orders';

export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const fmt    = searchParams.get('format') ?? 'xlsx';
  const status = searchParams.get('status');
  const unitId = searchParams.get('unitId');

  // ── Build where clause ───────────────────────────────────────
  const where: any = { isDeleted: false };
  if (status) where.status = status;
  if (unitId) where.unitId = unitId;

  const orders = await prisma.order.findMany({
    where,
    include: {
      unit:        { select: { code: true, name: true } },
      project:     { select: { code: true, name: true } },
      owner:       { select: { name: true } },
      createdBy:   { select: { name: true } },
      description: true,
    },
    orderBy: { orderCode: 'asc' },
    take: 5000,
  });

  // ── Build rows ────────────────────────────────────────────────
  const rows = orders.map(o => {
    const rag = computeRAG({
      status:          o.status as any,
      percentComplete: o.percentComplete,
      dueDate:         o.dueDate?.toISOString(),
      ragOverride:     o.ragOverride as any,
    });

    return {
      'Order Code':         o.orderCode,
      'Type':               o.type,
      'Name':               o.name,
      'Unit Code':          o.unit?.code   ?? '',
      'Unit Name':          o.unit?.name   ?? '',
      'Project Code':       o.project?.code ?? '',
      'Project Name':       o.project?.name ?? '',
      'Owner':              o.owner?.name  ?? '',
      'Status':             o.status,
      'Priority':           o.priority,
      '% Complete':         o.percentComplete,
      'RAG':                rag,
      'Start Date':         o.startDate ? o.startDate.toISOString().slice(0, 10) : '',
      'Due Date':           o.dueDate   ? o.dueDate.toISOString().slice(0, 10)   : '',
      'Reschedule Count':   o.rescheduleCount,
      'Notes':              o.notes        ?? '',
      'Links':              o.links        ?? '',
      'Dependencies':       o.dependencies ?? '',
      'RAG Override':       o.ragOverride  ?? '',
      'Created By':         o.createdBy?.name ?? '',
      'Created At':         o.createdAt.toISOString().slice(0, 10),
      'Updated At':         o.updatedAt.toISOString().slice(0, 10),
      // Description fields
      'Objective':          o.description?.objective         ?? '',
      'Scope':              o.description?.scope             ?? '',
      'Rationale':          o.description?.rationale         ?? '',
      'Governance Impact':  o.description?.governanceImpact  ?? '',
      'Affected Unit(s)':   o.description?.affectedUnit      ?? '',
      'Related Policies':   o.description?.relatedPolicies   ?? '',
      'Required Evidence':  o.description?.requiredEvidence  ?? '',
      'Risks / Flags':      o.description?.risks             ?? '',
    };
  });

  await audit({
    action:   'EXPORT',
    module:   'orders',
    user,
    recordId: 'bulk',
    notes:    `Exported ${orders.length} orders as ${fmt.toUpperCase()}`,
  });

  // ── Build workbook ────────────────────────────────────────────
  if (fmt === 'csv') {
    const ws  = XLSX.utils.json_to_sheet(rows);
    const csv = XLSX.utils.sheet_to_csv(ws);
    return new NextResponse(csv, {
      headers: {
        'Content-Type':        'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="orders-export-${isoDate()}.csv"`,
      },
    });
  }

  const wb = XLSX.utils.book_new();

  // Sheet 1: Orders
  const wsOrders = XLSX.utils.json_to_sheet(rows);
  styleHeaderRow(wsOrders, Object.keys(rows[0] ?? {}).length);
  setColWidths(wsOrders, [12, 14, 40, 10, 24, 12, 30, 20, 16, 10, 12, 8, 12, 12, 8, 30, 30, 20, 12, 18, 12, 12, 35, 35, 35, 35, 25, 25, 35, 35]);
  XLSX.utils.book_append_sheet(wb, wsOrders, 'Orders');

  // Sheet 2: Summary stats
  const summary = buildSummarySheet(orders);
  XLSX.utils.book_append_sheet(wb, summary, 'Summary');

  // Sheet 3: Import Template (blank with headers + instructions)
  const template = buildImportTemplate();
  XLSX.utils.book_append_sheet(wb, template, 'Import Template');

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  return new NextResponse(buf, {
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="orders-export-${isoDate()}.xlsx"`,
    },
  });
}

// ── Helpers ───────────────────────────────────────────────────

function isoDate() {
  return new Date().toISOString().slice(0, 10);
}

function styleHeaderRow(ws: XLSX.WorkSheet, colCount: number) {
  // XLSX doesn't support rich cell styling in community version,
  // but we can set freeze panes and auto-filter
  ws['!freeze'] = { xSplit: 0, ySplit: 1, topLeftCell: 'A2' };
  if (colCount > 0) {
    ws['!autofilter'] = { ref: `A1:${XLSX.utils.encode_col(colCount - 1)}1` };
  }
}

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map(w => ({ wch: w }));
}

function buildSummarySheet(orders: any[]): XLSX.WorkSheet {
  const statusMap: Record<string, number> = {};
  const priorityMap: Record<string, number> = {};
  const ragMap: Record<string, number> = {};
  let totalPct = 0;

  for (const o of orders) {
    statusMap[o.status]   = (statusMap[o.status]   ?? 0) + 1;
    priorityMap[o.priority] = (priorityMap[o.priority] ?? 0) + 1;
    const rag = computeRAG({ status: o.status, percentComplete: o.percentComplete, dueDate: o.dueDate?.toISOString(), ragOverride: o.ragOverride });
    ragMap[rag] = (ragMap[rag] ?? 0) + 1;
    totalPct += o.percentComplete;
  }

  const rows: any[] = [
    ['DGCC PES — Orders Export Summary'],
    ['Generated:', new Date().toLocaleString('en-GB')],
    ['Total Orders:', orders.length],
    ['Avg. Completion:', orders.length ? `${Math.round(totalPct / orders.length)}%` : '—'],
    [],
    ['Status Breakdown'],
    ['Status', 'Count'],
    ...Object.entries(statusMap).map(([k, v]) => [k.replace(/_/g,' '), v]),
    [],
    ['Priority Breakdown'],
    ['Priority', 'Count'],
    ...Object.entries(priorityMap).map(([k, v]) => [k, v]),
    [],
    ['RAG Status'],
    ['RAG', 'Count'],
    ...Object.entries(ragMap).map(([k, v]) => [k, v]),
  ];

  return XLSX.utils.aoa_to_sheet(rows);
}

function buildImportTemplate(): XLSX.WorkSheet {
  const headers = [
    'name*',      // required
    'type*',      // PROGRAM|PROJECT|DELIVERABLE|TASK|SUBTASK
    'status',     // NOT_STARTED|IN_PROGRESS|UNDER_REVIEW|BLOCKED|ON_HOLD|DONE|CANCELLED
    'priority',   // LOW|MEDIUM|HIGH|CRITICAL
    'unitCode',   // e.g. UNT-001
    'projectCode',// e.g. PRJ-001
    'ownerEmail', // user email
    'startDate',  // YYYY-MM-DD
    'dueDate',    // YYYY-MM-DD
    'percentComplete', // 0-100
    'notes',
    'links',
    'dependencies',
  ];

  const instructions = [
    ['DGCC PES — Import Template'],
    ['Instructions:'],
    ['  • Fields marked with * are required'],
    ['  • type: PROGRAM, PROJECT, DELIVERABLE, TASK, SUBTASK'],
    ['  • status: NOT_STARTED, IN_PROGRESS, UNDER_REVIEW, BLOCKED, ON_HOLD, DONE, CANCELLED'],
    ['  • priority: LOW, MEDIUM, HIGH, CRITICAL'],
    ['  • unitCode: must match an existing unit code in the system'],
    ['  • projectCode: must match an existing project code'],
    ['  • ownerEmail: must match an existing user email'],
    ['  • dates: YYYY-MM-DD format (e.g. 2025-03-15)'],
    ['  • percentComplete: number 0–100'],
    [],
    headers,
    // Sample row
    ['Annual Procurement Review', 'TASK', 'IN_PROGRESS', 'HIGH', 'PROC', 'GOV-2025', 'manager@dgcc.edu.sa', '2025-01-01', '2025-06-30', '40', 'Annual review per policy', '', ''],
  ];

  const ws = XLSX.utils.aoa_to_sheet(instructions);
  ws['!cols'] = headers.map((h, i) => ({ wch: i === 0 ? 40 : i === 1 ? 16 : 15 }));
  return ws;
}
