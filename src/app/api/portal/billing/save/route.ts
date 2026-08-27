import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Auto-generate bill number: BILL-YYYYMMDD-XXXX
async function generateBillNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `BILL-${dateStr}-`;

  const lastBill = await prisma.bill.findFirst({
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
      billId,
      patientId,
      admissionId,
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

    const userId = (session?.user as any)?.id || null;
    let userName = session?.user?.name || (session?.user as any)?.email || body.createdByName || null;

    if (userId && !userName) {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        if (u) userName = u.name || u.email;
      } catch (e) {}
    }
    if (!userName) userName = 'Billing Staff';

    // Try to auto-resolve admissionId/patientId if not directly supplied
    let resolvedAdmissionId = admissionId || null;
    let resolvedPatientId = patientId || null;

    if (!resolvedAdmissionId && mmhplId) {
      const activeAdm = await prisma.admission.findFirst({
        where: { mmhplId: mmhplId.trim() },
        select: { id: true, patientId: true },
      });
      if (activeAdm) {
        resolvedAdmissionId = activeAdm.id;
        resolvedPatientId = resolvedPatientId || activeAdm.patientId;
      }
    }

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

    const saveTimestamp = savedAt || new Date().toISOString();

    const formattedItems = (Array.isArray(items) ? items : [])
      .filter((i: any) => i.name || i.amount)
      .map((i: any) => ({
        name: i.name || '',
        qty: i.qty ? String(i.qty) : null,
        priceUnit: i.priceUnit ? String(i.priceUnit) : null,
        amount: i.amount ? String(i.amount) : null,
      }));

    const formattedDiscounts = (Array.isArray(discounts) ? discounts : [])
      .filter((d: any) => d.amount)
      .map((d: any) => ({
        label: d.label || 'DISCOUNT:',
        amount: d.amount ? String(d.amount) : null,
      }));

    // If billId is provided, check if it exists for updating
    let existingBill = null;
    if (billId) {
      existingBill = await prisma.bill.findUnique({
        where: { id: billId },
        include: { items: true, discounts: true },
      });
    }

    let bill;
    if (existingBill) {
      // UPDATE EXISTING BILL
      bill = await prisma.$transaction(async (tx) => {
        // Delete old items and discounts
        await tx.billItem.deleteMany({ where: { billId: existingBill.id } });
        await tx.billDiscount.deleteMany({ where: { billId: existingBill.id } });

        // Update the main record
        return tx.bill.update({
          where: { id: existingBill.id },
          data: {
            patientId: resolvedPatientId || existingBill.patientId,
            admissionId: resolvedAdmissionId || existingBill.admissionId,
            patientName: patientName || '',
            patientAge: patientAge || null,
            underDoctor: underDoctor || null,
            noOfDays: noOfDays || null,
            mmhplId: mmhplId || null,
            caseType: caseType || null,
            bedNo: bedNo || null,
            billDate: billDate || null,
            subTotal,
            totalDiscount,
            advance: parseFloat(advance) || 0,
            netPayable: parseFloat(netPayable) || 0,
            createdByName: userName || existingBill.createdByName,
            items: { create: formattedItems },
            discounts: { create: formattedDiscounts },
          },
          include: {
            items: true,
            discounts: true,
          },
        });
      });

      // Audit Log for update
      if (userId) {
        try {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'BILL_UPDATED',
              target: bill.billNo,
              metadata: JSON.stringify({
                billId: bill.id,
                billNo: bill.billNo,
                patientName,
                mmhplId,
                caseType,
                netPayable: bill.netPayable,
                itemsCount: bill.items.length,
                createdByName: userName,
                savedAt: saveTimestamp,
                updatedAt: new Date().toISOString(),
              }),
            },
          });
        } catch (dbErr) {
          console.warn('[BILLING_UPDATE_AUDIT_WARN]', dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        isUpdate: true,
        message: `Hospital bill ${bill.billNo} updated successfully`,
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
    }

    // CREATE NEW BILL
    const billNo = await generateBillNo();

    // Save bill to the Bill table
    bill = await prisma.bill.create({
      data: {
        billNo,
        patientId: resolvedPatientId,
        admissionId: resolvedAdmissionId,
        patientName: patientName || '',
        patientAge: patientAge || null,
        underDoctor: underDoctor || null,
        noOfDays: noOfDays || null,
        mmhplId: mmhplId || null,
        caseType: caseType || null,
        bedNo: bedNo || null,
        billDate: billDate || null,
        subTotal,
        totalDiscount,
        advance: parseFloat(advance) || 0,
        netPayable: parseFloat(netPayable) || 0,
        createdById: userId,
        createdByName: userName,
        items: {
          create: formattedItems,
        },
        discounts: {
          create: formattedDiscounts,
        },
      },
      include: {
        items: true,
        discounts: true,
      },
    });

    // Also log in AuditLog if user is logged in
    if (userId) {
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'BILL_GENERATED',
            target: billNo,
            metadata: JSON.stringify({
              billId: bill.id,
              billNo,
              patientName,
              mmhplId,
              caseType,
              netPayable: bill.netPayable,
              itemsCount: bill.items.length,
              createdByName: userName,
              savedAt: saveTimestamp,
            }),
          },
        });
      } catch (dbErr) {
        console.warn('[BILLING_SAVE_AUDIT_WARN]', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      isUpdate: false,
      message: 'Bill saved successfully',
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
    console.error('[BILLING_SAVE_ERR]', error);
    return NextResponse.json(
      { error: 'Failed to save bill data' },
      { status: 500 }
    );
  }
}
