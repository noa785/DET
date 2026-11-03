// src/app/api/sync/route.ts
// Google Sheets sync: called every 5 minutes by the DET Apps Script (see scripts/google-sheets/DET-sync.gs).
// Protected by a shared secret (SYNC_TOKEN), not by a user session.

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { syncGovernance, syncOrders } from '@/lib/det/sheetsync';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const Body = z.object({
  kind: z.enum(['orders', 'governance']),
  section: z.enum(['SYSTEMS_ENGINEERING', 'AUTOMATION']).optional(),
  rows: z.array(z.object({
    key: z.string().max(20),
    values: z.record(z.union([z.string(), z.number(), z.null()])),
    fields: z.array(z.string().max(40)).max(40).optional(),   // the cells that changed in the sheet
  })).max(2000),
});

function authorised(req: NextRequest): boolean {
  const expected = process.env.SYNC_TOKEN ?? '';
  const given = req.headers.get('x-det-sync-token') ?? '';
  if (expected.length < 24 || given.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(expected));
}

export async function POST(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? 'Invalid data' }, { status: 400 });
  const b = parsed.data;
  if (b.kind === 'orders' && !b.section) return NextResponse.json({ error: 'section is required for orders' }, { status: 400 });
  const result = b.kind === 'orders' ? await syncOrders(b.section!, b.rows) : await syncGovernance(b.rows);
  return NextResponse.json({ data: result, at: new Date().toISOString() });
}
