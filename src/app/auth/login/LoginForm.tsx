'use client';
// src/app/auth/login/LoginForm.tsx
// DET v2 welcome screen + sign in (email and password, Supabase).

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { DetMark } from '@/components/det/ui';
import '@/styles/det.css';

const TITLE = 'Digital Enterprise Tracker';

export default function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const redirectTo = params.get('redirect') || '/kpis';

  const [stage, setStage] = useState<'welcome' | 'login'>(params.get('redirect') ? 'login' : 'welcome');
  const [gone, setGone] = useState(stage === 'login');
  const [center, setCenter] = useState({ x: '50%', y: '70%' });
  const [shine, setShine] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [errKey, setErrKey] = useState(0);
  const [loading, setLoading] = useState(false);

  const netRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);

  // Title shine after the letters have arrived
  useEffect(() => { const t = setTimeout(() => setShine(true), 3200); return () => clearTimeout(t); }, []);

  // Calm moving network behind the welcome screen
  useEffect(() => {
    if (gone) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const canvas = netRef.current; if (!canvas || reduce) return;
    const ctx = canvas.getContext('2d'); if (!ctx) return;
    let W = 0, H = 0, dpr = 1, raf = 0;
    let pts: { x: number; y: number; vx: number; vy: number; r: number }[] = [];
    const size = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = canvas.width = window.innerWidth * dpr; H = canvas.height = window.innerHeight * dpr;
      canvas.style.width = `${window.innerWidth}px`; canvas.style.height = `${window.innerHeight}px`;
      const n = Math.round(Math.min(90, (window.innerWidth * window.innerHeight) / 16000));
      pts = Array.from({ length: n }, () => ({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.25 * dpr, vy: (Math.random() - 0.5) * 0.25 * dpr, r: (Math.random() * 1.4 + 0.6) * dpr }));
    };
    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const link = 130 * dpr;
      for (const p of pts) { p.x += p.vx; p.y += p.vy; if (p.x < 0 || p.x > W) p.vx *= -1; if (p.y < 0 || p.y > H) p.vy *= -1; }
      for (let i = 0; i < pts.length; i++) {
        const a = pts[i];
        for (let j = i + 1; j < pts.length; j++) {
          const b = pts[j], d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < link) { ctx.strokeStyle = `rgba(95,209,201,${(1 - d / link) * 0.16})`; ctx.lineWidth = dpr * 0.7; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
        }
        ctx.fillStyle = 'rgba(180,240,235,.55)'; ctx.beginPath(); ctx.arc(a.x, a.y, a.r, 0, 7); ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };
    size(); draw();
    window.addEventListener('resize', size);
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', size); };
  }, [gone]);

  // Login card tilts slightly with the pointer
  useEffect(() => {
    if (stage !== 'login') return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) return;
    const move = (e: PointerEvent) => {
      const card = cardRef.current; if (!card) return;
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--gx', `${px * 100}%`); card.style.setProperty('--gy', `${py * 100}%`);
      const inside = px > -0.3 && px < 1.3 && py > -0.3 && py < 1.3;
      card.style.transform = inside ? `rotateY(${(px - 0.5) * 6}deg) rotateX(${(0.5 - py) * 6}deg)` : '';
    };
    window.addEventListener('pointermove', move);
    return () => window.removeEventListener('pointermove', move);
  }, [stage]);

  const toLogin = useCallback((el?: HTMLElement | null) => {
    if (el) { const r = el.getBoundingClientRect(); setCenter({ x: `${r.left + r.width / 2}px`, y: `${r.top + r.height / 2}px` }); }
    setStage('login');
    setTimeout(() => { setGone(true); emailRef.current?.focus(); }, 900);
  }, []);
  const toWelcome = () => { setGone(false); setStage('welcome'); if (cardRef.current) cardRef.current.style.transform = ''; };

  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Enter' && stage === 'welcome') toLogin(); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [stage, toLogin]);

  function fail(m: string) { setError(m); setErrKey(k => k + 1); }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    const em = email.trim().toLowerCase();
    if (!em || !password) return fail('Please enter your email and password.');
    if (!/^\S+@\S+\.\S+$/.test(em)) return fail('Please enter a valid email address.');
    setLoading(true);
    const { error: authError } = await createSupabaseBrowserClient().auth.signInWithPassword({ email: em, password });
    if (authError) { setLoading(false); return fail('Invalid email or password.'); }
    // Record the sign-in in the Admin Log (never blocks signing in)
    await fetch('/api/work/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'LOGIN' }) }).catch(() => null);
    router.push(redirectTo);
    router.refresh();
  }

  let k = 0;
  const words = TITLE.split(' ');

  return (
    <div className="det-login">
      {/* 1) Welcome */}
      <section id="welcome" className={`screen${gone ? ' gone' : ''}`} aria-hidden={stage !== 'welcome'}>
        <canvas id="net" ref={netRef} />
        <div className="wmark" aria-hidden="true" /><div className="wmark l" aria-hidden="true" />
        <div className="corner fade" style={{ animationDelay: '.3s' }}>
          <img src="/brand/pnu-logo-white.svg" alt="Princess Nourah bint Abdulrahman University" />
          <div className="corner-t">
            <span className="c-uni">Princess Nourah bint Abdulrahman University</span>
            <span className="c-eli">English Language Institute</span>
          </div>
        </div>
        <div className="welcome-inner">
          <div className="emblem">
            <div className="rings" aria-hidden="true">
              <span className="ripple" /><span className="ripple" /><span className="ripple" />
              <span className="orbit o1"><i /></span><span className="orbit o2"><i /><i /></span>
            </div>
            <div className="emblem-core"><DetMark variant="dark" /></div>
          </div>
          <p className="eyebrow fade" style={{ animationDelay: '1.6s' }}>Welcome to</p>
          <h1 className={`title${shine ? ' shine' : ''}`} aria-label={TITLE}>
            {words.map((w, wi) => (
              <span key={wi}>
                <span className="w" aria-hidden="true">
                  {[...w].map((c, ci) => <span key={ci} className="ch" style={{ animationDelay: `${1.8 + k++ * 0.035}s` }}>{c}</span>)}
                </span>{wi < words.length - 1 ? ' ' : ''}
              </span>
            ))}
          </h1>
          <button className="cta fade" style={{ animationDelay: '2.9s' }} onClick={e => toLogin(e.currentTarget)}>
            Enter the system
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
          </button>
        </div>
        <p className="foot fade" style={{ animationDelay: '3.2s' }}>Digital Transformation Committee · ELI · PNU</p>
      </section>

      {/* 2) Sign in */}
      <section id="login" className={`screen${stage === 'login' ? ' open' : ''}`} aria-hidden={stage !== 'login'}
        style={{ ['--cx' as string]: center.x, ['--cy' as string]: center.y }}>
        <div className="aurora"><i /><i /><i /></div>
        <div className="grid-bg" />
        <div className="wmark" aria-hidden="true" />
        <button className="back" type="button" onClick={toWelcome}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
          Back
        </button>
        <div className="login-wrap">
          <div className="head stagger s1">
            <div className="head-logo"><DetMark variant="light" /></div>
            <p className="ar pnu-line"><img src="/brand/pnu-logo.svg" alt="PNU" />معهد اللغة الإنجليزية · جامعة الأميرة نورة بنت عبدالرحمن</p>
            <p className="en">English Language Institute · PNU</p>
          </div>
          <div className="card stagger s2" ref={cardRef}>
            <div className="card-in">
              <div className="glare" />
              <h1>Sign in</h1>
              <p className="sub">to <b>Digital Enterprise Tracker</b></p>
              {error && (
                <div className="error show" role="alert" key={errKey}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" /></svg>
                  <span>{error}</span>
                </div>
              )}
              <form onSubmit={submit} noValidate>
                <div className="field">
                  <input ref={emailRef} type="email" id="email" placeholder=" " autoComplete="email" value={email} onChange={e => setEmail(e.target.value)} />
                  <label htmlFor="email">Email address</label>
                  <svg className="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M22 7l-10 6L2 7" /></svg>
                </div>
                <div className="field">
                  <input type={showPw ? 'text' : 'password'} id="password" placeholder=" " autoComplete="current-password" value={password} onChange={e => setPassword(e.target.value)} />
                  <label htmlFor="password">Password</label>
                  <svg className="ic" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="11" width="16" height="10" rx="2.5" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                  <button type="button" className="toggle-pw" onClick={() => setShowPw(s => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      {showPw
                        ? <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19M1 1l22 22" />
                        : <><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></>}
                    </svg>
                  </button>
                </div>
                <button type="submit" className={`submit${loading ? ' loading' : ''}`} disabled={loading}>
                  <span className="label">Sign in</span><span className="spinner" />
                </button>
              </form>
              <p className="secure">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>
                Secure institutional access
              </p>
            </div>
          </div>
          <p className="credit stagger s3">
            Designed &amp; developed by <b>Nora Aldossari</b><br />
            Digital Transformation Committee · ELI · PNU · 2026
          </p>
        </div>
      </section>
    </div>
  );
}
