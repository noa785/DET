// src/lib/audit/logger.ts
// Call this from every API route that mutates data

import { prisma } from '@/lib/prisma/client';
import type { AuthUser } from '@/types';
import type { AuditAction } from '@prisma/client';

interface AuditParams {
  action: AuditAction;
  module: string;
  user: AuthUser;
  recordId?: string;
  recordCode?: string;
  field?: string;
  oldValue?: string | null;
  newValue?: string | null;
  notes?: string;
  ipAddress?: string;
  // Optional FK links
  orderId?: string;
  govItemId?: string;
  changeId?: string;
}

/**
 * Write an immutable audit log entry.
 * Never throws — audit failure should not break the main operation.
 */
export async function audit(params: AuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        action: params.action,
        module: params.module,
        recordId: params.recordId,
        recordCode: params.recordCode,
        field: params.field,
        oldValue: params.oldValue,
        newValue: params.newValue,
        notes: params.notes,
        userId: params.user.id,
        userEmail: params.user.email,
        userName: params.user.name,
        ipAddress: params.ipAddress,
        orderId: params.orderId,
        govItemId: params.govItemId,
        changeId: params.changeId,
      },
    });
  } catch (err) {
    // Log to stderr but don't throw — audit must not block the main operation
    console.error('[AUDIT ERROR]', err);
  }
}

/**
 * Diff two objects and return changed fields for audit logging.
 */
export function diffObjects(
  oldObj: Record<string, unknown>,
  newObj: Record<string, unknown>,
  fields: string[]
): Array<{ field: string; oldValue: string; newValue: string }> {
  return fields
    .filter(f => String(oldObj[f] ?? '') !== String(newObj[f] ?? ''))
    .map(f => ({
      field: f,
      oldValue: String(oldObj[f] ?? ''),
      newValue: String(newObj[f] ?? ''),
    }));
}
