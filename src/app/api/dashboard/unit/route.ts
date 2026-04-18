// src/app/api/dashboard/unit/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

// GET /api/dashboard/unit?code=DO
export async function GET(req: NextRequest) {
  const auth = await requirePermission('orders:view');
  if (isErrorResponse(auth)) return auth;

  const code = req.nextUrl.searchParams.get('code');
  if (!code) return NextResponse.json({ error: 'unit code required' }, { status: 400 });

  const unit = await prisma.unit.findUnique({ where: { code } });
  if (!unit) return NextResponse.json({ error: 'unit not found' }, { status: 404 });

  const orders = await prisma.order.findMany({
    where: { unitId: unit.id, isDeleted: false },
    include: {
      owner: { select: { name: true, initials: true } },
      project: { select: { code: true, name: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  const now = new Date();
  const total = orders.length;
  const done = orders.filter(o => o.status === 'DONE').length;
  const inProgress = orders.filter(o => o.status === 'IN_PROGRESS').length;
  const blocked = orders.filter(o => o.status === 'BLOCKED').length;
  const overdue = orders.filter(o => o.dueDate && o.dueDate < now && o.percentComplete < 100 && o.status !== 'DONE' && o.status !== 'CANCELLED').length;
  const avgCompletion = total > 0 ? Math.round(orders.reduce((sum, o) => sum + o.percentComplete, 0) / total) : 0;

  // Upcoming due (next 14 days)
  const twoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);
  const upcomingDue = orders.filter(o => o.dueDate && o.dueDate >= now && o.dueDate <= twoWeeks && o.status !== 'DONE' && o.status !== 'CANCELLED');

  // Critical / high priority
  const critical = orders.filter(o => o.priority === 'CRITICAL' && o.status !== 'DONE' && o.status !== 'CANCELLED');

  // Gov items for this unit
  const govItems = await prisma.governanceItem.count({ where: { unitId: unit.id, isDeleted: false } });
  const govTasksOpen = await prisma.governanceTask.count({
    where: { govItem: { unitId: unit.id }, isDeleted: false, status: { notIn: ['DONE', 'CANCELLED'] } },
  });

  // Status distribution
  const statusDist = [
    { label: 'Done', count: done, color: '#10b981' },
    { label: 'In Progress', count: inProgress, color: '#3b82f6' },
    { label: 'Blocked', count: blocked, color: '#ef4444' },
    { label: 'Not Started', count: orders.filter(o => o.status === 'NOT_STARTED').length, color: '#374151' },
    { label: 'Under Review', count: orders.filter(o => o.status === 'UNDER_REVIEW').length, color: '#f59e0b' },
    { label: 'On Hold', count: orders.filter(o => o.status === 'ON_HOLD').length, color: '#6b7280' },
  ];

  // Priority distribution
  const priorityDist = [
    { label: 'Critical', count: orders.filter(o => o.priority === 'CRITICAL').length, color: '#ef4444' },
    { label: 'High', count: orders.filter(o => o.priority === 'HIGH').length, color: '#f59e0b' },
    { label: 'Medium', count: orders.filter(o => o.priority === 'MEDIUM').length, color: '#3b82f6' },
    { label: 'Low', count: orders.filter(o => o.priority === 'LOW').length, color: '#10b981' },
  ];

  const serializedOrders = orders.map(o => ({
    id: o.id, orderCode: o.orderCode, name: o.name, type: o.type,
    status: o.status, priority: o.priority, percentComplete: o.percentComplete,
    ownerName: o.owner?.name ?? null, projectName: o.project?.name ?? null,
    dueDate: o.dueDate?.toISOString().slice(0, 10) ?? null,
    startDate: o.startDate?.toISOString().slice(0, 10) ?? null,
    isOverdue: o.dueDate ? o.dueDate < now && o.percentComplete < 100 && o.status !== 'DONE' && o.status !== 'CANCELLED' : false,
  }));

  return NextResponse.json({
    unit: { id: unit.id, code: unit.code, name: unit.name, colorHex: unit.colorHex },
    stats: { total, done, inProgress, blocked, overdue, avgCompletion, govItems, govTasksOpen },
    statusDist,
    priorityDist,
    orders: serializedOrders,
    upcomingDue: upcomingDue.map(o => ({ id: o.id, orderCode: o.orderCode, name: o.name, dueDate: o.dueDate?.toISOString().slice(0, 10) ?? null, percentComplete: o.percentComplete })),
    critical: critical.map(o => ({ id: o.id, orderCode: o.orderCode, name: o.name, status: o.status, percentComplete: o.percentComplete })),
  });
}
