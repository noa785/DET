// src/app/(protected)/layout.tsx
// Route group layout: every signed-in page is wrapped in the DET v2 shell.

import { requireAuth } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import AppShell from '@/components/layout/AppShell';
import type { SectionKey } from '@/lib/det/shared';

export const dynamic = 'force-dynamic';

export default async function ProtectedGroupLayout({ children }: { children: React.ReactNode }) {
  const user = await requireAuth();
  const grouped = await prisma.order.groupBy({
    by: ['section'],
    where: { isDeleted: false, status: { not: 'CANCELLED' } },
    _count: { _all: true },
  });
  const counts = Object.fromEntries(grouped.map(g => [g.section, g._count._all])) as Partial<Record<SectionKey, number>>;
  return <AppShell user={user} counts={counts}>{children}</AppShell>;
}
