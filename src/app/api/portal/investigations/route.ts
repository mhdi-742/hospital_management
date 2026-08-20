import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import fallbackInvestigations from '@/data/investigations.json';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const search   = searchParams.get('search')?.toLowerCase() ?? '';
    const category = searchParams.get('category') ?? '';

    let tests = [];
    try {
      const where: any = { isActive: true };
      if (search) {
        where.name = { contains: search };
      }
      if (category) {
        where.category = category;
      }

      tests = await prisma.investigationTest.findMany({
        where,
        orderBy: { name: 'asc' },
      });
    } catch (dbErr) {
      console.warn('[INVESTIGATIONS_GET_DB_WARN] Using fallback JSON data:', dbErr);
      tests = fallbackInvestigations.filter((item: any) => {
        const matchesSearch = !search || item.name.toLowerCase().includes(search);
        const matchesCategory = !category || item.category === category;
        return matchesSearch && matchesCategory;
      });
    }

    // Also get all distinct categories
    const categories = Array.from(
      new Set((tests.length > 0 ? tests : fallbackInvestigations).map((t: any) => t.category).filter(Boolean))
    );

    return NextResponse.json({
      tests,
      categories,
      total: tests.length,
    });
  } catch (error: any) {
    console.error('[INVESTIGATIONS_GET_ERR]', error);
    return NextResponse.json(
      { tests: fallbackInvestigations, categories: [], total: fallbackInvestigations.length },
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
    const { name, amount, category, reportTime, code } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Test name is required' }, { status: 400 });
    }
    if (amount === undefined || isNaN(parseFloat(amount))) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    const test = await prisma.investigationTest.create({
      data: {
        name: name.trim(),
        amount: parseFloat(amount),
        category: category?.trim() || 'General',
        reportTime: reportTime?.trim() || 'Same Day',
        code: code?.trim() || undefined,
        isActive: true,
      },
    });

    return NextResponse.json(test, { status: 201 });
  } catch (error: any) {
    console.error('[INVESTIGATION_POST_ERR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to create investigation test' },
      { status: 500 }
    );
  }
}
