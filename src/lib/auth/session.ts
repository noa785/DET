// src/lib/auth/session.ts
// Server-side auth helpers — use in API routes and Server Components

import { createSupabaseServerClient } from '@/lib/supabase/server';
import { prisma } from '@/lib/prisma/client';
import { type AuthUser, type Permission, hasPermission, type Role } from '@/types';
import { redirect } from 'next/navigation';

/**
 * Get current authenticated user with role from DB.
 * Returns null if not authenticated.
 */
export async function getSession(): Promise<AuthUser | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const dbUser = await prisma.user.findUnique({
      where: { email: user.email! },
      select: {
        id: true,
        email: true,
        name: true,
        initials: true,
        role: true,
        unitId: true,
        unit: { select: { code: true } },
        isActive: true,
      },
    });

    if (!dbUser || !dbUser.isActive) return null;

    return {
      id: dbUser.id,
      email: dbUser.email,
      name: dbUser.name,
      initials: dbUser.initials ?? undefined,
      role: dbUser.role as Role,
      unitId: dbUser.unitId ?? undefined,
      unitCode: dbUser.unit?.code ?? undefined,
    };
  } catch {
    return null;
  }
}

/**
 * Require authentication — redirects to login if not authenticated.
 * Use in Server Components and page.tsx files.
 */
export async function requireAuth(): Promise<AuthUser> {
  const user = await getSession();
  if (!user) redirect('/auth/login');
  return user;
}

/**
 * Require a specific permission — returns 403 response if denied.
 * Use in API Route Handlers.
 */
export async function requirePermission(
  permission: Permission
): Promise<AuthUser | Response> {
  const user = await getSession();
  if (!user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  if (!hasPermission(user.role, permission)) {
    return Response.json(
      { error: `Forbidden: requires ${permission}` },
      { status: 403 }
    );
  }
  return user;
}

/**
 * Type guard for requirePermission return value.
 */
export function isErrorResponse(value: AuthUser | Response): value is Response {
  return value instanceof Response;
}

/**
 * Check if user has permission (non-throwing, use in UI).
 */
export function can(user: AuthUser, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}
