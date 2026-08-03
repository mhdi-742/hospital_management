import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import { prisma } from '@/lib/prisma';
import type { NextAuthConfig } from 'next-auth';

/* ── Demo credentials (used when DB is unavailable) ─────────────────────── */
const DEMO_USERS = [
  { id: 'demo-admin',        email: 'demo@hospital.local',      password: 'demo123',   name: 'Demo Admin',       role: 'ADMIN' },
  { id: 'demo-admin-seed',   email: 'admin@hospital.local',     password: 'Admin@123', name: 'Hospital Admin',   role: 'ADMIN' },
  { id: 'demo-reception',    email: 'reception@hospital.local', password: 'Staff@123', name: 'Front Desk',       role: 'RECEPTIONIST' },
  { id: 'demo-doctor',       email: 'doc-001@hospital.local',   password: 'Doctor@123', name: 'Dr. Priya Sharma', role: 'DOCTOR' },
];

export const authConfig: NextAuthConfig = {
  secret: process.env.NEXTAUTH_SECRET,
  pages: {
    signIn: '/login',
  },
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.id   = user.id;
        token.role = (user as any).role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id    = token.id as string;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  providers: [
    Credentials({
      name: 'credentials',
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        // Try database first
        try {
          const user = await prisma.user.findUnique({
            where: { email: credentials.email as string },
          });

          if (!user || !user.isActive) return null;

          const isValid = await bcrypt.compare(
            credentials.password as string,
            user.password
          );
          if (!isValid) return null;

          return {
            id:    user.id,
            name:  user.name,
            email: user.email,
            role:  user.role,
          } as any;
        } catch (dbError) {
          // DB unavailable — fall back to demo credentials
          console.warn('[auth] DB unavailable, checking demo credentials:', (dbError as Error).message);

          const demoUser = DEMO_USERS.find(u => u.email === credentials.email);
          if (!demoUser) return null;
          if (demoUser.password !== credentials.password) return null;

          return {
            id:    demoUser.id,
            name:  demoUser.name,
            email: demoUser.email,
            role:  demoUser.role,
          } as any;
        }
      },
    }),
  ],
};

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig);

