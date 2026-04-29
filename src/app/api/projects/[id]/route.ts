// src/app/api/projects/[id]/route.ts
// GET: project detail | PUT: update | DELETE: soft delete
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit, diffObjects } from '@/lib/audit/logger';

// ── GET /api/projects/[id] ─────────────────────────────────────
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const project = await prisma.project.findUnique({
    where: { id: params.id, isActive: true },
    include: {
      unit: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, name: true } },
      _count: { select: { orders: true } },
    },
  });

  if (!project) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }
  return NextResponse.json({ data: project });
}

// ── PUT /api/projects/[id] ─────────────────────────────────────
const UpdateProjectSchema = z.object({
  name: z.string().min(2).max(200).trim().optional(),
  unitId: z.string().nullable().optional(),
  phase: z.enum(['INITIATION', 'PLANNING', 'EXECUTION', 'MONITORING', 'CLOSURE']).optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  sponsor: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requirePermission('admin:settings');
  if (isErrorResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = UpdateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const existing = await prisma.project.findUnique({ where: { id: params.id, isActive: true } });
  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  const data = parsed.data;
  const updated = await prisma.project.update({
    where: { id: params.id },
    data: {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.unitId !== undefined && { unitId: data.unitId || null }),
      ...(data.phase !== undefined && { phase: data.phase }),
      ...(data.startDate !== undefined && { startDate: data.startDate ? new Date(data.startDate) : null }),
      ...(data.endDate !== undefined && { endDate: data.endDate ? new Date(data.endDate) : null }),
      ...(data.sponsor !== undefined && { sponsor: data.sponsor || null }),
      ...(data.description !== undefined && { description: data.description || null }),
    },
  });

  // Audit log — track each changed field
  const changes = diffObjects(
    existing as unknown as Record<string, unknown>,
    updated as unknown as Record<string, unknown>,
    ['name', 'unitId', 'phase', 'startDate', 'endDate', 'sponsor', 'description']
  );
  for (const change of changes) {
    await audit({
      action: 'UPDATE',
      module: 'projects',
      user,
      recordId: updated.id,
      recordCode: updated.code,
      field: change.field,
      oldValue: change.oldValue,
      newValue: change.newValue,
      ipAddress: req.headers.get('x-forwarded-for') || undefined,
    });
  }

  return NextResponse.json({ data: updated });
}

// ── DELETE /api/projects/[id] ──────────────────────────────────
// SOFT DELETE — sets isActive = false. Project remains in DB for audit trail.
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const user = await requirePermission('admin:settings');
  if (isErrorResponse(user)) return user;

  const existing = await prisma.project.findUnique({
    where: { id: params.id },
    include: { _count: { select: { orders: true } } },
  });

  if (!existing) {
    return NextResponse.json({ error: 'Project not found' }, { status: 404 });
  }

  if (!existing.isActive) {
    return NextResponse.json({ error: 'Project is already deleted' }, { status: 410 });
  }

  // Block delete if project has orders linked to it
  if (existing._count.orders > 0) {
    return NextResponse.json(
      {
        error: `Cannot delete project: ${existing._count.orders} order(s) are linked to it. Please reassign or delete them first.`,
      },
      { status: 409 }
    );
  }

  // Soft delete
  await prisma.project.update({
    where: { id: params.id },
    data: { isActive: false },
  });

  // Audit log
  await audit({
    action: 'DELETE',
    module: 'projects',
    user,
    recordId: existing.id,
    recordCode: existing.code,
    notes: `Soft-deleted project "${existing.name}"`,
    ipAddress: req.headers.get('x-forwarded-for') || undefined,
  });

  return NextResponse.json({ ok: true, message: 'Project deleted' });
}
