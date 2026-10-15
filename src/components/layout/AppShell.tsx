'use client';
// src/components/layout/AppShell.tsx
// DET v2 layout: sidebar with three sections (Systems Engineering, Automation, Performance KPIs),
// plus an Admin group (Admin Log) for people allowed to see the log.
// The previous layout is kept in AppShell.legacy.tsx.

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { hasPermission, type AuthUser } from '@/types';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { SECTION_LIST, type SectionKey } from '@/lib/det/shared';
import { DetMark, Icon, ToastHost } from '@/components/det/ui';
import '@/styles/det.css';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', ADMIN: 'Admin', GOVERNANCE_ADMIN: 'Governance Admin', UNIT_MANAGER: 'Unit Manager',
  PROJECT_OWNER: 'Project Owner', EDITOR: 'Editor', VIEWER: 'Viewer', TECH_ADMIN: 'Tech Admin',
  IMPORT_VIEWER: 'Import Viewer', GOV_EDITOR: 'Governance Editor', DATA_ANALYST: 'Data Analyst',
};

export default function AppShell({ user, counts = {}, children }: {
  user: AuthUser; counts?: Partial<Record<SectionKey, number>>; children: React.ReactNode;
}) {
  const path = usePathname() ?? '';
  const router = useRouter();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [path]);

  // Hide or show the sidebar (computers); remembered on this computer
  const [hidden, setHidden] = useState(false);
  useEffect(() => { try { setHidden(localStorage.getItem('det-side-hidden') === '1'); } catch { /* storage blocked */ } }, []);
  const toggleSide = () => setHidden(h => {
    try { localStorage.setItem('det-side-hidden', h ? '0' : '1'); } catch { /* storage blocked */ }
    return !h;
  });

  // Sidebar groups open and close like dropdowns. The group you are working in always opens,
  // and the choice is remembered on this computer.
  const here = SECTION_LIST.find(s => path.startsWith(`/work/${s.slug}`))?.key ?? (path.startsWith('/admin') ? 'ADMIN' : null);
  const [groups, setGroups] = useState<Record<string, boolean>>(() => (here ? { [here]: true } : {}));
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem('det-nav-groups') || '{}') as Record<string, boolean>;
      setGroups(g => ({ ...saved, ...g }));
    } catch { /* nothing saved */ }
  }, []);
  useEffect(() => { if (here) setGroups(g => (g[here] ? g : { ...g, [here]: true })); }, [here]);
  const toggle = (k: string) => setGroups(g => {
    const next = { ...g, [k]: !g[k] };
    try { localStorage.setItem('det-nav-groups', JSON.stringify(next)); } catch { /* storage blocked */ }
    return next;
  });
  // Closed groups are skipped by the keyboard and screen readers
  const inert = useCallback((closed: boolean) => (el: HTMLDivElement | null) => { if (el) el.toggleAttribute('inert', closed); }, []);

  const sec = SECTION_LIST.find(s => path.startsWith(`/work/${s.slug}`));
  const view = path.endsWith('/grid') ? 'Grid Editor' : path.endsWith('/new') ? 'Add Order' : 'All Orders';
  const crumbs = sec ? <>{sec.name} / <b>{view}</b></> : path.startsWith('/kpis') ? <b>Performance KPIs</b>
    : path.startsWith('/admin/log') ? <>Admin / <b>Admin Log</b></> : <b>DTC Enterprise Tracker</b>;
  const canExport = hasPermission(user.role, 'orders:export');
  const canAudit = hasPermission(user.role, 'audit:view');

  async function signOut() {
    await fetch('/api/work/activity', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'LOGOUT' }) }).catch(() => null);
    await createSupabaseBrowserClient().auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }
  const initials = user.initials || user.name.split(/\s+/).map(p => p[0]).slice(0, 2).join('').toUpperCase();
  const item = (href: string, label: string, icon: string, extra?: React.ReactNode, cls = '') => (
    <Link className={`item ${cls}${path === href ? ' active' : ''}`} href={href}>
      <Icon name={icon} size={17} />{label}{extra}
    </Link>
  );

  return (
    <div className={`det-app${open ? ' nav-open' : ''}${hidden ? ' side-hidden' : ''}`}>
      <button type="button" className="side-toggle" onClick={toggleSide} aria-expanded={!hidden}
        aria-label={hidden ? 'Show menu' : 'Hide menu'} title={hidden ? 'Show menu' : 'Hide menu'}>
        <Icon name="chev" size={16} />
      </button>
      <aside className="side" aria-hidden={hidden || undefined} ref={el => { if (el) el.toggleAttribute('inert', hidden); }}>
        <div className="brand">
          <DetMark variant="dark" />
          <div><b>DTC Enterprise Tracker</b><small>English Language Institute · PNU</small></div>
        </div>
        <nav className="nav">
          {SECTION_LIST.map((s, i) => {
            const isOpen = !!groups[s.key];
            return (
              <div className={`sec group${isOpen ? ' open' : ''}`} key={s.key}>
                <button type="button" className="sec-h toggle" aria-expanded={isOpen} aria-controls={`nav-${s.slug}`} onClick={() => toggle(s.key)}>
                  <span className="num" style={{ background: s.badge }}>{i + 1}</span>
                  <span className="sec-name">{s.name}</span>
                  <span className="sec-count" aria-label={`${counts[s.key] ?? 0} orders`}>{counts[s.key] ?? 0}</span>
                  <Icon name="chev" size={15} />
                </button>
                <div className="sec-items" id={`nav-${s.slug}`} ref={inert(!isOpen)}>
                  <div><div className="inner">
                    {item(`/work/${s.slug}`, 'All Orders', 'orders', <span className="count">{counts[s.key] ?? 0}</span>)}
                    {item(`/work/${s.slug}/grid`, 'Grid Editor', 'grid')}
                    {item(`/work/${s.slug}/new`, 'Add Order', 'plus', null, 'add')}
                    {canExport && (
                      <a className="item" href={`/api/work/export?section=${s.slug}`} download title={`Download ${s.name} as an Excel file`}>
                        <Icon name="xls" size={17} />Download Excel
                      </a>
                    )}
                  </div></div>
                </div>
              </div>
            );
          })}
          <div className="sec kpi-sec">
            <Link className={`item${path.startsWith('/kpis') ? ' active' : ''}`} href="/kpis"><span className="num">3</span>Performance KPIs</Link>
          </div>
          {canAudit && (
            <div className={`sec group admin-sec${groups.ADMIN ? ' open' : ''}`}>
              <button type="button" className="sec-h toggle" aria-expanded={!!groups.ADMIN} aria-controls="nav-admin" onClick={() => toggle('ADMIN')}>
                <span className="num"><Icon name="shield" size={12} /></span>
                <span className="sec-name">Admin</span>
                <Icon name="chev" size={15} />
              </button>
              <div className="sec-items" id="nav-admin" ref={inert(!groups.ADMIN)}>
                <div><div className="inner">{item('/admin/log', 'Admin Log', 'log')}</div></div>
              </div>
            </div>
          )}
        </nav>
        <div className="me">
          <div className="avatar">{initials}</div>
          <div><b>{user.name}</b><small>{ROLE_LABEL[user.role] ?? user.role}</small></div>
          <button className="out" onClick={signOut} title="Sign out" aria-label="Sign out" style={{ border: 'none', background: 'none', cursor: 'pointer' }}>
            <Icon name="out" size={17} />
          </button>
        </div>
      </aside>
      <div className="scrim" onClick={() => setOpen(false)} />
      <div className="wm" aria-hidden="true" />

      <div className="main">
        <header className="top">
          <button className="burger" onClick={() => setOpen(o => !o)} aria-label="Menu"><Icon name="menu" size={18} /></button>
          <div className="crumbs">{crumbs}</div>
        </header>
        <main className="page" key={path}>{children}</main>
        <footer className="foot">
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
            <img src="/brand/pnu-logo.svg" alt="PNU" width={26} height={26} />
            DTC Enterprise Tracker · Digital Transformation Committee · ELI · PNU
          </span>
          <span>Designed &amp; developed by <b>Nora Aldossari</b> · 2026</span>
        </footer>
      </div>
      <ToastHost />
    </div>
  );
}
