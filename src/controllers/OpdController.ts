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
    const hospitalName = settings?.value ?? 'Apex City General Hospital';

    const dbAnnouncements = await prisma.announcement.findMany({
      where: { isActive: true, board: { in: ['ALL', 'OPD'] } },
      select: { text: true },
    });
    const announcements = dbAnnouncements.map(a => a.text);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const dbDoctors = await prisma.doctor.findMany({
      include: {
        user: { select: { name: true } },
        department: true,
        opdSessions: {
          where: {
            date: {
              gte: todayStart,
              lte: todayEnd,
            },
          },
          take: 1,
        },
      },
      orderBy: { id: 'asc' },
    });

    const doctors: FlatDoctor[] = dbDoctors.map(doc => {
      const session = doc.opdSessions[0];
      return {
        id: doc.id,
        name: doc.user.name,
        designation: doc.designation,
        roomNo: doc.roomNo ?? 'TBD',
        status: (session?.status as DoctorStatus) ?? 'unavailable',
        startTime: session?.startTime ?? '09:00',
        endTime: session?.endTime ?? '17:00',
        currentToken: session?.currentToken ?? null,
        totalTokens: session?.totalTokens ?? 0,
        avgWaitMinutes: session?.avgWaitMinutes ?? 0,
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
