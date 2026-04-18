// src/app/(protected)/layout.tsx
// Route group layout — wraps orders, governance, audit-log, etc.
// Next.js route groups with () don't affect URL paths.

import { requireAuth } from '@/lib/auth/session';
import AppShell from '@/components/layout/AppShell';

export default async function ProtectedGroupLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth();
  return <AppShell user={user}>{children}</AppShell>;
}
