import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(_: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayEnd = new Date();
  todayEnd.setHours(23, 59, 59, 999);

  const [doctors, wards, otRooms, opdSessions] = await Promise.all([
    prisma.doctor.findMany({
      where: { user: { isActive: true } },
      include: {
        user: { select: { name: true } },
        department: { select: { name: true } },
      },
      orderBy: { user: { name: 'asc' } },
    }),
    prisma.ward.findMany({
      orderBy: { name: 'asc' },
      include: {
        beds: {
          include: {
            admissions: {
              where: { status: 'active' },
              select: { id: true, patient: { select: { name: true } } }
            }
          },
          orderBy: { bedNo: 'asc' }
        }
      }
    }),
    prisma.otRoom.findMany({ orderBy: { roomNo: 'asc' } }),
    prisma.opdSession.findMany({
      where: {
        date: { gte: todayStart },
        status: { in: ['upcoming', 'running', 'break'] },
      },
      include: {
        doctor: {
          include: {
            user: { select: { name: true } },
            department: { select: { name: true } },
          },
        },
      },
      orderBy: [
        { date: 'asc' },
        { startTime: 'asc' },
      ],
    }),
  ]);

  return NextResponse.json({ doctors, wards, otRooms, opdSessions });
}
