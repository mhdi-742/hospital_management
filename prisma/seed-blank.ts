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
  console.log('🌱  Ensuring Admin user & Departments exist (SAFE: No table truncation)...');

  try {
    // ── Upsert Admin User (Safe - does not touch existing data) ──────
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

    // ── Upsert Hospital Settings (Safe) ──────────────────────────────
    await prisma.hospitalSettings.upsert({
      where: { key: 'hospitalName' },
      update: {},
      create: {
        key: 'hospitalName',
        value: 'Hospital Management System',
      },
    });

    // ── Upsert Departments (Safe) ────────────────────────────────────
    const departments = [
      { name: 'Derma', floor: 'Floor 1', color: '#ec4899' },
      { name: 'Surgeon', floor: 'Floor 2', color: '#ef4444' },
      { name: 'Child Specialist', floor: 'Floor 1', color: '#3b82f6' },
      { name: 'Gynocologist', floor: 'Floor 2', color: '#8b5cf6' },
      { name: 'Orthopedic', floor: 'Floor 3', color: '#f59e0b' },
      { name: 'ENT', floor: 'Floor 1', color: '#10b981' },
      { name: 'Physician', floor: 'Ground Floor', color: '#06b6d4' },
      { name: 'Cardiologist', floor: 'Floor 2', color: '#6366f1' },
      { name: 'Neurologist', floor: 'Floor 3', color: '#14b8a6' },
      { name: 'Neurosurgeon', floor: 'Floor 3', color: '#f97316' },
    ];

    for (const dept of departments) {
      const existing = await prisma.department.findFirst({ where: { name: dept.name } });
      if (!existing) {
        await prisma.department.create({ data: dept });
      }
    }

    console.log('✅  Departments and Admin user updated safely without wiping data.');
  } catch (error) {
    console.error('❌ Error updating database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
