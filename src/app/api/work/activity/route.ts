// src/app/api/work/activity/route.ts
// Records sign-ins, sign-outs and report downloads in the Admin Log.

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const Body = z.object({
  action: z.enum(['LOGIN', 'LOGOUT', 'EXPORT']),
  notes: z.string().trim().max(300).optional(),
});
const DEFAULT_NOTE = { LOGIN: 'Signed in', LOGOUT: 'Signed out', EXPORT: 'Downloaded a report' } as const;

export async function POST(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: 'Invalid data' }, { status: 400 });
  const { action, notes } = parsed.data;
  await audit({
    action, module: action === 'EXPORT' ? 'export' : 'auth', user,
    notes: notes || DEFAULT_NOTE[action],
    ipAddress: req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || undefined,
  });
  return NextResponse.json({ data: { ok: true } });
}
