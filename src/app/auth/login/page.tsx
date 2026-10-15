// src/app/auth/login/page.tsx
export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = { title: 'Sign in | Digital Enterprise Tracker' };

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#062E2C' }} />}>
      <LoginForm />
    </Suspense>
  );
}
