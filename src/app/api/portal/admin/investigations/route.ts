import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/portal/admin/investigations
 * Returns all investigation tests (including inactive ones) for admin management.
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const search = searchParams.get('search')?.toLowerCase() ?? '';
    const category = searchParams.get('category') ?? '';

    const where: any = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
      ];
    }
    if (category) {
      where.category = category;
    }

    const tests = await prisma.investigationTest.findMany({
      where,
      orderBy: { name: 'asc' },
    });

    const categories = await prisma.investigationTest.findMany({
      select: { category: true },
      distinct: ['category'],
      where: { category: { not: null } },
    });

    return NextResponse.json({
      tests,
      categories: categories.map((c) => c.category).filter(Boolean),
      total: tests.length,
    });
  } catch (error: any) {
    console.error('[ADMIN_INVESTIGATIONS_GET_ERR]', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}

/**
 * POST /api/portal/admin/investigations
 * Creates a new investigation test.
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { name, amount, category, reportTime, code } = await req.json();

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Test name is required' }, { status: 400 });
    }
    if (amount === undefined || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid amount/rate is required' }, { status: 400 });
    }

    // Check for duplicate name
    const existing = await prisma.investigationTest.findUnique({
      where: { name: name.trim() },
    });
    if (existing) {
      return NextResponse.json({ error: 'An investigation test with this name already exists' }, { status: 409 });
    }

    // Check for duplicate code if provided
    if (code && code.trim()) {
      const existingCode = await prisma.investigationTest.findUnique({
        where: { code: code.trim() },
      });
      if (existingCode) {
        return NextResponse.json({ error: 'An investigation test with this code already exists' }, { status: 409 });
      }
    }

    const test = await prisma.investigationTest.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        category: category?.trim() || 'Pathology',
        reportTime: reportTime?.trim() || 'Same Day',
        code: code?.trim() || undefined,
        isActive: true,
      },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'CREATE_INVESTIGATION_TEST',
        target: `InvestigationTest:${test.id}`,
        metadata: JSON.stringify({ name: test.name, code: test.code, amount: test.amount, category: test.category }),
      },
    });

    return NextResponse.json({ success: true, test }, { status: 201 });
  } catch (error: any) {
    console.error('[ADMIN_INVESTIGATION_CREATE_ERR]', error);
    return NextResponse.json({ error: error.message || 'Failed to create investigation test' }, { status: 500 });
  }
}
