import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type') || 'hospital'; // 'hospital' | 'investigation' | 'advance'
    const search = searchParams.get('search')?.trim() || '';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');

    if (type === 'advance') {
      const where: any = {};
      if (search) {
        where.OR = [
          { receiptNo: { contains: search } },
          { patientName: { contains: search } },
          { underDoctor: { contains: search } },
          { mmhplId: { contains: search } },
          { contact: { contains: search } },
          { payMode: { contains: search } },
          { transactionId: { contains: search } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const [advances, total] = await Promise.all([
        prisma.advancePayment.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.advancePayment.count({ where }),
      ]);

      const stats = {
        totalBills: total,
        totalNet: advances.reduce((acc, a) => acc + (a.amount || 0), 0),
        totalAdvance: advances.reduce((acc, a) => acc + (a.amount || 0), 0),
        totalDiscount: 0,
      };

      // Map to consistent structure for frontend table
      const formatted = advances.map((a) => ({
        id: a.id,
        billNo: a.receiptNo,
        patientName: a.patientName,
        patientAge: a.patientAge,
        gender: a.gender,
        contact: a.contact,
        address: a.address,
        underDoctor: a.underDoctor,
        mmhplId: a.mmhplId,
        caseType: a.caseType,
        bedNo: a.bedNo,
        billDate: a.receiptDate,
        payMode: a.payMode,
        transactionId: a.transactionId,
        remarks: a.remarks,
        subTotal: a.amount,
        totalDiscount: 0,
        advance: a.amount,
        netPayable: a.amount,
        createdAt: a.createdAt.toISOString(),
        items: [
          {
            id: 'adv-1',
            name: a.remarks || 'Advance deposit',
            qty: '1',
            priceUnit: String(a.amount),
            amount: String(a.amount),
          },
        ],
        discounts: [],
      }));

      return NextResponse.json({ bills: formatted, total, stats, type: 'advance' });
    } else if (type === 'investigation') {
      const where: any = {};
      if (search) {
        where.OR = [
          { billNo: { contains: search } },
          { patientName: { contains: search } },
          { underDoctor: { contains: search } },
          { referredBy: { contains: search } },
          { mmhplId: { contains: search } },
          { contact: { contains: search } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const [bills, total] = await Promise.all([
        prisma.investigationBill.findMany({
          where,
          include: {
            items: true,
            discounts: true,
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.investigationBill.count({ where }),
      ]);

      const stats = {
        totalBills: total,
        totalNet: bills.reduce((acc, b) => acc + (b.netPayable || 0), 0),
        totalAdvance: bills.reduce((acc, b) => acc + (b.advance || 0), 0),
        totalDiscount: bills.reduce((acc, b) => acc + (b.totalDiscount || 0), 0),
      };

      return NextResponse.json({ bills, total, stats, type: 'investigation' });
    } else {
      // Hospital bills
      const where: any = {};
      if (search) {
        where.OR = [
          { billNo: { contains: search } },
          { patientName: { contains: search } },
          { underDoctor: { contains: search } },
          { mmhplId: { contains: search } },
          { caseType: { contains: search } },
        ];
      }
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          where.createdAt.lte = end;
        }
      }

      const [bills, total] = await Promise.all([
        prisma.bill.findMany({
          where,
          include: {
            items: true,
            discounts: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 100,
        }),
        prisma.bill.count({ where }),
      ]);

      const stats = {
        totalBills: total,
        totalNet: bills.reduce((acc, b) => acc + (b.netPayable || 0), 0),
        totalAdvance: bills.reduce((acc, b) => acc + (b.advance || 0), 0),
        totalDiscount: bills.reduce((acc, b) => acc + (b.totalDiscount || 0), 0),
      };

      return NextResponse.json({ bills, total, stats, type: 'hospital' });
    }
  } catch (error: any) {
    console.error('[BILLS_GET_ERR]', error);
    return NextResponse.json({ error: 'Failed to fetch bills' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || (role !== 'ADMIN' && role !== 'RECEPTIONIST')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const id = searchParams.get('id');
    const type = searchParams.get('type') || 'hospital';

    if (!id) {
      return NextResponse.json({ error: 'Bill ID is required' }, { status: 400 });
    }

    if (type === 'advance') {
      await prisma.advancePayment.delete({ where: { id } });
    } else if (type === 'investigation') {
      await prisma.investigationBill.delete({ where: { id } });
    } else {
      await prisma.bill.delete({ where: { id } });
    }

    return NextResponse.json({ success: true, message: 'Record deleted successfully' });
  } catch (error: any) {
    console.error('[BILLS_DELETE_ERR]', error);
    return NextResponse.json({ error: 'Failed to delete record' }, { status: 500 });
  }
}
