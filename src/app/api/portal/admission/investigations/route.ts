import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'RECEPTIONIST' && role !== 'NURSE' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search') ?? '';
    const page   = parseInt(searchParams.get('page') ?? '1', 10);
    const limit  = 20;

    const where: any = {};
    if (search) {
      where.OR = [
        { patientName: { contains: search } },
        { regNo: { contains: search } },
        { contact: { contains: search } },
      ];
    }

    const [registrations, total] = await Promise.all([
      prisma.investigationRegistration.findMany({
        where,
        include: { items: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.investigationRegistration.count({ where }),
    ]);

    return NextResponse.json({ registrations, total, page, limit });
  } catch (error: any) {
    console.error('[INVESTIGATION_REG_GET_ERR]', error);
    return NextResponse.json(
      { registrations: [], total: 0, page: 1, limit: 20 },
      { status: 200 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  const role = (session?.user as any)?.role;
  if (!session || (role !== 'RECEPTIONIST' && role !== 'ADMIN')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json();
    const {
      patientName,
      patientAge,
      gender,
      contact,
      address,
      referredByDoctor,
      items, // array of { testId?, testName, qty, rate, amount }
      discount,
      advancePaid,
    } = body;

    if (!patientName || !patientName.trim()) {
      return NextResponse.json({ error: 'Patient name is required' }, { status: 400 });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'At least one investigation test is required' }, { status: 400 });
    }

    // Calculate totals
    const parsedDiscount = parseFloat(discount) || 0;
    const parsedAdvance = parseFloat(advancePaid) || 0;

    const calculatedItems = items.map((i: any) => {
      const qty = parseInt(i.qty, 10) || 1;
      const rate = parseFloat(i.rate) || 0;
      const amount = parseFloat(i.amount) || qty * rate;
      return {
        testId: i.testId || undefined,
        testName: String(i.testName || 'Investigation').trim(),
        qty,
        rate,
        amount,
      };
    });

    const totalAmount = calculatedItems.reduce((sum, item) => sum + item.amount, 0);
    const netPayable = Math.max(0, totalAmount - parsedDiscount);
    const dueAmount = Math.max(0, netPayable - parsedAdvance);

    // Generate unique Registration Number: INV-YYYYMMDD-XXXX
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
    const count = await prisma.investigationRegistration.count();
    const regNo = `INV-${dateStr}-${String(count + 1).padStart(4, '0')}`;

    const registration = await prisma.investigationRegistration.create({
      data: {
        regNo,
        patientName: patientName.trim(),
        patientAge: patientAge?.trim() || undefined,
        gender: gender || undefined,
        contact: contact?.trim() || undefined,
        address: address?.trim() || undefined,
        referredByDoctor: referredByDoctor?.trim() || undefined,
        totalAmount,
        discount: parsedDiscount,
        netPayable,
        advancePaid: parsedAdvance,
        dueAmount,
        status: 'pending',
        items: {
          create: calculatedItems,
        },
      },
      include: {
        items: true,
      },
    });

    // Create Audit Log
    try {
      await prisma.auditLog.create({
        data: {
          userId: (session.user as any).id,
          action: 'INVESTIGATION_REGISTERED',
          target: registration.regNo,
          metadata: JSON.stringify({
            regNo: registration.regNo,
            patientName: registration.patientName,
            totalAmount: registration.totalAmount,
            netPayable: registration.netPayable,
            itemsCount: calculatedItems.length,
          }),
        },
      });
    } catch (auditErr) {
      console.warn('[AUDIT_WARN] Could not create audit log:', auditErr);
    }

    return NextResponse.json(registration, { status: 201 });
  } catch (error: any) {
    console.error('[INVESTIGATION_REG_POST_ERR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to register investigation' },
      { status: 500 }
    );
  }
}
