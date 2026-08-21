import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Auto-generate investigation bill number: INV-YYYYMMDD-XXXX
async function generateInvBillNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `INV-${dateStr}-`;

  const lastBill = await prisma.investigationBill.findFirst({
    where: { billNo: { startsWith: prefix } },
    orderBy: { billNo: 'desc' },
  });

  let seq = 1;
  if (lastBill) {
    const lastSeq = parseInt(lastBill.billNo.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      patientName,
      patientAge,
      gender,
      contact,
      address,
      underDoctor,
      referredBy,
      noOfDays,
      mmhplId,
      caseType,
      bedNo,
      billDate,
      reportDate,
      payMode,
      advance,
      totalPaid,
      dueAmount,
      netPayable,
      items,
      discounts,
      savedAt,
    } = body;

    const userId = (session?.user as any)?.id || null;
    let userName = session?.user?.name || (session?.user as any)?.email || body.createdByName || null;

    if (userId && !userName) {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        if (u) userName = u.name || u.email;
      } catch (e) {}
    }

    if (!userName) userName = 'Billing Reception';

    // Generate investigation bill number
    const billNo = await generateInvBillNo();

    // Calculate sub total from items
    let subTotal = 0;
    if (Array.isArray(items)) {
      items.forEach((i: any) => {
        subTotal += parseFloat(i.amount) || 0;
      });
    }

    // Calculate total discount
    let totalDiscount = 0;
    if (Array.isArray(discounts)) {
      discounts.forEach((d: any) => {
        totalDiscount += parseFloat(d.amount) || 0;
      });
    }

    const parsedNetPayable = parseFloat(netPayable) || 0;
    const parsedTotalPaid = parseFloat(totalPaid !== undefined ? totalPaid : advance) || 0;
    const parsedDueAmount = parseFloat(dueAmount !== undefined ? dueAmount : (parsedNetPayable - parsedTotalPaid)) || 0;
    const saveTimestamp = savedAt || new Date().toISOString();

    // Save directly to the dedicated InvestigationBill table
    const bill = await prisma.investigationBill.create({
      data: {
        billNo,
        patientName: patientName || '',
        patientAge: patientAge || null,
        gender: gender || null,
        contact: contact || null,
        address: address || null,
        underDoctor: underDoctor || null,
        referredBy: referredBy || null,
        noOfDays: noOfDays || null,
        mmhplId: mmhplId || null,
        caseType: caseType || 'Investigation',
        bedNo: bedNo || null,
        billDate: billDate || null,
        reportDate: reportDate || null,
        payMode: payMode || 'Cash',
        subTotal,
        totalDiscount,
        advance: parsedTotalPaid,
        totalPaid: parsedTotalPaid,
        dueAmount: Math.max(0, parsedDueAmount),
        netPayable: parsedNetPayable,
        createdById: userId,
        createdByName: userName,
        items: {
          create: (Array.isArray(items) ? items : [])
            .filter((i: any) => i.name || i.amount)
            .map((i: any) => ({
              name: i.name || '',
              qty: i.qty ? String(i.qty) : null,
              priceUnit: i.priceUnit ? String(i.priceUnit) : null,
              amount: i.amount ? String(i.amount) : null,
            })),
        },
        discounts: {
          create: (Array.isArray(discounts) ? discounts : [])
            .filter((d: any) => d.amount)
            .map((d: any) => ({
              label: d.label || 'DISCOUNT:',
              amount: d.amount ? String(d.amount) : null,
            })),
        },
        payments: {
          create: (Array.isArray(body.payments) ? body.payments : [])
            .filter((p: any) => p.amount && parseFloat(p.amount) > 0)
            .map((p: any) => ({
              mode: p.mode || 'Cash',
              amount: parseFloat(p.amount) || 0,
              ref: p.ref || null,
            })),
        },
      },
      include: {
        items: true,
        discounts: true,
        payments: true,
      },
    });

    // Also log in AuditLog if user is logged in
    if (userId) {
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'INVESTIGATION_BILL_GENERATED',
            target: billNo,
            metadata: JSON.stringify({
              billId: bill.id,
              billNo,
              patientName,
              mmhplId,
              createdByName: userName,
              caseType: caseType || 'Investigation',
              netPayable,
              itemsCount: bill.items.length,
              savedAt: saveTimestamp,
            }),
          },
        });
      } catch (dbErr) {
        console.warn('[INV_BILLING_SAVE_AUDIT_WARN]', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Investigation bill saved successfully',
      bill: {
        id: bill.id,
        billNo: bill.billNo,
        patientName: bill.patientName,
        mmhplId: bill.mmhplId,
        netPayable: bill.netPayable,
        createdByName: bill.createdByName,
        savedAt: saveTimestamp,
      },
    });
  } catch (error: any) {
    console.error('[INV_BILLING_SAVE_ERR]', error);
    return NextResponse.json(
      { error: 'Failed to save investigation bill data' },
      { status: 500 }
    );
  }
}
