'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import styles from './login.module.css';

const ROLE_PORTALS: Record<string, string> = {
  ADMIN:        '/portal/admin',
  DOCTOR:       '/portal/doctor',
  RECEPTIONIST: '/portal/admission',
  NURSE:        '/portal/admission',
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (result?.error) {
      setError('Invalid credentials or account deactivated.');
      return;
    }

    // Fetch session to get role then redirect
    const res = await fetch('/api/auth/session');
    const session = await res.json();
    const role = session?.user?.role ?? '';
    const dest = ROLE_PORTALS[role] ?? '/';
    router.push(dest);
  }

  return (
    <main className={styles.main}>
      {/* Background glows */}
      <div className={styles.glow1} />
      <div className={styles.glow2} />

      <div className={styles.card}>
        {/* Hospital branding */}
        <div className={styles.brand}>
          <div className={styles.logoRing}>
            <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" width="28" height="28">
              <rect x="17" y="5" width="6" height="30" rx="3" fill="white"/>
              <rect x="5" y="17" width="30" height="6" rx="3" fill="white"/>
            </svg>
          </div>
          <div>
            <h1 className={styles.hospitalName}>Mikki Megha Hospital</h1>
            <p className={styles.tagline}>Staff Portal</p>
          </div>
        </div>

        <h2 className={styles.heading}>Sign in to your account</h2>
        <p className={styles.subheading}>
          Use your assigned credentials to access the portal.
        </p>

        <form onSubmit={handleSubmit} className={styles.form} noValidate>
          <div className={styles.field}>
            <label htmlFor="email" className={styles.label}>Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@hospital.local"
              className={styles.input}
              required
            />
          </div>

          <div className={styles.field}>
            <label htmlFor="password" className={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              className={styles.input}
              required
            />
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="8" cy="8" r="7" stroke="#f87171" strokeWidth="1.5"/>
                <path d="M8 5v3.5M8 11h.01" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              {error}
            </div>
          )}

          <button type="submit" className={styles.btn} disabled={loading}>
            {loading ? (
              <span className={styles.spinner} />
            ) : (
              'Sign in'
            )}
          </button>
        </form>

        <p className={styles.helpText}>
          Contact your administrator if you need access or a password reset.
        </p>
      </div>
    </main>
  );
}
