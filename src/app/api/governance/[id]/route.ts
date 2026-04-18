// src/app/api/governance/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';

const PatchSchema = z.object({
  title:            z.string().min(1).max(500).trim().optional(),
  type:             z.enum(['POLICY','PROCEDURE','STANDARD','GUIDELINE','COMMITTEE_DECISION','CONTROL','COMPLIANCE_REQUIREMENT','UPDATE_ITEM']).optional(),
  status:           z.enum(['DRAFT','ACTIVE','UNDER_REVIEW','SUPERSEDED','ARCHIVED']).optional(),
  priority:         z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  riskLevel:        z.enum(['LOW','MEDIUM','HIGH','CRITICAL']).optional(),
  unitId:           z.string().nullable().optional(),
  ownerId:          z.string().nullable().optional(),
  reviewerId:       z.string().nullable().optional(),
  version:          z.string().optional(),
  effectiveDate:    z.string().nullable().optional(),
  reviewCycleDays:  z.number().int().nullable().optional(),
  nextReviewDate:   z.string().nullable().optional(),
  source:           z.string().nullable().optional(),
  notes:            z.string().nullable().optional(),
  complianceImpact: z.string().nullable().optional(),
  evidenceLinks:    z.string().nullable().optional(),
});

export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:view');
  if (isErrorResponse(user)) return user;

  const item = await prisma.governanceItem.findUnique({
    where: { id: params.id, isDeleted: false },
    include: {
      unit:      { select: { code: true, name: true } },
      owner:     { select: { id: true, name: true } },
      reviewer:  { select: { id: true, name: true } },
      govTasks:  { where: { isDeleted: false }, include: { assignee: { select: { name: true } } } },
      updateLogs:{ orderBy: { createdAt: 'desc' }, take: 30 },
    },
  });
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json({ data: item });
}

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:edit');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.governanceItem.findUnique({ where: { id: params.id, isDeleted: false } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const body = await req.json().catch(() => null);
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Validation failed', issues: parsed.error.issues }, { status: 422 });

  const data = parsed.data;
  const updated = await prisma.governanceItem.update({
    where: { id: params.id },
    data: {
      ...(data.title            !== undefined && { title: data.title }),
      ...(data.type             !== undefined && { type: data.type }),
      ...(data.status           !== undefined && { status: data.status }),
      ...(data.priority         !== undefined && { priority: data.priority }),
      ...(data.riskLevel        !== undefined && { riskLevel: data.riskLevel }),
      ...(data.unitId           !== undefined && { unitId: data.unitId }),
      ...(data.ownerId          !== undefined && { ownerId: data.ownerId }),
      ...(data.reviewerId       !== undefined && { reviewerId: data.reviewerId }),
      ...(data.version          !== undefined && { version: data.version }),
      ...(data.effectiveDate    !== undefined && { effectiveDate: data.effectiveDate ? new Date(data.effectiveDate) : null }),
      ...(data.reviewCycleDays  !== undefined && { reviewCycleDays: data.reviewCycleDays }),
      ...(data.nextReviewDate   !== undefined && { nextReviewDate: data.nextReviewDate ? new Date(data.nextReviewDate) : null }),
      ...(data.source           !== undefined && { source: data.source }),
      ...(data.notes            !== undefined && { notes: data.notes }),
      ...(data.complianceImpact !== undefined && { complianceImpact: data.complianceImpact }),
      ...(data.evidenceLinks    !== undefined && { evidenceLinks: data.evidenceLinks }),
      updatedById: user.id,
    },
  });

  const diffs = diffObjects(
    { title: existing.title, status: existing.status, version: existing.version },
    { title: updated.title,  status: updated.status,  version: updated.version },
    ['title','status','version'],
  );
  for (const d of diffs) {
    await audit({ action: 'UPDATE', module: 'governance', user, recordId: params.id, recordCode: existing.govCode, field: d.field, oldValue: d.oldValue, newValue: d.newValue, govItemId: params.id });
  }
  if (!diffs.length) await audit({ action: 'UPDATE', module: 'governance', user, recordId: params.id, recordCode: existing.govCode, govItemId: params.id });

  return NextResponse.json({ data: updated });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const user = await requirePermission('governance:delete');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.governanceItem.findUnique({ where: { id: params.id, isDeleted: false }, select: { govCode: true, title: true } });
  if (!existing) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  await prisma.governanceItem.update({ where: { id: params.id }, data: { isDeleted: true, deletedAt: new Date(), updatedById: user.id } });
  await audit({ action: 'DELETE', module: 'governance', user, recordId: params.id, recordCode: existing.govCode, notes: `Deleted "${existing.title}"` });

  return NextResponse.json({ message: 'Deleted' });
}
