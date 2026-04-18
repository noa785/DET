// src/app/(protected)/governance/[id]/edit/page.tsx
import { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requireAuth, can } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma/client';
import GovItemForm from '../../_components/GovItemForm';

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const g = await prisma.governanceItem.findUnique({ where: { id: params.id }, select: { govCode: true } });
  return { title: g ? `Edit ${g.govCode} — DGCC PES` : 'Edit Governance Item' };
}

export default async function EditGovItemPage({ params }: { params: { id: string } }) {
  const user = await requireAuth();
  if (!can(user, 'governance:edit')) redirect(`/governance/${params.id}`);

  const [item, units, users] = await Promise.all([
    prisma.governanceItem.findUnique({
      where: { id: params.id, isDeleted: false },
    }),
    prisma.unit.findMany({ where: { isActive: true }, select: { id: true, code: true, name: true }, orderBy: { code: 'asc' } }),
    prisma.user.findMany({ where: { isActive: true }, select: { id: true, name: true }, orderBy: { name: 'asc' } }),
  ]);

  if (!item) notFound();

  return (
    <GovItemForm
      mode="edit"
      govItemId={item.id}
      govCode={item.govCode}
      initialData={{
        title:            item.title,
        type:             item.type,
        status:           item.status,
        priority:         item.priority,
        riskLevel:        item.riskLevel,
        unitId:           item.unitId   ?? '',
        ownerId:          item.ownerId  ?? '',
        reviewerId:       item.reviewerId ?? '',
        version:          item.version  ?? '1.0',
        effectiveDate:    item.effectiveDate  ? item.effectiveDate.toISOString().slice(0,10)  : '',
        nextReviewDate:   item.nextReviewDate ? item.nextReviewDate.toISOString().slice(0,10) : '',
        reviewCycleDays:  item.reviewCycleDays ? String(item.reviewCycleDays) : '',
        source:           item.source           ?? '',
        complianceImpact: item.complianceImpact ?? '',
        notes:            item.notes            ?? '',
        evidenceLinks:    item.evidenceLinks    ?? '',
      }}
      units={units.map(u => ({ id: u.id, code: u.code ?? '', name: u.name }))}
      users={users.map(u => ({ id: u.id, name: u.name }))}
    />
  );
}
