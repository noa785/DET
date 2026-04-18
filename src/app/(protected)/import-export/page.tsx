// src/app/(protected)/import-export/page.tsx
import { Metadata } from 'next';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import ImportExportClient from './ImportExportClient';

export const metadata: Metadata = { title: 'Import / Export — DGCC PES' };

export default async function ImportExportPage() {
  const user = await requireAuth();

  const units = await prisma.unit.findMany({
    where:   { isActive: true },
    select:  { id: true, code: true, name: true },
    orderBy: { code: 'asc' },
  });

  return (
    <ImportExportClient
      units={units.map(u => ({ id: u.id, code: u.code ?? '', name: u.name }))}
      canImport={can(user, 'orders:create')}
    />
  );
}
