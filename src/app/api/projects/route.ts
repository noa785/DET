// src/app/api/projects/route.ts
// GET: list projects (existing) | POST: create new project (NEW)
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';
import { audit } from '@/lib/audit/logger';

// ── GET /api/projects ──────────────────────────────────────────
export async function GET(req: NextRequest) {
  const user = await requirePermission('orders:view');
  if (isErrorResponse(user)) return user;

  const projects = await prisma.project.findMany({
    where: { isActive: true },
    select: { id: true, code: true, name: true, phase: true },
    orderBy: { code: 'asc' },
  });
  return NextResponse.json({ data: projects });
}

// ── POST /api/projects ─────────────────────────────────────────
// Only ADMIN / SUPER_ADMIN can create projects (uses admin:settings permission)
const CreateProjectSchema = z.object({
  code: z.string().min(2).max(20).trim().regex(/^[A-Z0-9-]+$/, 'Code must be uppercase letters, numbers, dashes only'),
  name: z.string().min(2).max(200).trim(),
  unitId: z.string().nullable().optional(),
  phase: z.enum(['INITIATION', 'PLANNING', 'EXECUTION', 'MONITORING', 'CLOSURE']).default('PLANNING'),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  sponsor: z.string().max(200).nullable().optional(),
  description: z.string().max(2000).nullable().optional(),
});

export async function POST(req: NextRequest) {
  // Permission gate: only admins can create projects
  const user = await requirePermission('admin:settings');
  if (isErrorResponse(user)) return user;

  const body = await req.json().catch(() => null);
  const parsed = CreateProjectSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Validation failed', issues: parsed.error.issues },
      { status: 422 }
    );
  }

  const data = parsed.data;

  // Check duplicate code
  const existing = await prisma.project.findUnique({ where: { code: data.code } });
  if (existing) {
    return NextResponse.json({ error: `Project code "${data.code}" already exists` }, { status: 409 });
  }

  // Create
  const project = await prisma.project.create({
    data: {
      code: data.code,
      name: data.name,
      unitId: data.unitId || null,
      phase: data.phase,
      startDate: data.startDate ? new Date(data.startDate) : null,
      endDate: data.endDate ? new Date(data.endDate) : null,
      sponsor: data.sponsor || null,
      description: data.description || null,
      createdById: user.id,
    },
  });

  // Audit log
  await audit({
    action: 'CREATE',
    module: 'projects',
    user,
    recordId: project.id,
    recordCode: project.code,
    notes: `Created project "${project.name}"`,
    ipAddress: req.headers.get('x-forwarded-for') || undefined,
  });

  return NextResponse.json({ data: project }, { status: 201 });
}
