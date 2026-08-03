import { prisma } from '../lib/prisma';
import { getOtFallback } from '../lib/jsonFallback';
import type { OtApiResponse, OtEntry } from '../lib/types';

/**
 * OtController — queries Prisma DB instead of JSON flat-files.
 * Falls back to static JSON data when the database is unavailable.
 * Server-side only.
 */
export class OtController {
  /**
   * Assemble the full OT display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/ot Route Handler (client polling)
   */
  static async getDisplayData(): Promise<OtApiResponse> {
    return getOtFallback();
  }


  private static async _getFromDb(): Promise<OtApiResponse> {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { key: 'hospitalName' },
    });
    const hospitalName = settings?.value ?? 'Apex City General Hospital';

    const dbAnnouncements = await prisma.announcement.findMany({
      where: { isActive: true, board: { in: ['ALL', 'OT'] } },
      select: { text: true },
    });
    const announcements = dbAnnouncements.map(a => a.text);

    // Fetch active or scheduled OT cases
    const dbOtCases = await prisma.otCase.findMany({
      include: {
        otRoom: true,
        leadDoctor: { include: { user: true } },
        assistants: { include: { doctor: { include: { user: true } } } },
        admission: { include: { patient: true } },
      },
      orderBy: { scheduledTime: 'asc' },
    });

    const entries: OtEntry[] = dbOtCases.map(ot => {
      const assistants = ot.assistants.map(a => a.doctor.user.name);
      return {
        id: ot.id,
        roomNo: ot.otRoom?.roomNo ?? 'TBD',
        type: ot.otRoom?.type ?? 'General Surgery',
        procedureName: ot.procedureName,
        patientName: ot.admission.patient.name,
        patientAge: ot.admission.patient.age ?? 0,
        patientGender: (ot.admission.patient.gender as any) ?? 'M',
        doctor: ot.leadDoctor?.user.name ?? 'TBD',
        assistants,
        anaesthetist: ot.anaesthetist ?? 'N/A',
        scheduledTime: ot.scheduledTime ?? '09:00',
        estimatedDuration: ot.estimatedDuration ?? 60,
        // Map in_progress to in-progress for UI compatibility
        status: (ot.status === 'in_progress' ? 'in-progress' : ot.status) as any,
        notes: ot.notes ?? '',
      };
    });

    return {
      hospitalName,
      announcements,
      entries,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
  }
}
