import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma/client';
import { computeRAG, isOverdue } from '@/lib/business-logic/orders';
import GridPageClient from './GridPageClient';

export const metadata: Metadata = { title: 'Grid Editor — DGCC PES' };

// Roles blocked from Grid Editor entirely
const BLOCKED_ROLES = ['VIEWER', 'GOV_EDITOR', 'IMPORT_VIEWER'];

export default async function GridPage() {
  const user = await requireAuth();

  // Redirect blocked roles back to orders list
  if (BLOCKED_ROLES.includes(user.role)) {
    redirect('/orders');
  }

  const [rawOrders, units, projects, users, total] = await Promise.all([
    prisma.order.findMany({
      where: { isDeleted: false },
      include: {
        unit:    { select: { code: true, name: true, colorHex: true } },
        project: { select: { code: true, name: true } },
        owner:   { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'asc' },
      take: 200,
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true, colorHex: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
    prisma.order.count({ where: { isDeleted: false } }),
  ]);

  const rows = rawOrders.map(o => ({
    id:              o.id,
    orderCode:       o.orderCode,
    type:            o.type,
    name:            o.name,
    unitId:          o.unitId ?? '',
    unitCode:        o.unit?.code ?? '',
    unitColor:       o.unit?.colorHex ?? '',
    projectId:       o.projectId ?? '',
    projectName:     o.project?.name ?? '',
    ownerId:         o.ownerId ?? '',
    ownerName:       o.owner?.name ?? '',
    priority:        o.priority,
    status:          o.status,
    startDate:       o.startDate ? o.startDate.toISOString().slice(0, 10) : '',
    dueDate:         o.dueDate   ? o.dueDate.toISOString().slice(0, 10)   : '',
    percentComplete: o.percentComplete,
    rescheduleCount: o.rescheduleCount,
    notes:           o.notes ?? '',
    ragOverride:     o.ragOverride ?? '',
    effectiveRAG: computeRAG({
      status: o.status as any,
      percentComplete: o.percentComplete,
      dueDate: o.dueDate?.toISOString(),
      ragOverride: o.ragOverride as any,
    }),
    isOverdue: isOverdue({
      status: o.status as any,
      percentComplete: o.percentComplete,
      dueDate: o.dueDate?.toISOString(),
    }),
  }));

  return (
    <GridPageClient
      initialRows={rows}
      units={units.map(u => ({ id: u.id, label: `${u.code} — ${u.name}`, code: u.code ?? '', color: u.colorHex ?? '' }))}
      projects={projects.map(p => ({ id: p.id, label: `${p.code} — ${p.name}`, code: p.code ?? '' }))}
      users={users.map(u => ({ id: u.id, label: u.name }))}
      canEdit={!BLOCKED_ROLES.includes(user.role)}
      totalRows={total}
    />
  );
}
