// src/app/api/users/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requireAuth, can } from '@/lib/auth/session';
import bcrypt from 'bcryptjs';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    if (!can(currentUser, 'admin:users')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const body = await req.json();
    const { name, email, role, unitId, password, isActive } = body;

    const existing = await prisma.user.findUnique({ where: { id: params.id } });
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check duplicate email if changed
    if (email && email.trim().toLowerCase() !== existing.email) {
      const dup = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
      if (dup) {
        return NextResponse.json({ error: 'Email already in use' }, { status: 400 });
      }
    }

    const data: any = {};
    if (name !== undefined) {
      data.name = name.trim();
      data.initials = name.trim().split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
    }
    if (email !== undefined) data.email = email.trim().toLowerCase();
    if (role !== undefined) data.role = role;
    if (unitId !== undefined) data.unitId = unitId || null;
    if (isActive !== undefined) data.isActive = isActive;
    if (password && password.length >= 6) {
      data.passwordHash = await bcrypt.hash(password, 12);
    }

    const user = await prisma.user.update({
      where: { id: params.id },
      data,
      include: {
        unit: { select: { code: true, name: true } },
      },
    });

    await prisma.auditLog.create({
      data: {
        action: 'UPDATE',
        module: 'users',
        recordId: user.id,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        notes: `Updated user: ${user.name}`,
      },
    });

    return NextResponse.json(user);
  } catch (error: any) {
    console.error('Update user error:', error);
    return NextResponse.json({ error: error.message || 'Failed' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const currentUser = await requireAuth();
    if (!can(currentUser, 'admin:users')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Don't allow deleting yourself
    if (params.id === currentUser.id) {
      return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
    }

    await prisma.user.update({
      where: { id: params.id },
      data: { isActive: false },
    });

    await prisma.auditLog.create({
      data: {
        action: 'DELETE',
        module: 'users',
        recordId: params.id,
        userId: currentUser.id,
        userEmail: currentUser.email,
        userName: currentUser.name,
        notes: `Deactivated user`,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
