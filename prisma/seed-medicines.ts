import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';
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
  console.log('🌱 Starting Investigation / Medicine Seeder...');

  const dataPath = path.join(process.cwd(), 'src', 'data', 'investigations.json');
  const investigationsData = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));

  let count = 0;
  for (const item of investigationsData) {
    await prisma.investigationTest.upsert({
      where: { name: item.name },
      update: {
        code: item.code,
        amount: item.amount,
        reportTime: item.reportTime,
        category: item.category,
        isActive: true,
      },
      create: {
        code: item.code,
        name: item.name,
        amount: item.amount,
        reportTime: item.reportTime,
        category: item.category,
        isActive: true,
      },
    });
    count++;
  }

  console.log(`✅ Successfully seeded ${count} investigation & diagnostic tests into the database!`);
}

main()
  .catch((e) => {
    console.error('❌ Error in medicine seeder:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
