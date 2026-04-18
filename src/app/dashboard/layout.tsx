// src/app/dashboard/layout.tsx
// This layout wraps ALL protected pages (dashboard, orders, governance, etc.)
// It checks auth server-side and renders the shell.

import { requireAuth } from '@/lib/auth/session';
import AppShell from '@/components/layout/AppShell';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await requireAuth(); // redirects to /auth/login if not authed

  return <AppShell user={user}>{children}</AppShell>;
}
