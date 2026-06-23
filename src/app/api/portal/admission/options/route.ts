import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [doctors, wards, otRooms] = await Promise.all([
    prisma.doctor.findMany({
      where: { user: { isActive: true } },
      include: {
        user: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.ward.findMany({ orderBy: { name: 'asc' } }),
    prisma.otRoom.findMany({ orderBy: { roomNo: 'asc' } }),
  ]);

  return NextResponse.json({ doctors, wards, otRooms });
}
