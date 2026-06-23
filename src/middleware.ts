/**
 * Edge-compatible middleware — does NOT import Prisma or any Node.js modules.
 * Uses NextAuth's built-in JWT verification from the existing auth secret.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

const PROTECTED_ROUTES: Record<string, string[]> = {
  '/portal/admin':     ['ADMIN'],
  '/portal/doctor':    ['DOCTOR'],
  '/portal/admission': ['RECEPTIONIST', 'NURSE', 'ADMIN'],
};

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Find if this route needs protection
  const protectedPrefix = Object.keys(PROTECTED_ROUTES).find(prefix =>
    pathname.startsWith(prefix)
  );

  if (!protectedPrefix) return NextResponse.next();

  const token = await getToken({
    req,
    secret: process.env.NEXTAUTH_SECRET,
  });

  // Not authenticated → redirect to login
  if (!token) {
    const loginUrl = req.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  const allowedRoles = PROTECTED_ROUTES[protectedPrefix];
  const userRole = token.role as string;

  if (!allowedRoles.includes(userRole)) {
    // Authenticated but wrong role → redirect to their own portal
    const rolePortal: Record<string, string> = {
      ADMIN:        '/portal/admin',
      DOCTOR:       '/portal/doctor',
      RECEPTIONIST: '/portal/admission',
      NURSE:        '/portal/admission',
    };
    const dest = rolePortal[userRole] ?? '/login';
    const destUrl = req.nextUrl.clone();
    destUrl.pathname = dest;
    return NextResponse.redirect(destUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*'],
};
