// src/app/api/work/governance/route.ts
// Governance register: add an item (governance officer).

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { canEditGovernance } from '@/lib/det/shared';
import { GovInput, saveGovItem } from '@/lib/det/govwrite';

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  if (!canEditGovernance(user.role)) return NextResponse.json({ error: 'Only the governance officer can add governance items.' }, { status: 403 });
  const parsed = GovInput.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 });
  const r = await saveGovItem(parsed.data);
  if (r.error || !r.item) return NextResponse.json({ error: r.error ?? 'Could not save' }, { status: 400 });
  await audit({ action: 'CREATE', module: 'governance', user, recordId: r.item.id, recordCode: r.item.code, notes: `Governance item added: ${r.item.title}` });
  return NextResponse.json({ data: r.item }, { status: 201 });
}
