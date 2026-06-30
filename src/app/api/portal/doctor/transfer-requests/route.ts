import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'DOCTOR') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const doctor = await prisma.doctor.findUnique({
    where: { userId: session.user.id },
  });

  if (!doctor) {
    return NextResponse.json({ error: 'Doctor not found' }, { status: 404 });
  }

  const { admissionId, targetType, notes } = await req.json();

  if (!admissionId || !targetType) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
  }

  const request = await prisma.transferRequest.create({
    data: {
      admissionId,
      requestingDocId: doctor.id,
      targetType,
      notes,
      status: 'pending',
    },
  });

  return NextResponse.json(request);
}
