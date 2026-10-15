// src/lib/det/adminlog.ts
// Admin Log: every recorded action (orders created and changed, sign-ins, downloads, imports).

import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma/client';
import type { SectionKey } from './shared';

export const ACTION_LABEL: Record<string, string> = {
  CREATE: 'Created', UPDATE: 'Updated', STATUS_CHANGE: 'Status changed', DELETE: 'Deleted', LOGIN: 'Signed in',
  LOGOUT: 'Signed out', EXPORT: 'Downloaded', IMPORT: 'Imported', APPROVE: 'Approved', REJECT: 'Rejected',
  PUBLISH: 'Published', ARCHIVE: 'Archived', RESTORE: 'Restored',
};

export type LogFilters = { person?: string; action?: string; section?: string; from?: string; to?: string; q?: string };
export type LogRow = {
  id: string; at: string; person: string; email: string; action: string; label: string;
  section: SectionKey | null; orderId: string | null; code: string | null; orderName: string | null; details: string; ip: string | null;
};

/** Build the database filter from the page's filters (dates are Riyadh days). */
export function logWhere(f: LogFilters): Prisma.AuditLogWhereInput {
  const and: Prisma.AuditLogWhereInput[] = [];
  if (f.person) and.push({ userName: f.person });
  if (f.action) and.push(f.action === 'STATUS_CHANGE' || f.action === 'UPDATE' ? { action: { in: ['UPDATE', 'STATUS_CHANGE'] } } : { action: f.action as Prisma.EnumAuditActionFilter['equals'] });
  if (f.section === 'SYSTEMS_ENGINEERING' || f.section === 'AUTOMATION') and.push({ order: { section: f.section } });
  if (f.section === 'GENERAL') and.push({ orderId: null });
  if (f.from && /^\d{4}-\d{2}-\d{2}$/.test(f.from)) and.push({ createdAt: { gte: new Date(`${f.from}T00:00:00+03:00`) } });
  if (f.to && /^\d{4}-\d{2}-\d{2}$/.test(f.to)) and.push({ createdAt: { lte: new Date(`${f.to}T23:59:59.999+03:00`) } });
  const q = f.q?.trim();
  if (q) and.push({ OR: [
    { recordCode: { contains: q, mode: 'insensitive' } }, { notes: { contains: q, mode: 'insensitive' } },
    { userName: { contains: q, mode: 'insensitive' } }, { userEmail: { contains: q, mode: 'insensitive' } },
    { order: { name: { contains: q, mode: 'insensitive' } } },
  ] });
  return and.length ? { AND: and } : {};
}

export async function loadLog(f: LogFilters, skip = 0, take = 50): Promise<{ rows: LogRow[]; total: number }> {
  const where = logWhere(f);
  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where, orderBy: { createdAt: 'desc' }, skip, take,
      select: {
        id: true, createdAt: true, userName: true, userEmail: true, action: true, module: true, recordCode: true,
        notes: true, field: true, oldValue: true, newValue: true, ipAddress: true, orderId: true,
        order: { select: { name: true, section: true, orderCode: true } },
      },
    }),
    prisma.auditLog.count({ where }),
  ]);
  return {
    total,
    rows: rows.map(r => ({
      id: r.id,
      at: r.createdAt.toISOString(),
      person: r.userName || (r.module === 'det-import' ? 'Excel import' : 'System'),
      email: r.userEmail ?? '',
      action: r.action,
      label: ACTION_LABEL[r.action] ?? r.action,
      section: (r.order?.section as SectionKey | undefined) ?? null,
      orderId: r.orderId,
      code: r.order?.orderCode ?? r.recordCode,
      orderName: r.order?.name ?? null,
      details: r.notes || (r.field ? `${r.field}: ${r.oldValue ?? ''} to ${r.newValue ?? ''}` : ''),
      ip: r.ipAddress,
    })),
  };
}

/** Numbers for the strip at the top of the page, and the people for the filter. */
export async function logOverview() {
  const now = new Date();
  const riyadhToday = new Date(new Date(now.getTime() + 3 * 3600e3).toISOString().slice(0, 10) + 'T00:00:00+03:00');
  const week = new Date(now.getTime() - 7 * 86400e3);
  const [today, last7, signIns, people, active] = await Promise.all([
    prisma.auditLog.count({ where: { createdAt: { gte: riyadhToday } } }),
    prisma.auditLog.count({ where: { createdAt: { gte: week } } }),
    prisma.auditLog.count({ where: { action: 'LOGIN', createdAt: { gte: week } } }),
    prisma.auditLog.findMany({ where: { userName: { not: null } }, select: { userName: true }, distinct: ['userName'], orderBy: { userName: 'asc' } }),
    prisma.auditLog.findMany({ where: { createdAt: { gte: week }, userName: { not: null } }, select: { userName: true }, distinct: ['userName'] }),
  ]);
  return { today, last7, signIns, active: active.length, people: people.map(p => p.userName as string) };
}
