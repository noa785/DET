// src/app/(protected)/projects/[id]/edit/page.tsx
import { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import EditProjectForm from './EditProjectForm';

export const metadata: Metadata = { title: 'Edit Project — DGCC PES' };

export default async function EditProjectPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();

  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    redirect('/projects');
  }

  const project = await prisma.project.findUnique({
    where: { id: params.id, isActive: true },
  });

  if (!project) notFound();

  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  return (
    <EditProjectForm
      units={units}
      project={{
        id: project.id,
        code: project.code,
        name: project.name,
        unitId: project.unitId,
        phase: project.phase,
        startDate: project.startDate?.toISOString().split('T')[0] ?? '',
        endDate: project.endDate?.toISOString().split('T')[0] ?? '',
        sponsor: project.sponsor ?? '',
        description: project.description ?? '',
      }}
    />
  );
}
