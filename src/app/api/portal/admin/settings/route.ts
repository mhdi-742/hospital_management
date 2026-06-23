import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/portal/admin/settings
 * Returns key-value hospital settings.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const settings = await prisma.hospitalSettings.findMany();
    // Reduce into an object
    const config = settings.reduce((acc: any, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {});

    return NextResponse.json({ settings: config });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * PATCH /api/portal/admin/settings
 * Updates one or more hospital setting keys.
 */
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();

    const result = await prisma.$transaction(async tx => {
      const keys = Object.keys(body);
      const updatedSettings: any = {};

      for (const key of keys) {
        const val = String(body[key]);
        const s = await tx.hospitalSettings.upsert({
          where: { key },
          update: { value: val },
          create: { key, value: val },
        });
        updatedSettings[s.key] = s.value;
      }

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'UPDATE_HOSPITAL_SETTINGS',
          metadata: JSON.stringify(body),
        },
      });

      return updatedSettings;
    });

    return NextResponse.json({ success: true, settings: result });
  } catch (error: any) {
    console.error('[ADMIN_UPDATE_SETTINGS_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
