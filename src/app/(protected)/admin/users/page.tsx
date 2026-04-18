// src/app/(protected)/admin/users/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import { redirect } from 'next/navigation';
import UsersClient from './UsersClient';

export const metadata: Metadata = { title: 'Users & Roles - DGCC PES' };

export default async function UsersPage() {
  const user = await requireAuth();
  if (!can(user, 'admin:users')) redirect('/dashboard');

  const [users, units] = await Promise.all([
    prisma.user.findMany({
      include: { unit: { select: { code: true, name: true } } },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.unit.findMany({
      where: { isActive: true },
      select: { id: true, code: true, name: true },
      orderBy: { code: 'asc' },
    }),
  ]);

  return (
    <UsersClient
      users={JSON.parse(JSON.stringify(users))}
      units={units}
      currentUserId={user.id}
    />
  );
}
