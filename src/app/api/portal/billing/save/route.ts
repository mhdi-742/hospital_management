import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      patientName,
      patientAge,
      underDoctor,
      noOfDays,
      mmhplId,
      caseType,
      bedNo,
      billDate,
      advance,
      netPayable,
      items,
      discounts,
      savedAt,
    } = body;

    // Log the bill creation in AuditLog if a user is logged in and DB is available
    if (session?.user && (session.user as any).id) {
      try {
        await prisma.auditLog.create({
          data: {
            userId: (session.user as any).id,
            action: 'BILL_GENERATED',
            target: mmhplId || patientName || 'BILL',
            metadata: JSON.stringify({
              patientName,
              patientAge,
              underDoctor,
              noOfDays,
              mmhplId,
              caseType,
              bedNo,
              billDate,
              advance,
              netPayable,
              itemsCount: items?.length ?? 0,
              discountsCount: discounts?.length ?? 0,
              savedAt,
            }),
          },
        });
      } catch (dbErr) {
        console.warn('[BILLING_SAVE_DB_WARN] Could not persist audit log to DB:', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Bill saved successfully',
      bill: {
        patientName,
        mmhplId,
        netPayable,
        savedAt: savedAt || new Date().toISOString(),
      },
    });
  } catch (error: any) {
    console.error('[BILLING_SAVE_ERR]', error);
    return NextResponse.json(
      { error: 'Failed to save bill data' },
      { status: 500 }
    );
  }
}
