// src/app/(protected)/projects/page.tsx
import { Metadata } from 'next';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import ProjectsClient from './ProjectsClient';

export const metadata: Metadata = { title: 'Projects — DGCC PES' };

export default async function ProjectsPage() {
  const user = await requireAuth();

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    include: {
      unit: { select: { code: true, name: true, colorHex: true } },
      createdBy: { select: { name: true } },
      _count: { select: { orders: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  // Serialize for client component
  const serialized = projects.map(p => ({
    id: p.id,
    code: p.code,
    name: p.name,
    description: p.description,
    phase: p.phase,
    sponsor: p.sponsor,
    startDate: p.startDate?.toISOString() ?? null,
    endDate: p.endDate?.toISOString() ?? null,
    unit: p.unit ? { code: p.unit.code, name: p.unit.name, colorHex: p.unit.colorHex } : null,
    createdBy: p.createdBy ? { name: p.createdBy.name } : null,
    orderCount: p._count.orders,
  }));

  // Check if user can manage projects (admin only)
  const canManage = user.role === 'SUPER_ADMIN' || user.role === 'ADMIN';

  return <ProjectsClient projects={serialized} canManage={canManage} />;
}
