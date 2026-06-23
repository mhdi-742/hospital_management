import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/portal/admin/wards
 * Returns all wards.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const wards = await prisma.ward.findMany({
      orderBy: { name: 'asc' },
    });
    return NextResponse.json({ wards });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admin/wards
 * Creates a new ward.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, code, capacity, accentColor } = await req.json();

    if (!name || !code) {
      return NextResponse.json({ error: 'Name and short code are required' }, { status: 400 });
    }

    const ward = await prisma.ward.create({
      data: {
        name,
        code,
        capacity: capacity ? parseInt(capacity, 10) : 20,
        accentColor: accentColor || '#3b82f6',
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_WARD',
        target: `Ward:${ward.id}`,
        metadata: JSON.stringify({ name, code, capacity }),
      },
    });

    return NextResponse.json({ success: true, ward }, { status: 201 });
  } catch (error: any) {
    console.error('[ADMIN_CREATE_WARD_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
