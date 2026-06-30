import { prisma } from '../lib/prisma';
import type { OpdApiResponse, FlatDoctor, DoctorStatus } from '../lib/types';

/**
 * OpdController — queries Prisma DB instead of JSON flat-files.
 * Server-side only.
 */
export class OpdController {
  /**
   * Assemble the full display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/opd Route Handler (client polling)
   */
  static async getDisplayData(): Promise<OpdApiResponse> {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { key: 'hospitalName' },
    });
    const hospitalName = settings?.value ?? 'Mikki Megha General Hospital';

    const dbAnnouncements = await prisma.announcement.findMany({
      where: { isActive: true, board: { in: ['ALL', 'OPD'] } },
      select: { text: true },
    });
    const announcements = dbAnnouncements.map(a => a.text);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    // Query sessions first, then map doctor info onto each one.
    // This naturally handles:
    //   - Multiple sessions per doctor (each becomes a separate entry)
    //   - Doctors with no session today are automatically excluded
    const dbSessions = await prisma.opdSession.findMany({
      where: {
        date: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        doctor: {
          include: {
            user: { select: { name: true } },
            department: true,
          },
        },
      },
      orderBy: { startTime: 'asc' },
    });

    const doctors: FlatDoctor[] = dbSessions.map(session => {
      const doc = session.doctor;
      return {
        id: session.id,
        name: doc.user.name,
        designation: doc.designation,
        roomNo: doc.roomNo ?? 'TBD',
        status: (session.status as DoctorStatus) ?? 'unavailable',
        startTime: session.startTime,
        endTime: session.endTime,
        currentToken: session.currentToken ?? null,
        totalTokens: session.totalTokens,
        avgWaitMinutes: session.avgWaitMinutes,
        departmentId: doc.department?.id ?? 'none',
        departmentName: doc.department?.name ?? 'General Medicine',
        departmentFloor: doc.department?.floor ?? '1st Floor',
        departmentColor: doc.department?.color ?? '#3b82f6',
      };
    });

    return {
      hospitalName,
      announcements,
      doctors,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
  }
}
