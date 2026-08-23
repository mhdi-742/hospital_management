import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

interface Ctx {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/portal/admin/investigations/[id]
 * Updates an investigation test.
 */
export async function PATCH(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    const body = await req.json();
    const { name, amount, category, reportTime, code, isActive } = body;

    // If name is being changed, check for duplicates
    if (name !== undefined && name.trim()) {
      const existing = await prisma.investigationTest.findFirst({
        where: {
          name: name.trim(),
          NOT: { id },
        },
      });
      if (existing) {
        return NextResponse.json({ error: 'Another investigation test with this name already exists' }, { status: 409 });
      }
    }

    // If code is being changed, check for duplicates
    if (code !== undefined && code.trim()) {
      const existingCode = await prisma.investigationTest.findFirst({
        where: {
          code: code.trim(),
          NOT: { id },
        },
      });
      if (existingCode) {
        return NextResponse.json({ error: 'Another investigation test with this code already exists' }, { status: 409 });
      }
    }

    const updateData: any = {};
    if (name !== undefined) updateData.name = name.trim();
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (category !== undefined) updateData.category = category.trim() || 'Pathology';
    if (reportTime !== undefined) updateData.reportTime = reportTime.trim() || 'Same Day';
    if (code !== undefined) updateData.code = code.trim() || null;
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);

    const updated = await prisma.investigationTest.update({
      where: { id },
      data: updateData,
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'UPDATE_INVESTIGATION_TEST',
        target: `InvestigationTest:${id}`,
        metadata: JSON.stringify(updateData),
      },
    });

    return NextResponse.json({ success: true, test: updated });
  } catch (error: any) {
    console.error('[ADMIN_INVESTIGATION_UPDATE_ERR]', error);
    return NextResponse.json({ error: error.message || 'Failed to update investigation test' }, { status: 500 });
  }
}

/**
 * DELETE /api/portal/admin/investigations/[id]
 * Deletes an investigation test.
 */
export async function DELETE(req: NextRequest, { params }: Ctx) {
  const session = await auth();
  if (!session || (session.user as any)?.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id } = await params;

  try {
    // Check if the test is used in any registration items
    const usageCount = await prisma.investigationRegistrationItem.count({
      where: { testId: id },
    });

    if (usageCount > 0) {
      // Soft-delete: set isActive to false instead of hard-deleting
      await prisma.investigationTest.update({
        where: { id },
        data: { isActive: false },
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          userId: session.user.id,
          action: 'DEACTIVATE_INVESTIGATION_TEST',
          target: `InvestigationTest:${id}`,
          metadata: JSON.stringify({ reason: 'Has linked registration items', usageCount }),
        },
      });

      return NextResponse.json({
        success: true,
        softDeleted: true,
        message: `This test has been used in ${usageCount} registration(s). It has been deactivated instead of deleted.`,
      });
    }

    // Hard delete since no linked records
    await prisma.investigationTest.delete({
      where: { id },
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId: session.user.id,
        action: 'DELETE_INVESTIGATION_TEST',
        target: `InvestigationTest:${id}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('[ADMIN_INVESTIGATION_DELETE_ERR]', error);
    return NextResponse.json({ error: error.message || 'Failed to delete investigation test' }, { status: 500 });
  }
}
