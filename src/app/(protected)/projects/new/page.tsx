// src/app/(protected)/projects/new/page.tsx
import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import NewProjectForm from './NewProjectForm';

export const metadata: Metadata = { title: 'New Project — DGCC PES' };

export default async function NewProjectPage() {
  const user = await requireAuth();

  // Only admins can access this page
  if (user.role !== 'SUPER_ADMIN' && user.role !== 'ADMIN') {
    redirect('/projects');
  }

  // Load units for the dropdown
  const units = await prisma.unit.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  return <NewProjectForm units={units} />;
}
