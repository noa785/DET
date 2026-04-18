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
      background: 'var(--bg)',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Left panel — institutional branding */}
      <div style={{
        width: '42%',
        background: 'var(--accent)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '48px 52px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Geometric background */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.06,
          backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />
        <div style={{
          position: 'absolute', bottom: -100, right: -100,
          width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(255,255,255,0.05)',
        }} />
        <div style={{
          position: 'absolute', top: -60, left: -60,
          width: 250, height: 250, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />

        {/* Logo */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{
            width: 44, height: 44, borderRadius: 10,
            background: 'rgba(255,255,255,0.15)',
            border: '1px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 14, color: '#fff',
            marginBottom: 48,
          }}>DG</div>

          <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, margin: '0 0 16px' }}>
            Digital Governance<br />& Compliance<br />Committee
          </h1>
          <p style={{ fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 1.6, margin: 0 }}>
            Enterprise Tracker System for project governance, digital transformation, and compliance management.
          </p>
        </div>

        {/* Stats */}
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 32 }}>
            {[
              { label: 'Active Orders', value: '50+' },
              { label: 'Governance Items', value: '12+' },
              { label: 'Team Members', value: '7' },
              { label: 'Units Tracked', value: '8' },
            ].map(s => (
              <div key={s.label} style={{
                padding: '14px 16px', borderRadius: 10,
                background: 'rgba(255,255,255,0.08)',
                border: '1px solid rgba(255,255,255,0.12)',
              }}>
                <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.02em' }}>{s.value}</div>
                <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', marginTop: 3, fontWeight: 500 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.4)', margin: 0 }}>
            Princess Nourah bint Abdulrahman University<br />
            © 2025 DGCC · All rights reserved
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '48px 64px',
        background: 'var(--bg)',
      }}>
        <LoginForm />
      </div>
    </div>
  );
}
