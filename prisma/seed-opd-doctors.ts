import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
import path from 'path';
import fs from 'fs';
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

const dbUrl   = process.env.DATABASE_URL ?? 'mysql://root@127.0.0.1:3306/hospital_db';
const adapter = new PrismaMariaDb({ ...parseDbUrl(dbUrl), connectionLimit: 3 });
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Starting OPD Doctors Timetable Seeder from Flyer...');

  const dataPath = path.join(process.cwd(), 'src', 'data', 'opd_doctors.json');
  const opdDoctorsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  // Ensure hospital settings are updated
  await prisma.hospitalSettings.upsert({
    where: { key: 'hospitalName' },
    update: { value: opdDoctorsData.hospitalName },
    create: { key: 'hospitalName', value: opdDoctorsData.hospitalName },
  });

  const defaultPassword = await bcrypt.hash('Doctor@123', 12);
  let totalDocs = 0;
  let totalDepts = 0;

  for (const dept of opdDoctorsData.departments) {
    // Upsert Department
    const department = await prisma.department.upsert({
      where: { id: dept.id },
      update: {
        name: dept.name,
        color: dept.headerBg || '#3b82f6',
      },
      create: {
        id: dept.id,
        name: dept.name,
        floor: 'Ground / 1st Floor',
        color: dept.headerBg || '#3b82f6',
      },
    });
    totalDepts++;

    for (const doc of dept.doctors) {
      const email = `${doc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}@hospital.local`;

      const user = await prisma.user.upsert({
        where: { email },
        update: {
          name: doc.name,
          role: 'DOCTOR',
        },
        create: {
          email,
          password: defaultPassword,
          name: doc.name,
          role: 'DOCTOR',
        },
      });

      await prisma.doctor.upsert({
        where: { userId: user.id },
        update: {
          designation: doc.degree || 'Consultant Specialist',
          departmentId: department.id,
          speciality: dept.nameBn || dept.name,
        },
        create: {
          userId: user.id,
          designation: doc.degree || 'Consultant Specialist',
          departmentId: department.id,
          speciality: dept.nameBn || dept.name,
        },
      });
      totalDocs++;
    }
  }

  console.log(`✅ Successfully seeded ${totalDepts} departments and ${totalDocs} doctors from Bengali timetable!`);
}

main()
  .catch((e) => {
    console.error('❌ Error in OPD doctors seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
