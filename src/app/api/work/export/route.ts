// src/app/api/work/export/route.ts
// Download one section as an Excel workbook: /api/work/export?section=systems-engineering

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { canDownloadSection, sectionFromSlug, SECTIONS } from '@/lib/det/shared';
import { buildSectionWorkbook } from '@/lib/det/excel';
import { getLang } from '@/lib/i18n/server';
import { makeT } from '@/lib/i18n/core';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Each team downloads its own section; the committee chair downloads both.
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  const lang = getLang(), t = makeT(lang);
  const section = sectionFromSlug(req.nextUrl.searchParams.get('section') ?? '');
  if (!section) return NextResponse.json({ error: t('Unknown section') }, { status: 400 });
  if (!canDownloadSection(user.role, section)) {
    return NextResponse.json({ error: t('You cannot download {section}.', { section: t(SECTIONS[section].name) }) }, { status: 403 });
  }

  const { buffer, fileName, count } = await buildSectionWorkbook(section, user.name, lang);
  await audit({ action: 'EXPORT', module: 'export', user, notes: `Downloaded ${SECTIONS[section].name} as Excel (${count} orders)` });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
