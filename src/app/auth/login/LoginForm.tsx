'use client';
import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const supabase = createSupabaseBrowserClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    if (authError) {
      setError('Invalid credentials. Please verify your email and password.');
      setLoading(false);
      return;
    }
    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div style={{ width: '100%', maxWidth: 420 }}>

      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{
          width: 52, height: 52, borderRadius: 12,
          background: 'var(--accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 800, fontSize: 16, color: '#fff',
          margin: '0 auto 16px',
          boxShadow: '0 4px 24px rgba(var(--accent-rgb), 0.3)',
        }}>DG</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: '0 0 4px' }}>
          DGCC Enterprise System
        </h1>
        <p style={{ fontSize: 12.5, color: 'var(--text-3)', letterSpacing: '0.02em' }}>
          Digital Governance & Compliance Committee
        </p>
      </div>

      {/* Card */}
      <div style={{
        background: 'var(--surface)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '32px 32px 28px',
        boxShadow: '0 4px 32px rgba(0,0,0,0.08)',
      }}>
        <div style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', margin: '0 0 4px', letterSpacing: '-0.01em' }}>
            Sign In
          </h2>
          <p style={{ fontSize: 12.5, color: 'var(--text-3)', margin: 0 }}>
            Authorized personnel only — institutional access
          </p>
        </div>

        {error && (
          <div style={{
            marginBottom: 18, padding: '10px 14px',
            background: 'rgba(220,38,38,0.06)',
            border: '1px solid rgba(220,38,38,0.2)',
            borderRadius: 8, fontSize: 12.5, color: '#dc2626',
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
              Email Address
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@dgcc.edu.sa"
              required
              autoComplete="email"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 13.5, outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 6 }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••"
              required
              autoComplete="current-password"
              style={{
                width: '100%', padding: '10px 14px', borderRadius: 8,
                border: '1px solid var(--border)', background: 'var(--surface-2)',
                color: 'var(--text)', fontSize: 13.5, outline: 'none',
                boxSizing: 'border-box', transition: 'border-color 0.15s',
              }}
              onFocus={e => (e.target.style.borderColor = 'var(--accent)')}
              onBlur={e => (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px',
              borderRadius: 8, border: 'none',
              background: loading ? 'var(--border-2)' : 'var(--accent)',
              color: '#fff', fontSize: 13.5, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s', letterSpacing: '0.01em',
            }}
          >
            {loading ? 'Authenticating…' : 'Sign In'}
          </button>
        </form>
      </div>

      {/* Footer */}
      <p style={{ textAlign: 'center', fontSize: 11.5, color: 'var(--text-3)', marginTop: 20 }}>
        Princess Nourah bint Abdulrahman University<br />
        <span style={{ opacity: 0.6 }}>© 2025 DGCC · All rights reserved</span>
      </p>
    </div>
  );
}
