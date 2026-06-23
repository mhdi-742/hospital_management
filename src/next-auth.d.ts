import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id: string;
    role: 'ADMIN' | 'DOCTOR' | 'RECEPTIONIST' | 'NURSE';
  }
}
