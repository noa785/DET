// src/lib/auth/permissions.ts
// Client-safe permission check — no server imports
import { type AuthUser, type Permission, hasPermission } from '@/types';

export function can(user: AuthUser, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}

/** Convenience — check if user can write to governance section */
export function canWriteGovernance(user: AuthUser): boolean {
  return can(user, 'governance:create') || can(user, 'governance:edit');
}

/** True for roles that may download/export Excel files */
export function canExportExcel(user: AuthUser): boolean {
  return can(user, 'export:execute') || can(user, 'orders:export');
}
