// src/app/api/attachments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma/client';
import { requirePermission, isErrorResponse } from '@/lib/auth/session';

// GET /api/attachments?orderId=xxx OR ?govItemId=xxx
export async function GET(req: NextRequest) {
  const auth = await requirePermission('orders:view');
  if (isErrorResponse(auth)) return auth;

  const orderId = req.nextUrl.searchParams.get('orderId');
  const govItemId = req.nextUrl.searchParams.get('govItemId');

  if (!orderId && !govItemId) {
    return NextResponse.json({ error: 'orderId or govItemId required' }, { status: 400 });
  }

  const attachments = await prisma.attachment.findMany({
    where: { ...(orderId && { orderId }), ...(govItemId && { govItemId }) },
    include: { uploadedBy: { select: { id: true, name: true, initials: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json(attachments);
}

// POST /api/attachments
export async function POST(req: NextRequest) {
  const auth = await requirePermission('orders:edit');
  if (isErrorResponse(auth)) return auth;

  const body = await req.json();
  const { orderId, govItemId, category, title, url, fileName, description } = body;

  if (!title || !url) {
    return NextResponse.json({ error: 'title and url required' }, { status: 400 });
  }
  if (!orderId && !govItemId) {
    return NextResponse.json({ error: 'orderId or govItemId required' }, { status: 400 });
  }

  const attachment = await prisma.attachment.create({
    data: {
      orderId: orderId || null,
      govItemId: govItemId || null,
      category: category || 'OTHER',
      title,
      url,
      fileName: fileName || null,
      description: description || null,
      uploadedById: auth.id,
    },
    include: { uploadedBy: { select: { id: true, name: true, initials: true } } },
  });

  return NextResponse.json(attachment, { status: 201 });
}
