import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/wards/[id]
 * Updates ward details.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: wardId } = await params;

  try {
    const { name, code, capacity, accentColor } = await req.json();

    const updated = await prisma.ward.update({
      where: { id: wardId },
      data: {
        name: name !== undefined ? name : undefined,
        code: code !== undefined ? code : undefined,
        capacity: capacity !== undefined ? parseInt(capacity, 10) : undefined,
        accentColor: accentColor !== undefined ? accentColor : undefined,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_WARD',
        target: `Ward:${wardId}`,
        metadata: JSON.stringify({ name, code, capacity }),
      },
    });

    return NextResponse.json({ success: true, ward: updated });
  } catch (error: any) {
    console.error('[ADMIN_UPDATE_WARD_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/wards/[id]
 * Deletes a ward.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: wardId } = await params;

  try {
    // Check if ward has patients currently admitted
    const activeAdmissions = await prisma.admission.count({
      where: {
        wardId,
        status: 'active',
      },
    });

    if (activeAdmissions > 0) {
      return NextResponse.json({ error: 'Cannot delete ward: patients are currently admitted in it.' }, { status: 400 });
    }

    await prisma.ward.delete({
      where: { id: wardId },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_WARD',
        target: `Ward:${wardId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_WARD_ERR]', error);
    return NextResponse.json({ error: 'Cannot delete ward: database error' }, { status: 500 });
  }
}
