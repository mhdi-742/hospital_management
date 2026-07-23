import { prisma } from '../lib/prisma';
import type { IpdApiResponse, Ward, Patient } from '../lib/types';

/**
 * IpdController — queries Prisma DB instead of JSON flat-files.
 * Server-side only.
 */
export class IpdController {
  /**
   * Assemble the full IPD display payload consumed by:
   *   - the TV screen Server Component (initial render)
   *   - the GET /api/ipd Route Handler (client polling)
   */
  static async getDisplayData(): Promise<IpdApiResponse> {
    const settings = await prisma.hospitalSettings.findUnique({
      where: { key: 'hospitalName' },
    });
    const hospitalName = settings?.value ?? 'Apex City General Hospital';

    const dbAnnouncements = await prisma.announcement.findMany({
      where: { isActive: true, board: { in: ['ALL', 'IPD'] } },
      select: { text: true },
    });
    const announcements = dbAnnouncements.map(a => a.text);

    const dbWards = await prisma.ward.findMany({
      include: {
        admissions: {
          where: { status: 'active', type: 'IPD' },
          include: { patient: true, bed: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    const wards: Ward[] = dbWards.map(w => {
      const patients: Patient[] = w.admissions.map(adm => {
        return {
          id: adm.patient.id,
          name: adm.patient.name,
          age: adm.patient.age ?? 0,
          gender: (adm.patient.gender as any) ?? 'M',
          admissionDate: adm.admittedAt.toISOString().split('T')[0],
          bedNo: adm.bed?.bedNo ?? 'N/A',
          status: (adm.patientCondition as any) ?? 'stable',
        };
      });

      return {
        id: w.id,
        name: w.name,
        code: w.code,
        roomNo: w.roomNo ?? undefined,
        floorNo: w.floorNo ?? undefined,
        capacity: w.capacity,
        accentColor: w.accentColor,
        patients,
      };
    });

    return {
      hospitalName,
      announcements,
      wards,
      lastUpdated: new Date().toLocaleTimeString('en-US', { hour12: false }),
    };
  }
}
