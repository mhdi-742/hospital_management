import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
dotenv.config();

function parseDbUrl(url: string) {
  const u = new URL(url);
  return {
    host:     u.hostname,
    port:     u.port ? parseInt(u.port, 10) : 3306,
    user:     u.username || 'root',
    password: u.password || undefined,
    database: u.pathname.replace(/^\//, ''),
  };
}

const dbUrl  = process.env.DATABASE_URL ?? 'mysql://root@localhost:3306/hospital_db';
const adapter = new PrismaMariaDb({ ...parseDbUrl(dbUrl), connectionLimit: 3 });
const prisma  = new PrismaClient({ adapter });

// ── Load existing JSON data ───────────────────────────────────────────
const dataDir = path.join(process.cwd(), 'src', 'data');
const opdJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'opd.json'), 'utf-8'));
const ipdJson = JSON.parse(fs.readFileSync(path.join(dataDir, 'ipd.json'), 'utf-8'));
const otJson  = JSON.parse(fs.readFileSync(path.join(dataDir, 'ot.json'),  'utf-8'));

/* ── Dynamic Date Helpers ─────────────────────────────────────────────── */
const baselineDate = new Date('2026-06-20T00:00:00Z');
const currentDateTime = new Date();

function getRelativeDate(oldDateStr: string): Date {
  const oldDate = new Date(oldDateStr + 'T00:00:00Z');
  const diffTime = oldDate.getTime() - baselineDate.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  
  const newDate = new Date(currentDateTime);
  newDate.setDate(currentDateTime.getDate() + diffDays);
  newDate.setHours(8, 0, 0, 0); // default to 8:00 AM
  return newDate;
}

const MOCK_OPD_PATIENTS = [
  { name: 'Amit Das', age: 28, gender: 'M', complaint: 'Fever and cold for 3 days' },
  { name: 'Sita Banerjee', age: 34, gender: 'F', complaint: 'Severe headache and nausea' },
  { name: 'Rahul Sen', age: 42, gender: 'M', complaint: 'Routine checkup for diabetes' },
  { name: 'Priya Chakraborty', age: 24, gender: 'F', complaint: 'Sore throat and body aches' },
  { name: 'Vikram Chatterjee', age: 50, gender: 'M', complaint: 'Chest congestion and cough' },
  { name: 'Rupa Ganguly', age: 45, gender: 'F', complaint: 'Lower back pain' },
  { name: 'Joydeb Roy', age: 60, gender: 'M', complaint: 'Hypertension follow-up' },
  { name: 'Kabita Saha', age: 55, gender: 'F', complaint: 'Joint pain and swelling' },
  { name: 'Animesh Ghosh', age: 31, gender: 'M', complaint: 'Stomach ache after meals' },
  { name: 'Mithu Kundu', age: 38, gender: 'F', complaint: 'Skin rash on arm' },
  { name: 'Sandip Paul', age: 27, gender: 'M', complaint: 'Sprained ankle' },
  { name: 'Deblina Seal', age: 33, gender: 'F', complaint: 'Mild asthma symptoms' }
];

/* ── Doctor Helper ────────────────────────────────────────────────────── */
async function getOrCreateDoctorByName(name: string, tx: typeof prisma) {
  const existing = await tx.doctor.findFirst({
    where: { user: { name: name } },
  });
  if (existing) return existing;

  const email = `${name.toLowerCase().replace(/[^a-z]/g, '')}@hospital.local`;
  const hashed = await bcrypt.hash('Doctor@123', 12);
  const user = await tx.user.create({
    data: {
      email,
      password: hashed,
      name: name,
      role: 'DOCTOR',
    },
  });

  return await tx.doctor.create({
    data: {
      userId: user.id,
      designation: 'Consultant Specialist',
      roomNo: 'TBD',
    },
  });
}

async function main() {
  console.log('🌱  Starting seed with relative dates...');

  // ── Hospital settings ─────────────────────────────────────────────
  await prisma.hospitalSettings.upsert({
    where: { key: 'hospitalName' },
    update: { value: opdJson.hospitalName },
    create: { key: 'hospitalName', value: opdJson.hospitalName },
  });
  console.log('✅  Hospital settings seeded.');

  // ── Admin user ────────────────────────────────────────────────────
  const adminEmail    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@hospital.local';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
  const hashedAdmin   = await bcrypt.hash(adminPassword, 12);

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email:    adminEmail,
      password: hashedAdmin,
      name:     'Hospital Admin',
      role:     'ADMIN',
    },
  });
  console.log(`✅  Admin user: ${adminEmail} / ${adminPassword}`);

  // ── Departments & Doctors from OPD JSON ───────────────────────────
  for (const dept of opdJson.departments) {
    const department = await prisma.department.upsert({
      where:  { id: dept.id },
      update: { name: dept.name, floor: dept.floor, color: dept.color },
      create: { id: dept.id, name: dept.name, floor: dept.floor, color: dept.color },
    });

    for (const doc of dept.doctors) {
      const doctorEmail    = `${doc.id}@hospital.local`;
      const doctorPassword = 'Doctor@123';
      const hashed         = await bcrypt.hash(doctorPassword, 12);

      const user = await prisma.user.upsert({
        where:  { email: doctorEmail },
        update: {},
        create: {
          email:    doctorEmail,
          password: hashed,
          name:     doc.name,
          role:     'DOCTOR',
        },
      });

      const doctor = await prisma.doctor.upsert({
        where:  { userId: user.id },
        update: { designation: doc.designation, roomNo: doc.roomNo, departmentId: department.id },
        create: {
          userId:       user.id,
          designation:  doc.designation,
          roomNo:       doc.roomNo,
          departmentId: department.id,
        },
      });

      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await prisma.opdSession.upsert({
        where: { id: doc.id + '-session' },
        update: {
          date:          today,
          floor:         dept.floor,
          status:        doc.status,
          currentToken:  doc.currentToken ?? null,
          totalTokens:   doc.totalTokens,
          avgWaitMinutes: doc.avgWaitMinutes,
        },
        create: {
          id:            doc.id + '-session',
          doctorId:      doctor.id,
          date:          today,
          startTime:     doc.startTime,
          endTime:       doc.endTime,
          floor:         dept.floor,
          status:        doc.status,
          currentToken:  doc.currentToken ?? null,
          totalTokens:   doc.totalTokens,
          avgWaitMinutes: doc.avgWaitMinutes,
        },
      });

      // ── Seed patient queue for this session if it is running, upcoming or break ──
      const opdSessionId = doc.id + '-session';
      if (doc.status === 'running' || doc.status === 'upcoming' || doc.status === 'break') {
        const sessionAdmissions = await prisma.admission.findMany({
          where: { opdSessionId },
          select: { id: true },
        });
        const sessionAdmissionIds = sessionAdmissions.map((a) => a.id);

        await prisma.patientDoctor.deleteMany({
          where: { admissionId: { in: sessionAdmissionIds } },
        });
        await prisma.admission.deleteMany({
          where: { id: { in: sessionAdmissionIds } },
        });

        // Create a dynamic queue of 5-8 patients
        const numPatients = Math.floor(Math.random() * 4) + 5; // 5 to 8 patients
        const currentToken = doc.currentToken ?? (doc.status === 'running' ? Math.floor(numPatients / 2) : null);

        // Update the session's token counts
        await prisma.opdSession.update({
          where: { id: opdSessionId },
          data: {
            date: today,
            totalTokens: numPatients,
            currentToken: currentToken,
          },
        });

        for (let i = 0; i < numPatients; i++) {
          const patientTemplate = MOCK_OPD_PATIENTS[(doc.id.charCodeAt(0) + i) % MOCK_OPD_PATIENTS.length];
          const patientId = `${opdSessionId}-patient-${i}`;

          const dbPatient = await prisma.patient.upsert({
            where: { id: patientId },
            update: { name: patientTemplate.name, age: patientTemplate.age, gender: patientTemplate.gender as any },
            create: {
              id: patientId,
              name: patientTemplate.name,
              age: patientTemplate.age,
              gender: patientTemplate.gender as any,
              chiefComplaint: patientTemplate.complaint,
            },
          });

          const admittedAt = new Date(today);
          admittedAt.setHours(8, i * 15, 0, 0); // spaced 15 mins apart starting at 8:00 AM

          const admissionId = `${opdSessionId}-adm-${i}`;
          await prisma.admission.upsert({
            where: { id: admissionId },
            update: {
              status: 'active',
              admittedAt,
            },
            create: {
              id: admissionId,
              patientId: dbPatient.id,
              type: 'OPD',
              status: 'active',
              opdSessionId: opdSessionId,
              admittedAt,
            },
          });

          await prisma.patientDoctor.upsert({
            where: { admissionId_doctorId: { admissionId, doctorId: doctor.id } },
            update: {},
            create: {
              admissionId,
              doctorId: doctor.id,
              role: 'primary',
            },
          });
        }
      }

      console.log(`  👨‍⚕️  Doctor: ${doc.name} → ${doctorEmail} / Doctor@123`);
    }
  }
  console.log('✅  Departments & Doctors seeded.');

  // ── Wards from IPD JSON ───────────────────────────────────────────
  for (const ward of ipdJson.wards) {
    const dbWard = await prisma.ward.upsert({
      where:  { id: ward.id },
      update: { name: ward.name, code: ward.code, capacity: ward.capacity, accentColor: ward.accentColor },
      create: { id: ward.id, name: ward.name, code: ward.code, capacity: ward.capacity, accentColor: ward.accentColor },
    });

    // Pre-create all beds for this ward up to its capacity
    for (let bedIdx = 1; bedIdx <= dbWard.capacity; bedIdx++) {
      const padNo = String(bedIdx).padStart(2, '0');
      const bedNo = `${dbWard.code}-${padNo}`;
      await prisma.bed.upsert({
        where: {
          wardId_bedNo: {
            wardId: dbWard.id,
            bedNo: bedNo
          }
        },
        update: {},
        create: {
          id: `${dbWard.id}-bed-${padNo}`,
          wardId: dbWard.id,
          bedNo: bedNo
        }
      });
    }

    for (const patient of ward.patients) {
      const dbPatient = await prisma.patient.upsert({
        where:  { id: patient.id },
        update: { name: patient.name, age: patient.age, gender: patient.gender },
        create: {
          id:     patient.id,
          name:   patient.name,
          age:    patient.age,
          gender: patient.gender,
        },
      });

      const padNo = patient.bedNo.slice(-2);
      const bedId = `${dbWard.id}-bed-${padNo}`;

      await prisma.admission.upsert({
        where:  { id: patient.id + '-admission' },
        update: { 
          patientCondition: patient.status, 
          wardId: dbWard.id, 
          bedId: bedId 
        },
        create: {
          id:               patient.id + '-admission',
          patientId:        dbPatient.id,
          type:             'IPD',
          status:           'active',
          wardId:           dbWard.id,
          bedId:            bedId,
          patientCondition: patient.status,
          admittedAt:       getRelativeDate(patient.admissionDate),
        },
      });
    }
  }
  console.log('✅  Wards & IPD Patients seeded with relative dates.');

  // ── OT Rooms from OT JSON ─────────────────────────────────────────
  const otRoomSet = new Set<string>();
  for (const entry of otJson.entries) {
    if (!otRoomSet.has(entry.roomNo)) {
      await prisma.otRoom.upsert({
        where:  { roomNo: entry.roomNo },
        update: { type: entry.type },
        create: { roomNo: entry.roomNo, type: entry.type },
      });
      otRoomSet.add(entry.roomNo);
    }
  }
  console.log('✅  OT Rooms seeded.');

  // ── OT Cases from OT JSON ──────────────────────────────────────────
  console.log('🌱  Seeding OT Cases & Assistants...');
  await prisma.otAssistant.deleteMany({});
  await prisma.otCase.deleteMany({});

  // Find all OT admission IDs to clear referencing records first
  const otAdmissions = await prisma.admission.findMany({
    where: { type: 'OT' },
    select: { id: true },
  });
  const otAdmissionIds = otAdmissions.map((a) => a.id);

  await prisma.patientDoctor.deleteMany({
    where: { admissionId: { in: otAdmissionIds } },
  });
  await prisma.transferRequest.deleteMany({
    where: { admissionId: { in: otAdmissionIds } },
  });
  await prisma.admission.deleteMany({
    where: { id: { in: otAdmissionIds } },
  });

  for (const entry of otJson.entries) {
    const dbPatient = await prisma.patient.upsert({
      where: { id: entry.id + '-patient' },
      update: { name: entry.patientName, age: entry.patientAge, gender: entry.patientGender },
      create: {
        id: entry.id + '-patient',
        name: entry.patientName,
        age: entry.patientAge,
        gender: entry.patientGender,
      },
    });

    const dbAdmission = await prisma.admission.upsert({
      where: { id: entry.id + '-admission' },
      update: {},
      create: {
        id: entry.id + '-admission',
        patientId: dbPatient.id,
        type: 'OT',
        status: 'active',
        admittedAt: new Date(),
      },
    });

    const otRoom = await prisma.otRoom.findUnique({
      where: { roomNo: entry.roomNo },
    });

    const leadDoc = await getOrCreateDoctorByName(entry.doctor, prisma);
    const dbStatus = entry.status === 'in-progress' ? 'in_progress' : entry.status;

    const otCase = await prisma.otCase.upsert({
      where: { id: entry.id },
      update: {
        otRoomId: otRoom?.id ?? null,
        leadDoctorId: leadDoc.id,
        procedureName: entry.procedureName,
        anaesthetist: entry.anaesthetist,
        scheduledTime: entry.scheduledTime,
        estimatedDuration: entry.estimatedDuration,
        status: dbStatus as any,
        notes: entry.notes,
      },
      create: {
        id: entry.id,
        admissionId: dbAdmission.id,
        otRoomId: otRoom?.id ?? null,
        leadDoctorId: leadDoc.id,
        procedureName: entry.procedureName,
        anaesthetist: entry.anaesthetist,
        scheduledTime: entry.scheduledTime,
        estimatedDuration: entry.estimatedDuration,
        status: dbStatus as any,
        notes: entry.notes,
      },
    });

    for (const asstName of entry.assistants) {
      const asstDoc = await getOrCreateDoctorByName(asstName, prisma);
      await prisma.otAssistant.upsert({
        where: { otCaseId_doctorId: { otCaseId: otCase.id, doctorId: asstDoc.id } },
        update: {},
        create: {
          otCaseId: otCase.id,
          doctorId: asstDoc.id,
        },
      });
    }
  }
  console.log('✅  OT Cases & Assistants seeded.');

  // ── Announcements ─────────────────────────────────────────────────
  await prisma.announcement.deleteMany({});
  for (const text of opdJson.announcements) {
    await prisma.announcement.create({ data: { text, board: 'OPD' } });
  }
  for (const text of ipdJson.announcements) {
    await prisma.announcement.create({ data: { text, board: 'IPD' } });
  }
  for (const text of otJson.announcements) {
    await prisma.announcement.create({ data: { text, board: 'OT' } });
  }
  console.log('✅  Announcements seeded.');

  // ── Staff accounts ────────────────────────────────────────────────
  const staffPw = await bcrypt.hash('Staff@123', 12);
  await prisma.user.upsert({
    where:  { email: 'reception@hospital.local' },
    update: {},
    create: { email: 'reception@hospital.local', password: staffPw, name: 'Front Desk', role: 'RECEPTIONIST' },
  });
  await prisma.user.upsert({
    where:  { email: 'nurse@hospital.local' },
    update: {},
    create: { email: 'nurse@hospital.local', password: staffPw, name: 'Ward Nurse', role: 'NURSE' },
  });
  console.log('✅  Staff: reception@hospital.local / Staff@123  |  nurse@hospital.local / Staff@123');

  console.log('\n🎉  Seed complete!');
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
