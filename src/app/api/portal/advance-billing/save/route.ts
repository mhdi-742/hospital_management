import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// Auto-generate advance payment receipt number: ADV-YYYYMMDD-XXXX
async function generateReceiptNo(): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '');
  const prefix = `ADV-${dateStr}-`;

  const lastReceipt = await prisma.advancePayment.findFirst({
    where: { receiptNo: { startsWith: prefix } },
    orderBy: { receiptNo: 'desc' },
  });

  let seq = 1;
  if (lastReceipt) {
    const lastSeq = parseInt(lastReceipt.receiptNo.replace(prefix, ''), 10);
    if (!isNaN(lastSeq)) seq = lastSeq + 1;
  }

  return `${prefix}${String(seq).padStart(4, '0')}`;
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const body = await req.json();

    const {
      receiptId,
      billId,
      patientId,
      admissionId,
      patientName,
      patientAge,
      gender,
      contact,
      address,
      underDoctor,
      mmhplId,
      caseType,
      wardNo,
      bedNo,
      receiptDate,
      amount,
      payMode,
      transactionId,
      remarks,
      savedAt,
    } = body;

    const targetReceiptId = receiptId || billId || null;

    const parsedAmount = parseFloat(amount);
    if (!patientName || isNaN(parsedAmount) || parsedAmount <= 0) {
      return NextResponse.json(
        { error: 'Patient name and a valid advance amount are required' },
        { status: 400 }
      );
    }

    const userId = (session?.user as any)?.id || null;
    let userName = session?.user?.name || (session?.user as any)?.email || body.createdByName || null;

    if (userId && !userName) {
      try {
        const u = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } });
        if (u) userName = u.name || u.email;
      } catch (e) {}
    }
    if (!userName) userName = 'Reception Staff';

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

    const saveTimestamp = savedAt || new Date().toISOString();

    // Check if targetReceiptId exists for updating
    let existingReceipt = null;
    if (targetReceiptId) {
      existingReceipt = await prisma.advancePayment.findUnique({
        where: { id: targetReceiptId },
      });
    }

    let receipt;
    if (existingReceipt) {
      // UPDATE EXISTING ADVANCE RECEIPT
      receipt = await prisma.advancePayment.update({
        where: { id: existingReceipt.id },
        data: {
          patientId: resolvedPatientId || existingReceipt.patientId,
          admissionId: resolvedAdmissionId || existingReceipt.admissionId,
          patientName: patientName.trim(),
          patientAge: patientAge || null,
          gender: gender || null,
          contact: contact || null,
          address: address || null,
          underDoctor: underDoctor || null,
          mmhplId: mmhplId || null,
          caseType: caseType || 'IPD Advance',
          wardNo: wardNo || null,
          bedNo: bedNo || null,
          receiptDate: receiptDate || null,
          amount: parsedAmount,
          payMode: payMode || 'Cash',
          transactionId: transactionId || null,
          remarks: remarks || null,
          createdByName: userName || existingReceipt.createdByName,
        },
      });

      // Audit Log for update
      if (userId) {
        try {
          await prisma.auditLog.create({
            data: {
              userId,
              action: 'ADVANCE_PAYMENT_UPDATED',
              target: receipt.receiptNo,
              metadata: JSON.stringify({
                receiptId: receipt.id,
                receiptNo: receipt.receiptNo,
                patientName,
                mmhplId,
                amount: parsedAmount,
                payMode,
                createdByName: userName,
                savedAt: saveTimestamp,
                updatedAt: new Date().toISOString(),
              }),
            },
          });
        } catch (dbErr) {
          console.warn('[ADV_BILLING_UPDATE_AUDIT_WARN]', dbErr);
        }
      }

      return NextResponse.json({
        success: true,
        isUpdate: true,
        message: `Advance payment receipt ${receipt.receiptNo} updated successfully`,
        receipt: {
          id: receipt.id,
          receiptNo: receipt.receiptNo,
          patientName: receipt.patientName,
          mmhplId: receipt.mmhplId,
          amount: receipt.amount,
          createdByName: receipt.createdByName,
          savedAt: saveTimestamp,
        },
      });
    }

    // CREATE NEW RECEIPT
    const receiptNo = await generateReceiptNo();

    // Save to AdvancePayment table
    receipt = await prisma.advancePayment.create({
      data: {
        receiptNo,
        patientId: resolvedPatientId,
        admissionId: resolvedAdmissionId,
        patientName: patientName.trim(),
        patientAge: patientAge || null,
        gender: gender || null,
        contact: contact || null,
        address: address || null,
        underDoctor: underDoctor || null,
        mmhplId: mmhplId || null,
        caseType: caseType || 'IPD Advance',
        wardNo: wardNo || null,
        bedNo: bedNo || null,
        receiptDate: receiptDate || null,
        amount: parsedAmount,
        payMode: payMode || 'Cash',
        transactionId: transactionId || null,
        remarks: remarks || null,
        createdById: userId,
        createdByName: userName,
      },
    });

    // Also log in AuditLog
    if (userId) {
      try {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'ADVANCE_PAYMENT_RECORDED',
            target: receiptNo,
            metadata: JSON.stringify({
              receiptId: receipt.id,
              receiptNo,
              patientName,
              mmhplId,
              amount: parsedAmount,
              payMode,
              createdByName: userName,
              savedAt: saveTimestamp,
            }),
          },
        });
      } catch (dbErr) {
        console.warn('[ADV_BILLING_SAVE_AUDIT_WARN]', dbErr);
      }
    }

    return NextResponse.json({
      success: true,
      isUpdate: false,
      message: 'Advance payment receipt saved successfully',
      receipt: {
        id: receipt.id,
        receiptNo: receipt.receiptNo,
        patientName: receipt.patientName,
        mmhplId: receipt.mmhplId,
        amount: receipt.amount,
        createdByName: receipt.createdByName,
        savedAt: saveTimestamp,
      },
    });
  } catch (error: any) {
    console.error('[ADV_BILLING_SAVE_ERR]', error);
    return NextResponse.json(
      { error: 'Failed to save advance payment receipt' },
      { status: 500 }
    );
  }
}
