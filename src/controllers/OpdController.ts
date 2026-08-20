import { prisma } from '../lib/prisma';
import { getOpdFallback } from '../lib/jsonFallback';
import type { OpdApiResponse, FlatDoctor, DoctorStatus } from '../lib/types';

/**
 * OpdController — queries Prisma DB instead of JSON flat-files.
 * Falls back to static JSON data when the database is unavailable.
 * Server-side only.
 */
export class OpdController {
  /**
   * Assemble the full display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/opd Route Handler (client polling)
   */
  static async getDisplayData(): Promise<OpdApiResponse> {
    try {
      return await this._getFromDb();
    } catch (error) {
      console.warn('[OpdController] DB query failed, falling back to JSON:', error);
      return getOpdFallback();
    }
  }


  private static async _getFromDb(): Promise<OpdApiResponse> {
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

    const sessionIds = dbSessions.map(s => s.id);
    const activeAdmissions = sessionIds.length > 0
      ? await prisma.admission.findMany({
          where: {
            opdSessionId: { in: sessionIds },
            status: 'active',
          },
          select: {
            opdSessionId: true,
            tokenNo: true,
            queueOrder: true,
            admittedAt: true,
          },
          orderBy: [
            { queueOrder: 'asc' },
            { admittedAt: 'asc' },
          ],
        })
      : [];

    const doctors: FlatDoctor[] = dbSessions.map(session => {
      const doc = session.doctor;
      const sessionQueue = activeAdmissions.filter(a => a.opdSessionId === session.id);
      let nextToken: number | null = null;

      if (session.currentToken) {
        const nextWaiting = sessionQueue.find(a => (a.tokenNo ?? 0) > 0 && a.tokenNo !== session.currentToken);
        nextToken = nextWaiting?.tokenNo ?? (session.currentToken < session.totalTokens ? session.currentToken + 1 : null);
      } else {
        const firstWaiting = sessionQueue[0];
        nextToken = firstWaiting?.tokenNo ?? (session.totalTokens > 0 ? 1 : null);
      }

      return {
        id: session.id,
        name: doc.user.name,
        designation: doc.designation,
        roomNo: session.opdNo || doc.roomNo || 'TBD',
        status: (session.status as DoctorStatus) ?? 'unavailable',
        startTime: session.startTime,
        endTime: session.endTime,
        currentToken: session.currentToken ?? null,
        nextToken: nextToken,
        totalTokens: session.totalTokens,
        avgWaitMinutes: session.avgWaitMinutes,
        departmentId: doc.department?.id ?? 'none',
        departmentName: doc.department?.name ?? 'General Medicine',
        departmentFloor: session.floor || doc.department?.floor || '1st Floor',
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
