// src/app/auth/login/page.tsx
export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { Metadata } from 'next';
import LoginForm from './LoginForm';
import { getT } from '@/lib/i18n/server';

export function generateMetadata(): Metadata {
  const t = getT();
  return { title: t('Sign in | Digital Enterprise Tracker') };
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: '100vh', background: '#062E2C' }} />}>
      <LoginForm />
    </Suspense>
  );
}
