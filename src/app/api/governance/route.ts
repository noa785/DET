// src/app/api/governance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

const CreateGovSchema = z.object({
  title:            z.string().min(1).max(500).trim(),
  type:             z.enum(['POLICY','PROCEDURE','STANDARD','GUIDELINE','COMMITTEE_DECISION','CONTROL','COMPLIANCE_REQUIREMENT','UPDATE_ITEM']),
  status:           z.enum(['DRAFT','ACTIVE','UNDER_REVIEW','SUPERSEDED','ARCHIVED']).default('DRAFT'),
  priority:         z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  riskLevel:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).default('MEDIUM'),
  unitId:           z.string().optional().nullable(),
  ownerId:          z.string().optional().nullable(),
  reviewerId:       z.string().optional().nullable(),
  version:          z.string().default('1.0'),
  effectiveDate:    z.string().optional().nullable(),
  reviewCycleDays:  z.number().int().optional().nullable(),
  nextReviewDate:   z.string().optional().nullable(),
  source:           z.string().optional().nullable(),
  notes:            z.string().optional().nullable(),
  complianceImpact: z.string().optional().nullable(),
  evidenceLinks:    z.string().optional().nullable(),
});

export async function GET(req: NextRequest) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;

  const { searchParams } = req.nextUrl;
  const where: any = { isDeleted: false };
  if (searchParams.get('type'))   where.type   = searchParams.get('type');
  if (searchParams.get('status')) where.status = searchParams.get('status');
  if (searchParams.get('unitId')) where.unitId = searchParams.get('unitId');

  const items = await prisma.governanceItem.findMany({
    where,
    include: {
      unit:     { select: { code: true, name: true } },
      owner:    { select: { name: true } },
      govTasks: { select: { id: true, status: true } },
    },
    orderBy: { updatedAt: 'desc' },
  });

  return NextResponse.json({ data: items });
}

export async function POST(req: NextRequest) {
  const user = await requirePermission('governance:create');
  if (isErrorResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = CreateGovSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });
  }

  const data = parsed.data;

  const seq = await prisma.sequence.update({
    where: { id: 'gov_item' },
    data:  { current: { increment: 1 } },
  });
  const govCode = `GOV-${String(seq.current).padStart(seq.padding, '0')}`;

  const item = await prisma.governanceItem.create({
    data: {
      govCode,
      title:            data.title,
      type:             data.type,
      status:           data.status,
      priority:         data.priority,
      riskLevel:        data.riskLevel,
      unitId:           data.unitId ?? null,
      ownerId:          data.ownerId ?? null,
      reviewerId:       data.reviewerId ?? null,
      version:          data.version,
      effectiveDate:    data.effectiveDate    ? new Date(data.effectiveDate)  : null,
      nextReviewDate:   data.nextReviewDate   ? new Date(data.nextReviewDate) : null,
      reviewCycleDays:  data.reviewCycleDays  ?? null,
      source:           data.source           ?? null,
      notes:            data.notes            ?? null,
      complianceImpact: data.complianceImpact ?? null,
      evidenceLinks:    data.evidenceLinks    ?? null,
      createdById:      user.id,
      updatedById:      user.id,
    },
  });

  await audit({ action: 'CREATE', module: 'governance', user, recordId: item.id, recordCode: govCode, notes: `Created "${data.title}"` });

  return NextResponse.json({ data: item }, { status: 201 });
}
