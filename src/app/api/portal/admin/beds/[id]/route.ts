import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/beds/[id]
 * Rename a bed number.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bedId } = await params;

  try {
    const { bedNo } = await req.json();
    if (!bedNo || typeof bedNo !== 'string' || !bedNo.trim()) {
      return NextResponse.json({ error: 'Bed number is required' }, { status: 400 });
    }

    const cleanBedNo = bedNo.trim();

    const existingBed = await prisma.bed.findUnique({
      where: { id: bedId },
    });
    if (!existingBed) {
      return NextResponse.json({ error: 'Bed not found' }, { status: 404 });
    }

    // Check if new bedNo already exists in same ward
    const duplicate = await prisma.bed.findFirst({
      where: {
        wardId: existingBed.wardId,
        bedNo: cleanBedNo,
        NOT: { id: bedId },
      },
    });

    if (duplicate) {
      return NextResponse.json({ error: `Bed "${cleanBedNo}" already exists in this ward` }, { status: 400 });
    }

    const updated = await prisma.bed.update({
      where: { id: bedId },
      data: { bedNo: cleanBedNo },
      include: {
        admissions: {
          where: { status: 'active' },
          select: { id: true, patient: { select: { name: true } } },
        },
      },
    });

    return NextResponse.json({ success: true, bed: updated });
  } catch (error: any) {
    console.error('[ADMIN_RENAME_BED_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/beds/[id]
 * Delete an unassigned bed.
 */
export async function DELETE(_: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: bedId } = await params;

  try {
    // Check active admissions on this bed
    const activeAdmissions = await prisma.admission.count({
      where: { bedId, status: 'active' },
    });

    if (activeAdmissions > 0) {
      return NextResponse.json({ error: 'Cannot delete bed: a patient is currently admitted on this bed.' }, { status: 400 });
    }

    await prisma.bed.delete({ where: { id: bedId } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_DELETE_BED_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
