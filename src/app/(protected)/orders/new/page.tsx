// src/app/(protected)/orders/new/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import OrderForm from '../_components/OrderForm';

export const metadata: Metadata = { title: 'New Order — DGCC PES' };

export default async function NewOrderPage() {
  const user = await requireAuth();
  if (!can(user, 'orders:create')) redirect('/orders');

  const [units, projects, users] = await Promise.all([
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.project.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <OrderForm
      mode="create"
      units={units.map(u => ({ id: u.id, label: `${u.code} — ${u.name}`, code: u.code ?? '' }))}
      projects={projects.map(p => ({ id: p.id, label: `${p.code} — ${p.name}` }))}
      users={users.map(u => ({ id: u.id, label: u.name }))}
    />
  );
}
