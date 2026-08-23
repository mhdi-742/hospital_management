import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    const role = (session?.user as any)?.role;
    if (!session || (role !== 'ADMIN' && role !== 'RECEPTIONIST' && role !== 'NURSE')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = req.nextUrl;
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const search = searchParams.get('search')?.trim().toLowerCase() || '';
    const payModeFilter = searchParams.get('payMode') || '';

    // Date range filter
    const dateFilter: any = {};
    if (startDateParam || endDateParam) {
      if (startDateParam) {
        const start = new Date(startDateParam);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (endDateParam) {
        const end = new Date(endDateParam);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
    } else {
      // Default to today if no dates provided
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);
      dateFilter.gte = todayStart;
      dateFilter.lte = todayEnd;
    }

    // Parallel fetch from all 3 billing streams
    const [hospitalBills, investigationBills, advancePayments] = await Promise.all([
      prisma.bill.findMany({
        where: {
          createdAt: dateFilter,
        },
        include: {
          items: true,
          discounts: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.investigationBill.findMany({
        where: {
          createdAt: dateFilter,
        },
        include: {
          items: true,
          discounts: true,
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.advancePayment.findMany({
        where: {
          createdAt: dateFilter,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Apply search and payMode filters if present
    const filteredHospitalBills = hospitalBills.filter((b) => {
      const matchSearch =
        !search ||
        b.billNo.toLowerCase().includes(search) ||
        b.patientName.toLowerCase().includes(search) ||
        (b.underDoctor && b.underDoctor.toLowerCase().includes(search)) ||
        (b.mmhplId && b.mmhplId.toLowerCase().includes(search));
      return matchSearch;
    });

    const filteredInvestigationBills = investigationBills.filter((b) => {
      const matchSearch =
        !search ||
        b.billNo.toLowerCase().includes(search) ||
        b.patientName.toLowerCase().includes(search) ||
        (b.underDoctor && b.underDoctor.toLowerCase().includes(search)) ||
        (b.referredBy && b.referredBy.toLowerCase().includes(search)) ||
        (b.mmhplId && b.mmhplId.toLowerCase().includes(search)) ||
        (b.contact && b.contact.includes(search));
      const matchPayMode =
        !payModeFilter ||
        (b.payMode && b.payMode.toLowerCase().includes(payModeFilter.toLowerCase())) ||
        (b.payments && b.payments.some((p) => p.mode.toLowerCase().includes(payModeFilter.toLowerCase())));
      return matchSearch && matchPayMode;
    });

    const filteredAdvancePayments = advancePayments.filter((a) => {
      const matchSearch =
        !search ||
        a.receiptNo.toLowerCase().includes(search) ||
        a.patientName.toLowerCase().includes(search) ||
        (a.underDoctor && a.underDoctor.toLowerCase().includes(search)) ||
        (a.mmhplId && a.mmhplId.toLowerCase().includes(search)) ||
        (a.transactionId && a.transactionId.toLowerCase().includes(search));
      const matchPayMode =
        !payModeFilter || (a.payMode && a.payMode.toLowerCase().includes(payModeFilter.toLowerCase()));
      return matchSearch && matchPayMode;
    });

    // ── 1. Calculate Hospital Bills Summary ──
    const hospitalSummary = {
      count: filteredHospitalBills.length,
      subTotal: filteredHospitalBills.reduce((acc, b) => acc + (b.subTotal || 0), 0),
      discount: filteredHospitalBills.reduce((acc, b) => acc + (b.totalDiscount || 0), 0),
      advanceAdjusted: filteredHospitalBills.reduce((acc, b) => acc + (b.advance || 0), 0),
      netPayable: filteredHospitalBills.reduce((acc, b) => acc + (b.netPayable || 0), 0),
    };

    // ── 2. Calculate Investigation Bills Summary ──
    const investigationSummary = {
      count: filteredInvestigationBills.length,
      subTotal: filteredInvestigationBills.reduce((acc, b) => acc + (b.subTotal || 0), 0),
      discount: filteredInvestigationBills.reduce((acc, b) => acc + (b.totalDiscount || 0), 0),
      netPayable: filteredInvestigationBills.reduce((acc, b) => acc + (b.netPayable || 0), 0),
      totalPaid: filteredInvestigationBills.reduce((acc, b) => acc + (b.totalPaid !== undefined ? b.totalPaid : b.advance || 0), 0),
      dueAmount: filteredInvestigationBills.reduce((acc, b) => acc + (b.dueAmount || 0), 0),
    };

    // ── 3. Calculate Advance Receipts Summary ──
    const advanceSummary = {
      count: filteredAdvancePayments.length,
      totalAmount: filteredAdvancePayments.reduce((acc, a) => acc + (a.amount || 0), 0),
    };

    // ── 4. Overall Financial KPIs ──
    const overallSummary = {
      totalTransactions: hospitalSummary.count + investigationSummary.count + advanceSummary.count,
      totalGrossAmount: hospitalSummary.subTotal + investigationSummary.subTotal + advanceSummary.totalAmount,
      totalDiscounts: hospitalSummary.discount + investigationSummary.discount,
      totalNetBilled: hospitalSummary.netPayable + investigationSummary.netPayable + advanceSummary.totalAmount,
      totalCollected: hospitalSummary.netPayable + investigationSummary.totalPaid + advanceSummary.totalAmount,
      totalDuePending: investigationSummary.dueAmount,
    };

    // ── 5. Payment Modes Breakdown Calculation ──
    const paymentModeTotals: Record<string, { count: number; amount: number }> = {
      Cash: { count: 0, amount: 0 },
      'UPI / Online': { count: 0, amount: 0 },
      'Debit / Credit Card': { count: 0, amount: 0 },
      Cheque: { count: 0, amount: 0 },
      Other: { count: 0, amount: 0 },
    };

    // Helper to categorize payment mode
    const categorizeMode = (modeStr: string | null | undefined): string => {
      if (!modeStr) return 'Cash';
      const m = modeStr.toLowerCase();
      if (m.includes('upi') || m.includes('online') || m.includes('gpay') || m.includes('phonepe') || m.includes('paytm')) {
        return 'UPI / Online';
      }
      if (m.includes('card') || m.includes('pos') || m.includes('debit') || m.includes('credit')) {
        return 'Debit / Credit Card';
      }
      if (m.includes('cheque') || m.includes('bank') || m.includes('neft') || m.includes('rtgs')) {
        return 'Cheque';
      }
      if (m.includes('cash')) {
        return 'Cash';
      }
      return 'Other';
    };

    // Aggregate from Advance Payments
    filteredAdvancePayments.forEach((a) => {
      const mode = categorizeMode(a.payMode);
      paymentModeTotals[mode].count += 1;
      paymentModeTotals[mode].amount += a.amount || 0;
    });

    // Aggregate from Investigation Bills
    filteredInvestigationBills.forEach((b) => {
      if (b.payments && b.payments.length > 0) {
        b.payments.forEach((p) => {
          const mode = categorizeMode(p.mode);
          paymentModeTotals[mode].count += 1;
          paymentModeTotals[mode].amount += p.amount || 0;
        });
      } else {
        const mode = categorizeMode(b.payMode);
        paymentModeTotals[mode].count += 1;
        paymentModeTotals[mode].amount += (b.totalPaid !== undefined ? b.totalPaid : b.advance) || 0;
      }
    });

    // Aggregate from Hospital Bills (defaulting to Cash / General)
    filteredHospitalBills.forEach((b) => {
      paymentModeTotals['Cash'].count += 1;
      paymentModeTotals['Cash'].amount += b.netPayable || 0;
    });

    // ── 6. Unified Unified Chronological Ledger Entries ──
    const unifiedLedger: any[] = [];

    // Map Hospital Bills
    filteredHospitalBills.forEach((b) => {
      unifiedLedger.push({
        id: b.id,
        type: 'HOSPITAL',
        typeLabel: 'Hospital Bill',
        refNo: b.billNo,
        patientName: b.patientName,
        patientAge: b.patientAge,
        doctor: b.underDoctor || '—',
        caseType: b.caseType || 'Inpatient / OPD',
        subTotal: b.subTotal,
        discount: b.totalDiscount,
        netAmount: b.netPayable,
        paidAmount: b.netPayable,
        dueAmount: 0,
        payMode: 'Cash / Bill',
        date: b.billDate || new Date(b.createdAt).toLocaleDateString('en-IN'),
        createdAt: b.createdAt.toISOString(),
        billedBy: b.createdByName || 'Staff',
        itemCount: b.items.length,
        itemsSummary: b.items.map((i) => i.name).filter(Boolean).slice(0, 3).join(', ') + (b.items.length > 3 ? '...' : ''),
      });
    });

    // Map Investigation Bills
    filteredInvestigationBills.forEach((b) => {
      const paid = b.totalPaid !== undefined ? b.totalPaid : b.advance || 0;
      const due = b.dueAmount !== undefined ? b.dueAmount : Math.max(0, b.netPayable - paid);
      unifiedLedger.push({
        id: b.id,
        type: 'INVESTIGATION',
        typeLabel: 'Investigation Test',
        refNo: b.billNo,
        patientName: b.patientName,
        patientAge: b.patientAge,
        doctor: b.underDoctor || b.referredBy || 'Self',
        caseType: b.caseType || 'Diagnostic Lab',
        subTotal: b.subTotal,
        discount: b.totalDiscount,
        netAmount: b.netPayable,
        paidAmount: paid,
        dueAmount: due,
        payMode: b.payMode || 'Cash',
        date: b.billDate || new Date(b.createdAt).toLocaleDateString('en-IN'),
        createdAt: b.createdAt.toISOString(),
        billedBy: b.createdByName || 'Staff',
        itemCount: b.items.length,
        itemsSummary: b.items.map((i) => i.name).filter(Boolean).slice(0, 3).join(', ') + (b.items.length > 3 ? '...' : ''),
      });
    });

    // Map Advance Payments
    filteredAdvancePayments.forEach((a) => {
      unifiedLedger.push({
        id: a.id,
        type: 'ADVANCE',
        typeLabel: 'Advance Deposit',
        refNo: a.receiptNo,
        patientName: a.patientName,
        patientAge: a.patientAge,
        doctor: a.underDoctor || '—',
        caseType: 'Advance Payment',
        subTotal: a.amount,
        discount: 0,
        netAmount: a.amount,
        paidAmount: a.amount,
        dueAmount: 0,
        payMode: a.payMode || 'Cash',
        date: new Date(a.createdAt).toLocaleDateString('en-IN'),
        createdAt: a.createdAt.toISOString(),
        billedBy: a.createdByName || 'Staff',
        itemCount: 1,
        itemsSummary: a.remarks || 'Advance deposit receipt',
        transactionId: a.transactionId || null,
      });
    });

    // Sort unified ledger descending by createdAt
    unifiedLedger.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({
      dateRange: {
        startDate: startDateParam || null,
        endDate: endDateParam || null,
      },
      overallSummary,
      hospitalSummary,
      investigationSummary,
      advanceSummary,
      paymentModeTotals,
      hospitalBills: filteredHospitalBills,
      investigationBills: filteredInvestigationBills,
      advancePayments: filteredAdvancePayments,
      unifiedLedger,
    });
  } catch (error: any) {
    console.error('[REPORTS_TRANSACTIONS_ERR]', error);
    return NextResponse.json(
      { error: error.message || 'Failed to generate financial reports' },
      { status: 500 }
    );
  }
}
