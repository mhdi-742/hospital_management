import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
import bcrypt from 'bcryptjs';
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

const dbUrl   = process.env.DATABASE_URL ?? 'mysql://root@localhost:3306/hospital_db';
const adapter = new PrismaMariaDb({ ...parseDbUrl(dbUrl), connectionLimit: 3 });
const prisma  = new PrismaClient({ adapter });

async function main() {
  console.log('🌱  Starting blank seed (clearing database & creating Admin user)...');

  try {
    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 0;');

    const tableNames = [
      'OtAssistant',
      'OtCase',
      'TransferRequest',
      'PatientDoctor',
      'Admission',
      'Patient',
      'OpdSession',
      'Bed',
      'Ward',
      'OtRoom',
      'Doctor',
      'Department',
      'AuditLog',
      'User',
      'Announcement',
      'HospitalSettings',
    ];

    for (const tableName of tableNames) {
      try {
        await prisma.$executeRawUnsafe(`TRUNCATE TABLE \`${tableName}\`;`);
        console.log(`  ✓ Cleared table: ${tableName}`);
      } catch (err) {
        await prisma.$executeRawUnsafe(`DELETE FROM \`${tableName}\`;`);
        console.log(`  ✓ Deleted rows from table: ${tableName}`);
      }
    }

    await prisma.$executeRawUnsafe('SET FOREIGN_KEY_CHECKS = 1;');
    console.log('✨  Database successfully cleared.');

    // ── Create Admin User ─────────────────────────────────────────────
    const adminEmail    = process.env.SEED_ADMIN_EMAIL    ?? 'admin@hospital.local';
    const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'Admin@123';
    const hashedAdmin   = await bcrypt.hash(adminPassword, 12);

    await prisma.user.create({
      data: {
        email:    adminEmail,
        password: hashedAdmin,
        name:     'Hospital Admin',
        role:     'ADMIN',
      },
    });
    console.log(`👤  Created Admin User: ${adminEmail} (Password: ${adminPassword})`);

    // ── Create Default Hospital Settings ──────────────────────────────
    await prisma.hospitalsettings.create({
      data: {
        key: 'hospitalName',
        value: 'Hospital Management System',
        updatedAt: new Date(),
      },
    });
    console.log('⚙️   Created default Hospital Settings.');

    console.log('\n🎉  Blank seed complete! Admin user is ready for login.');
  } catch (error) {
    console.error('❌ Error in blank seeder:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
