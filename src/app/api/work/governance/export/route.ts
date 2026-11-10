// src/app/api/work/governance/export/route.ts
// Download the governance register as an Excel workbook: /api/work/governance/export

import { NextResponse } from 'next/server';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';
import { buildGovernanceWorkbook } from '@/lib/det/excel';
import { getLang } from '@/lib/i18n/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;
  const { buffer, fileName, count } = await buildGovernanceWorkbook(user.name, getLang());
  await audit({ action: 'EXPORT', module: 'export', user, notes: `Downloaded the governance register as Excel (${count} items)` });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${fileName}"`,
      'Cache-Control': 'no-store',
    },
  });
}
