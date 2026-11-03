// src/app/api/sync/run/route.ts
// Runs the Google Sheets sync from DET itself (no Apps Script needed): /api/sync/run?file=se|au|gov|all
// Called every 5 minutes by a Supabase schedule (pg_cron, see prisma/migrations-sql/2026-11-det-sheets-schedule.sql).

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { runSheetSync, SHEET_FILES, type FileKey } from '@/lib/det/sheetrunner';
import { serviceAccountEmail } from '@/lib/det/gsheets';
import { prisma } from '@/lib/prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const same = (a: string, b: string) => b.length >= 24 && a.length === b.length && timingSafeEqual(Buffer.from(a), Buffer.from(b));

/** The secret the Supabase schedule sends: SYNC_TOKEN, or the one it made itself in table det_sync_secret. */
async function authorised(req: NextRequest): Promise<boolean> {
  const given = req.headers.get('x-det-sync-token') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!given) return false;
  if (same(given, process.env.SYNC_TOKEN ?? '')) return true;
  try {
    const rows = await prisma.$queryRaw<{ value: string }[]>`select value from public.det_sync_secret where id = 1`;
    return !!rows[0] && same(given, rows[0].value);
  } catch { return false; }
}

async function handle(req: NextRequest) {
  if (!(await authorised(req))) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const want = req.nextUrl.searchParams.get('file') ?? 'all';
  const files = (want === 'all' ? Object.keys(SHEET_FILES) : [want]) as FileKey[];
  if (files.some(f => !(f in SHEET_FILES))) return NextResponse.json({ error: 'file must be se, au, gov or all' }, { status: 400 });
  const results = [];
  for (const f of files) results.push(await runSheetSync(f));
  return NextResponse.json({ serviceAccount: serviceAccountEmail(), results, at: new Date().toISOString() });
}
export const GET = handle;
export const POST = handle;
