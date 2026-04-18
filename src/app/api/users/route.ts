// src/app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth, can } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export async function POST(req: NextRequest) {
  try {
    const currentUser = await requireAuth();
    if (!can(currentUser, 'admin:users')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role, unitId, password } = body;

    if (!name?.trim() || !email?.trim()) {
      return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
    }

    // Check duplicate email
    const existing = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: 'Email already exists' }, { status: 400 });
    }

    // Hash password if provided
    let passwordHash = null;
    if (password && password.length >= 6) {
      passwordHash = await bcrypt.hash(password, 12);
    }

    const initials = name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);

    const user = await prisma.user.create({
      data: {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        role: role || 'VIEWER',
        unitId: unitId || null,
        passwordHash,
        initials,
        isActive: true,
      },
      include: {
        unit: { select: { code: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'CREATE',
        module: 'users',
        recordId: user.id,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        notes: `Created user: ${user.name} (${user.email}) as ${user.role}`,
      },
    });

    return NextResponse.json(user, { status: 201 });
  } catch (error: any) {
    console.error('Create user error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}
