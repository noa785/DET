// src/app/api/work/governance/[id]/route.ts
// Governance register: update or remove an item (governance officer).

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { canEditGovernance } from '@/lib/det/shared';
import { GovInput, saveGovItem } from '@/lib/det/govwrite';

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  if (!canEditGovernance(user.role)) return NextResponse.json({ error: 'Only the governance officer can edit governance items.' }, { status: 403 });
  const parsed = GovInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 });
  const r = await saveGovItem(parsed.data, { id: params.id });
  if (r.error || !r.item) return NextResponse.json({ error: r.error ?? 'Could not save' }, { status: 400 });
  await audit({ action: 'UPDATE', module: 'governance', user, recordId: r.item.id, recordCode: r.item.code, notes: `Governance item updated: ${r.item.title}` });
  return NextResponse.json({ data: r.item });
}

// DELETE hides the item (soft delete); the record stays for the audit trail.
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  if (!canEditGovernance(user.role)) return NextResponse.json({ error: 'Only the governance officer can remove governance items.' }, { status: 403 });
  const row = await prisma.detGovItem.update({ where: { id: params.id }, data: { isDeleted: true }, select: { id: true, code: true } }).catch(() => null);
  if (!row) return NextResponse.json({ error: 'Item not found' }, { status: 404 });
  await audit({ action: 'DELETE', module: 'governance', user, recordId: row.id, recordCode: row.code, notes: 'Governance item removed (hidden)' });
  return NextResponse.json({ data: { id: row.id } });
}
