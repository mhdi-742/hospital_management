import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/portal/admin/wards/[id]/beds
 * Fetch all beds for a ward with active admission status.
 */
export async function GET(_: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: wardId } = await params;

  try {
    const beds = await prisma.bed.findMany({
      where: { wardId },
      include: {
        admissions: {
          where: { status: 'active' },
          select: {
            id: true,
            patient: { select: { name: true, age: true, gender: true } },
          },
        },
      },
      orderBy: { bedNo: 'asc' },
    });

    return NextResponse.json({ beds });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admin/wards/[id]/beds
 * Add a new bed or bulk generate missing default beds for a ward.
 */
export async function POST(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: wardId } = await params;

  try {
    const body = await req.json();
    const ward = await prisma.ward.findUnique({ where: { id: wardId } });
    if (!ward) {
      return NextResponse.json({ error: 'Ward not found' }, { status: 404 });
    }

    if (body.action === 'generate') {
      // Bulk generate default beds up to ward capacity
      const existingBeds = await prisma.bed.findMany({ where: { wardId }, select: { bedNo: true } });
      const existingNos = new Set(existingBeds.map(b => b.bedNo));
      
      const toCreate: { wardId: string; bedNo: string }[] = [];
      for (let i = 1; i <= ward.capacity; i++) {
        const bedNo = `${ward.code}-${String(i).padStart(2, '0')}`;
        if (!existingNos.has(bedNo)) {
          toCreate.push({ wardId, bedNo });
        }
      }

      if (toCreate.length > 0) {
        await prisma.bed.createMany({ data: toCreate });
      }

      const allBeds = await prisma.bed.findMany({
        where: { wardId },
        include: {
          admissions: {
            where: { status: 'active' },
            select: { id: true, patient: { select: { name: true } } },
          },
        },
        orderBy: { bedNo: 'asc' },
      });

      return NextResponse.json({ success: true, beds: allBeds });
    }

    // Add a single bed
    const { bedNo } = body;
    if (!bedNo || typeof bedNo !== 'string' || !bedNo.trim()) {
      return NextResponse.json({ error: 'Bed number is required' }, { status: 400 });
    }

    const cleanBedNo = bedNo.trim();

    // Check duplicate
    const existing = await prisma.bed.findFirst({
      where: { wardId, bedNo: cleanBedNo },
    });
    if (existing) {
      return NextResponse.json({ error: `Bed number "${cleanBedNo}" already exists in this ward` }, { status: 400 });
    }

    const newBed = await prisma.bed.create({
      data: {
        wardId,
        bedNo: cleanBedNo,
      },
      include: {
        admissions: {
          where: { status: 'active' },
          select: { id: true, patient: { select: { name: true } } },
        },
      },
    });

    // Update ward capacity if bed count > capacity
    const totalBedCount = await prisma.bed.count({ where: { wardId } });
    if (totalBedCount > ward.capacity) {
      await prisma.ward.update({
        where: { id: wardId },
        data: { capacity: totalBedCount },
      });
    }

    return NextResponse.json({ success: true, bed: newBed }, { status: 201 });
  } catch (error: any) {
    console.error('[ADMIN_CREATE_BED_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
