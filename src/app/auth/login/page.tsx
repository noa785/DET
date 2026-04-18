// src/app/auth/login/page.tsx
export const dynamic = 'force-dynamic';
import { Metadata } from 'next';
import LoginForm from './LoginForm';

export const metadata: Metadata = {
  title: 'Sign In — DGCC Enterprise System',
};

export default function LoginPage() {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg)',
      padding: '24px',
    }}>
      <LoginForm />
    </div>
  );
}
