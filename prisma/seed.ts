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

async function main() {
  console.log('🌱  Starting seed...');

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
          status:        doc.status,
          currentToken:  doc.currentToken ?? null,
          totalTokens:   doc.totalTokens,
          avgWaitMinutes: doc.avgWaitMinutes,
        },
      });

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

      await prisma.admission.upsert({
        where:  { id: patient.id + '-admission' },
        update: { patientCondition: patient.status, wardId: dbWard.id, bedNo: patient.bedNo },
        create: {
          id:               patient.id + '-admission',
          patientId:        dbPatient.id,
          type:             'IPD',
          status:           'active',
          wardId:           dbWard.id,
          bedNo:            patient.bedNo,
          patientCondition: patient.status,
          admittedAt:       new Date(patient.admissionDate),
        },
      });
    }
  }
  console.log('✅  Wards & IPD Patients seeded.');

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

  // ── Announcements ─────────────────────────────────────────────────
  // Clear existing first to avoid duplicates on re-seed
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
