import { PrismaClient } from '@prisma/client';
import { PrismaMariaDb } from '@prisma/adapter-mariadb';

function parseDbUrl(url: string) {
  try {
    const u = new URL(url);
    return {
      host:     u.hostname || 'localhost',
      port:     u.port ? parseInt(u.port, 10) : 3306,
      user:     u.username || 'root',
      password: u.password || undefined,
      database: u.pathname.replace(/^\//, '') || 'hospital_db',
    };
  } catch {
    // Regex fallback if URL constructor fails due to unencoded special characters
    const match = url.match(/mysql:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:\/\?]+)(?::(\d+))?\/(.+)/);
    if (match) {
      return {
        user:     match[1] || 'root',
        password: match[2] || undefined,
        host:     match[3] || 'localhost',
        port:     match[4] ? parseInt(match[4], 10) : 3306,
        database: match[5]?.split('?')[0] || 'hospital_db',
      };
    }
    return {
      host:     'localhost',
      port:     3306,
      user:     'root',
      password: undefined,
      database: 'hospital_db',
    };
  }
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrismaClient() {
  try {
    const dbUrl = process.env.DATABASE_URL ?? 'mysql://root@localhost:3306/hospital_db';
    const config = parseDbUrl(dbUrl);
    const adapter = new PrismaMariaDb({
      ...config,
      connectionLimit: 5,
    });
    return new PrismaClient({
      adapter,
      log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
  } catch (err) {
    console.warn('[prisma] Error initializing Prisma client adapter:', (err as Error).message);
    // Return standard PrismaClient without custom adapter as emergency fallback
    return new PrismaClient({
      log: ['error'],
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

