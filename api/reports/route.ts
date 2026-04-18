import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma/client";
import ExcelJS from "exceljs";

// ── Helper: Style header row ──
function styleHeaders(sheet: ExcelJS.Worksheet) {
  const headerRow = sheet.getRow(1);
  headerRow.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, name: "Arial", size: 11 };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1E3A5F" },
    };
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true };
    cell.border = {
      bottom: { style: "thin", color: { argb: "FF999999" } },
    };
  });
  headerRow.height = 28;
}

function autoWidth(sheet: ExcelJS.Worksheet) {
  sheet.columns.forEach((col) => {
    let max = 12;
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const len = cell.value ? String(cell.value).length : 0;
      if (len > max) max = Math.min(len + 4, 50);
    });
    col.width = max;
  });
}

function addDataRows(sheet: ExcelJS.Worksheet, startRow: number) {
  const lastRow = sheet.rowCount;
  for (let i = startRow; i <= lastRow; i++) {
    const row = sheet.getRow(i);
    row.eachCell((cell) => {
      cell.font = { name: "Arial", size: 10 };
      cell.alignment = { vertical: "middle", wrapText: true };
      cell.border = {
        bottom: { style: "hair", color: { argb: "FFDDDDDD" } },
      };
    });
    if (i % 2 === 0) {
      row.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF5F7FA" },
        };
      });
    }
  }
}

// ── Filters parser ──
function parseFilters(params: URLSearchParams) {
  return {
    unitCode: params.get("unitCode") || undefined,
    status: params.get("status") || undefined,
    priority: params.get("priority") || undefined,
    fromDate: params.get("fromDate") ? new Date(params.get("fromDate")!) : undefined,
    toDate: params.get("toDate") ? new Date(params.get("toDate")!) : undefined,
    dueDays: params.get("dueDays") ? parseInt(params.get("dueDays")!) : undefined,
  };
}

function buildOrderWhere(filters: ReturnType<typeof parseFilters>) {
  const where: any = {};
  if (filters.unitCode) where.unitCode = filters.unitCode;
  if (filters.status) where.status = filters.status;
  if (filters.priority) where.priority = filters.priority;
  if (filters.fromDate || filters.toDate) {
    where.dueDate = {};
    if (filters.fromDate) where.dueDate.gte = filters.fromDate;
    if (filters.toDate) where.dueDate.lte = filters.toDate;
  }
  return where;
}

// ── Report 1: Executive Summary ──
async function generateExecutiveReport(filters: ReturnType<typeof parseFilters>) {
  const where = buildOrderWhere(filters);
  const orders = await prisma.order.findMany({
    where,
    include: { unit: true },
    orderBy: { dueDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  wb.created = new Date();
  const sheet = wb.addWorksheet("Executive Report");

  sheet.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Days Remaining", key: "daysRemaining", width: 16 },
  ];

  const now = new Date();
  orders.forEach((o: any) => {
    const daysRemaining = o.dueDate
      ? Math.ceil((new Date(o.dueDate).getTime() - now.getTime()) / 86400000)
      : null;
    sheet.addRow({
      orderNumber: o.orderNumber || o.id,
      title: o.title,
      unit: o.unit?.nameAr || o.unitCode,
      status: o.status,
      priority: o.priority,
      progress: o.progress || 0,
      dueDate: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-SA") : "—",
      owner: o.owner || "—",
      daysRemaining: daysRemaining ?? "—",
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 2: Unit Report ──
async function generateUnitReport(filters: ReturnType<typeof parseFilters>) {
  const where = buildOrderWhere(filters);
  const orders = await prisma.order.findMany({
    where,
    include: { unit: true, milestones: true },
    orderBy: { dueDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  const sheet = wb.addWorksheet("Unit Report");

  sheet.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Milestones (Total)", key: "milestones", width: 18 },
    { header: "Milestones (Done)", key: "milestonesDone", width: 18 },
  ];

  orders.forEach((o: any) => {
    const done = o.milestones?.filter((m: any) => m.status === "COMPLETED").length || 0;
    sheet.addRow({
      orderNumber: o.orderNumber || o.id,
      title: o.title,
      unit: o.unit?.nameAr || o.unitCode,
      status: o.status,
      priority: o.priority,
      progress: o.progress || 0,
      dueDate: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-SA") : "—",
      owner: o.owner || "—",
      milestones: o.milestones?.length || 0,
      milestonesDone: done,
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 3: Governance Report ──
async function generateGovernanceReport(filters: ReturnType<typeof parseFilters>) {
  const govWhere: any = {};
  if (filters.unitCode) govWhere.unitCode = filters.unitCode;
  if (filters.status) govWhere.status = filters.status;

  const items = await prisma.governanceItem.findMany({
    where: govWhere,
    include: { unit: true },
    orderBy: { createdAt: "desc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  const sheet = wb.addWorksheet("Governance Report");

  sheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Type", key: "type", width: 16 },
    { header: "Status", key: "status", width: 14 },
    { header: "Evidence", key: "evidence", width: 16 },
    { header: "Review Date", key: "reviewDate", width: 14 },
    { header: "Next Review", key: "nextReview", width: 14 },
    { header: "Compliance %", key: "compliance", width: 14 },
  ];

  items.forEach((g: any) => {
    sheet.addRow({
      id: g.id,
      title: g.title,
      unit: g.unit?.nameAr || g.unitCode,
      type: g.type || "—",
      status: g.status,
      evidence: g.evidenceStatus || "—",
      reviewDate: g.effectiveDate ? new Date(g.effectiveDate).toLocaleDateString("en-SA") : "—",
      nextReview: g.nextReviewDate ? new Date(g.nextReviewDate).toLocaleDateString("en-SA") : "—",
      compliance: g.complianceScore ?? "—",
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 4: Overdue Report ──
async function generateOverdueReport(filters: ReturnType<typeof parseFilters>) {
  const now = new Date();
  const where: any = {
    ...buildOrderWhere(filters),
    dueDate: { lt: now },
    status: { notIn: ["COMPLETED", "CANCELLED"] },
  };

  const orders = await prisma.order.findMany({
    where,
    include: { unit: true },
    orderBy: { dueDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  const sheet = wb.addWorksheet("Overdue Orders");

  sheet.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Days Overdue", key: "daysOverdue", width: 14 },
    { header: "Owner", key: "owner", width: 20 },
  ];

  orders.forEach((o: any) => {
    const daysOverdue = o.dueDate
      ? Math.ceil((now.getTime() - new Date(o.dueDate).getTime()) / 86400000)
      : 0;
    sheet.addRow({
      orderNumber: o.orderNumber || o.id,
      title: o.title,
      unit: o.unit?.nameAr || o.unitCode,
      status: o.status,
      priority: o.priority,
      progress: o.progress || 0,
      dueDate: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-SA") : "—",
      daysOverdue,
      owner: o.owner || "—",
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 5: Critical Orders ──
async function generateCriticalReport(filters: ReturnType<typeof parseFilters>) {
  const where: any = {
    ...buildOrderWhere(filters),
    priority: "CRITICAL",
  };

  const orders = await prisma.order.findMany({
    where,
    include: { unit: true, raidItems: true },
    orderBy: { dueDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  const sheet = wb.addWorksheet("Critical Orders");

  sheet.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Owner", key: "owner", width: 20 },
    { header: "Risks", key: "risks", width: 10 },
    { header: "Issues", key: "issues", width: 10 },
  ];

  orders.forEach((o: any) => {
    const risks = o.raidItems?.filter((r: any) => r.type === "RISK").length || 0;
    const issues = o.raidItems?.filter((r: any) => r.type === "ISSUE").length || 0;
    sheet.addRow({
      orderNumber: o.orderNumber || o.id,
      title: o.title,
      unit: o.unit?.nameAr || o.unitCode,
      status: o.status,
      progress: o.progress || 0,
      dueDate: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-SA") : "—",
      owner: o.owner || "—",
      risks,
      issues,
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 6: Due Soon ──
async function generateDueSoonReport(filters: ReturnType<typeof parseFilters>) {
  const now = new Date();
  const days = filters.dueDays || 14;
  const futureDate = new Date(now.getTime() + days * 86400000);

  const where: any = {
    ...buildOrderWhere(filters),
    dueDate: { gte: now, lte: futureDate },
    status: { notIn: ["COMPLETED", "CANCELLED"] },
  };

  const orders = await prisma.order.findMany({
    where,
    include: { unit: true },
    orderBy: { dueDate: "asc" },
  });

  const wb = new ExcelJS.Workbook();
  wb.creator = "DGCC PES";
  const sheet = wb.addWorksheet(`Due Within ${days} Days`);

  sheet.columns = [
    { header: "Order #", key: "orderNumber", width: 14 },
    { header: "Title", key: "title", width: 35 },
    { header: "Unit", key: "unit", width: 18 },
    { header: "Status", key: "status", width: 14 },
    { header: "Priority", key: "priority", width: 12 },
    { header: "Progress %", key: "progress", width: 12 },
    { header: "Due Date", key: "dueDate", width: 14 },
    { header: "Days Left", key: "daysLeft", width: 12 },
    { header: "Owner", key: "owner", width: 20 },
  ];

  orders.forEach((o: any) => {
    const daysLeft = o.dueDate
      ? Math.ceil((new Date(o.dueDate).getTime() - now.getTime()) / 86400000)
      : null;
    sheet.addRow({
      orderNumber: o.orderNumber || o.id,
      title: o.title,
      unit: o.unit?.nameAr || o.unitCode,
      status: o.status,
      priority: o.priority,
      progress: o.progress || 0,
      dueDate: o.dueDate ? new Date(o.dueDate).toLocaleDateString("en-SA") : "—",
      daysLeft: daysLeft ?? "—",
      owner: o.owner || "—",
    });
  });

  styleHeaders(sheet);
  addDataRows(sheet, 2);
  autoWidth(sheet);
  return wb;
}

// ── Report 1-6: Preview data (JSON) ──
async function getPreviewData(type: string, filters: ReturnType<typeof parseFilters>) {
  const now = new Date();
  switch (type) {
    case "executive": {
      const where = buildOrderWhere(filters);
      return prisma.order.findMany({
        where,
        include: { unit: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      });
    }
    case "unit": {
      const where = buildOrderWhere(filters);
      return prisma.order.findMany({
        where,
        include: { unit: true, milestones: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      });
    }
    case "governance": {
      const govWhere: any = {};
      if (filters.unitCode) govWhere.unitCode = filters.unitCode;
      if (filters.status) govWhere.status = filters.status;
      return prisma.governanceItem.findMany({
        where: govWhere,
        include: { unit: true },
        orderBy: { createdAt: "desc" },
        take: 50,
      });
    }
    case "overdue": {
      return prisma.order.findMany({
        where: {
          ...buildOrderWhere(filters),
          dueDate: { lt: now },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        include: { unit: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      });
    }
    case "critical": {
      return prisma.order.findMany({
        where: { ...buildOrderWhere(filters), priority: "CRITICAL" },
        include: { unit: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      });
    }
    case "due-soon": {
      const days = filters.dueDays || 14;
      const futureDate = new Date(now.getTime() + days * 86400000);
      return prisma.order.findMany({
        where: {
          ...buildOrderWhere(filters),
          dueDate: { gte: now, lte: futureDate },
          status: { notIn: ["COMPLETED", "CANCELLED"] },
        },
        include: { unit: true },
        orderBy: { dueDate: "asc" },
        take: 50,
      });
    }
    default:
      return [];
  }
}

// ── GET: Preview ──
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const type = searchParams.get("type") || "executive";
    const filters = parseFilters(searchParams);
    const data = await getPreviewData(type, filters);
    return NextResponse.json({ data, count: Array.isArray(data) ? data.length : 0 });
  } catch (error: any) {
    console.error("Report preview error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// ── POST: Download Excel ──
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, filters: rawFilters } = body;
    const params = new URLSearchParams(rawFilters || {});
    const filters = parseFilters(params);

    const generators: Record<string, Function> = {
      executive: generateExecutiveReport,
      unit: generateUnitReport,
      governance: generateGovernanceReport,
      overdue: generateOverdueReport,
      critical: generateCriticalReport,
      "due-soon": generateDueSoonReport,
    };

    const gen = generators[type];
    if (!gen) {
      return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
    }

    const wb = await gen(filters);
    const buffer = await wb.xlsx.writeBuffer();

    const reportNames: Record<string, string> = {
      executive: "Executive_Report",
      unit: "Unit_Report",
      governance: "Governance_Report",
      overdue: "Overdue_Report",
      critical: "Critical_Orders_Report",
      "due-soon": "Due_Soon_Report",
    };

    const filename = `${reportNames[type] || "Report"}_${new Date().toISOString().slice(0, 10)}.xlsx`;

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error: any) {
    console.error("Report download error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
