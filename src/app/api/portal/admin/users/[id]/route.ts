import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/users/[id]
 * Updates staff user details or resets password.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Protect self from modification of role or deactivation
    const isSelf = user.id === (session.user as any).id;

    const body = await req.json();
    const { name, email, role, isActive, password } = body;

    const data: any = {};
    if (name !== undefined) data.name = name;
    if (email !== undefined) data.email = email;

    if (role !== undefined) {
      if (isSelf && role !== 'ADMIN') {
        return NextResponse.json({ error: 'Cannot change your own role from Admin' }, { status: 400 });
      }
      if (['ADMIN', 'RECEPTIONIST', 'NURSE'].includes(role)) {
        data.role = role;
      }
    }

    if (isActive !== undefined) {
      if (isSelf && !isActive) {
        return NextResponse.json({ error: 'Cannot deactivate your own account' }, { status: 400 });
      }
      data.isActive = !!isActive;
    }

    if (password) {
      data.password = await bcrypt.hash(password, 12);
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_STAFF_USER',
        target: `User:${userId}`,
        metadata: JSON.stringify({ fieldsChanged: Object.keys(body) }),
      },
    });

    return NextResponse.json({ success: true, user: updated });
  } catch (error: any) {
    console.error('[ADMIN_UPDATE_USER_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/users/[id]
 * Deletes staff user.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: userId } = await params;

  if (userId === (session.user as any).id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    await prisma.user.delete({
      where: { id: userId },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_STAFF_USER',
        target: `User:${userId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_USER_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
