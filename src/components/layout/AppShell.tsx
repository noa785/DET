// src/components/layout/AppShell.tsx
'use client';

import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import type { AuthUser } from '@/types';
import { can } from '@/lib/auth/permissions';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import NotificationBell from '@/components/NotificationBell';
import { useRouter } from 'next/navigation';

// ── SVG Icons ─────────────────────────────────────────────────
const Icons = {
  dashboard:    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>,
  orders:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  upcoming:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>,
  grid:         <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M3 15h18M9 3v18M15 3v18"/></svg>,
  projects:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  governance:   <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>,
  govtasks:     <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>,
  briefs:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  audit:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/></svg>,
  reports:      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  units:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>,
  users:        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>,
  import:       <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7,10 12,15 17,10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>,
  sun:          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>,
  moon:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/></svg>,
  logout:       <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16,17 21,12 16,7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>,
  chevronLeft:  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15,18 9,12 15,6"/></svg>,
  chevronRight: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9,18 15,12 9,6"/></svg>,
  plus:         <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
};

// ── Nav ────────────────────────────────────────────────────────
const NAV = [
  {
    group: 'Overview',
    items: [
      { href: '/dashboard', icon: Icons.dashboard, label: 'Dashboard' },
    ],
  },
  {
    group: 'Work Tracker',
    items: [
      { href: '/orders',          icon: Icons.orders,   label: 'All Orders' },
      { href: '/upcoming-orders', icon: Icons.upcoming, label: 'Upcoming Orders' },
      { href: '/orders/grid',     icon: Icons.grid,     label: 'Grid Editor', badge: 'LIVE' },
      { href: '/projects',        icon: Icons.projects, label: 'Projects' },
    ],
  },
  {
    group: 'Governance',
    items: [
      { href: '/governance/review', icon: Icons.governance, label: 'Gov. Review Dashboard', perm: 'governance:view' as const },
      { href: '/gov-tasks',         icon: Icons.govtasks,   label: 'Governance Tasks' },
    ],
  },
  {
    group: 'Reports',
    items: [
      { href: '/weekly-briefs', icon: Icons.briefs,  label: 'Order Descriptions' },
      { href: '/audit-log',     icon: Icons.audit,   label: 'Audit Log', perm: 'audit:view' as const },
      { href: '/reports',       icon: Icons.reports, label: 'Reports Center' },
    ],
  },
  {
    group: 'Administration',
    items: [
      { href: '/units',         icon: Icons.units,  label: 'Units',           perm: 'admin:units' as const },
      { href: '/admin/users',   icon: Icons.users,  label: 'Users & Roles',   perm: 'admin:users' as const },
      { href: '/import-export', icon: Icons.import, label: 'Import / Export', perm: 'import:execute' as const },
    ],
  },
];

const ROLE_COLOR: Record<string, string> = {
  SUPER_ADMIN: '#dc2626', TECH_ADMIN: '#dc2626', ADMIN: '#d97706',
  GOVERNANCE_ADMIN: '#7c3aed', UNIT_MANAGER: '#2563eb', PROJECT_OWNER: '#0891b2',
  EDITOR: '#059669', IMPORT_VIEWER: '#ea580c', GOV_EDITOR: '#7c3aed',
  DATA_ANALYST: '#0284c7', VIEWER: '#6b7280',
};
const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin', TECH_ADMIN: 'Tech Admin', ADMIN: 'Admin',
  GOVERNANCE_ADMIN: 'Gov. Admin', UNIT_MANAGER: 'Unit Manager', PROJECT_OWNER: 'Project Owner',
  EDITOR: 'Editor', IMPORT_VIEWER: 'Read + Import', GOV_EDITOR: 'Gov. Editor',
  DATA_ANALYST: 'Data Analyst', VIEWER: 'Viewer',
};

function useTheme() {
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  useEffect(() => {
    const stored = localStorage.getItem('pes-theme') as 'dark' | 'light' | null;
    const initial = stored ?? 'light';
    setTheme(initial);
    document.documentElement.setAttribute('data-theme', initial);
  }, []);
  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('pes-theme', next);
  }
  return { theme, toggle };
}

export default function AppShell({ user, children }: { user: AuthUser; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const { theme, toggle: toggleTheme } = useTheme();
  const supabase = createSupabaseBrowserClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push('/auth/login');
    router.refresh();
  }

  const initials = user.initials ?? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const roleColor = ROLE_COLOR[user.role] ?? '#6b7280';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)' }}>

      {/* ── SIDEBAR ─────────────────────────────────────────── */}
      <aside style={{
        position: 'fixed', left: 0, top: 0, bottom: 0, zIndex: 50,
        width: sidebarOpen ? '240px' : '52px',
        display: 'flex', flexDirection: 'column',
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        transition: 'width 0.2s ease',
        boxShadow: '1px 0 0 var(--border)',
      }}>

        {/* Logo */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 14px', height: 56,
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: 6, flexShrink: 0,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 800, fontSize: 10, color: '#fff',
            letterSpacing: '0.02em',
          }}>DG</div>
          {sidebarOpen && (
            <div style={{ flex: 1, overflow: 'hidden' }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.01em', whiteSpace: 'nowrap' }}>DGCC Enterprise</div>
              <div style={{ fontSize: 9.5, color: 'var(--text-3)', letterSpacing: '0.1em', textTransform: 'uppercase', marginTop: 1 }}>Digital Governance</div>
            </div>
          )}
          <button onClick={() => setSidebarOpen(o => !o)} style={{
            marginLeft: 'auto', flexShrink: 0, width: 22, height: 22,
            borderRadius: 4, border: '1px solid var(--border)',
            background: 'transparent', color: 'var(--text-3)',
            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}>
            {sidebarOpen ? Icons.chevronLeft : Icons.chevronRight}
          </button>
        </div>

        {/* User */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 9,
          padding: '10px 12px', borderBottom: '1px solid var(--border)', flexShrink: 0,
        }}>
          <div style={{
            width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
            background: roleColor + '15', border: `1.5px solid ${roleColor}40`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9.5, fontWeight: 700, color: roleColor,
          }}>{initials}</div>
          {sidebarOpen && (
            <div style={{ overflow: 'hidden', flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</div>
              <div style={{ fontSize: 10, color: roleColor, fontWeight: 500, marginTop: 1 }}>{ROLE_LABEL[user.role] ?? user.role}</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '6px 6px 0', scrollbarWidth: 'none' }}>
          {NAV.map(group => (
            <div key={group.group} style={{ marginBottom: 2 }}>
              {sidebarOpen && (
                <div style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: '0.12em',
                  textTransform: 'uppercase', color: 'var(--text-3)',
                  padding: '10px 8px 4px',
                }}>
                  {group.group}
                </div>
              )}
              {!sidebarOpen && group !== NAV[0] && (
                <div style={{ height: 1, background: 'var(--border)', margin: '5px 6px' }} />
              )}
              {group.items.map((item: any) => {
                if (item.perm && !can(user, item.perm)) return null;
                const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                return (
                  <Link key={item.href} href={item.href}
                    title={!sidebarOpen ? item.label : undefined}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 9,
                      padding: '6.5px 8px', borderRadius: 5, fontSize: 12.5,
                      fontWeight: isActive ? 600 : 400,
                      color: isActive ? 'var(--accent)' : 'var(--text-2)',
                      background: isActive ? `rgba(var(--accent-rgb), 0.08)` : 'transparent',
                      marginBottom: 1, textDecoration: 'none',
                      transition: 'all 0.1s',
                      justifyContent: sidebarOpen ? 'flex-start' : 'center',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; }}
                    onMouseLeave={e => { if (!isActive) { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; } }}
                  >
                    <span style={{ flexShrink: 0, opacity: isActive ? 1 : 0.65, display: 'flex' }}>{item.icon}</span>
                    {sidebarOpen && (
                      <>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.label}</span>
                        {item.badge && (
                          <span style={{
                            fontSize: 8.5, padding: '1px 5px', borderRadius: 99,
                            background: 'rgba(16,185,129,0.12)', color: '#10b981',
                            fontWeight: 700, letterSpacing: '0.04em', border: '1px solid rgba(16,185,129,0.2)',
                          }}>{item.badge}</span>
                        )}
                      </>
                    )}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        {/* Bottom */}
        <div style={{ padding: '6px 6px 8px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
          <button onClick={toggleTheme} title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '6.5px 8px',
              borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 12.5, width: '100%', transition: 'all 0.1s',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}>
            <span style={{ display: 'flex', flexShrink: 0 }}>{theme === 'dark' ? Icons.sun : Icons.moon}</span>
            {sidebarOpen && <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
          </button>
          <button onClick={handleLogout} title={!sidebarOpen ? 'Sign Out' : undefined}
            style={{
              display: 'flex', alignItems: 'center', gap: 9, padding: '6.5px 8px',
              borderRadius: 5, background: 'transparent', border: 'none', cursor: 'pointer',
              color: 'var(--text-3)', fontSize: 12.5, width: '100%', transition: 'all 0.1s',
              justifyContent: sidebarOpen ? 'flex-start' : 'center',
            }}>
            <span style={{ display: 'flex', flexShrink: 0 }}>{Icons.logout}</span>
            {sidebarOpen && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── MAIN ─────────────────────────────────────────────── */}
      <main style={{
        flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh',
        marginLeft: sidebarOpen ? '240px' : '52px',
        transition: 'margin-left 0.2s ease',
      }}>
        {/* Topbar */}
        <header style={{
          position: 'sticky', top: 0, zIndex: 40, height: 52,
          background: 'var(--surface)', borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', padding: '0 20px', gap: 12,
        }}>
          <Breadcrumb pathname={pathname} />
          <div style={{ flex: 1 }} />
          <NotificationBell />
          <Link href="/orders/new">
            <button style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '6px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600,
              background: 'var(--accent)', color: '#fff', border: 'none', cursor: 'pointer',
              transition: 'all 0.15s',
            }}>
              {Icons.plus} New Order
            </button>
          </Link>
        </header>

        {/* Content */}
        <div style={{ flex: 1, padding: '24px 28px' }}>
          {children}
        </div>
      </main>
    </div>
  );
}

function Breadcrumb({ pathname }: { pathname: string }) {
  const LABELS: Record<string, string> = {
    '/dashboard': 'Dashboard', '/orders': 'All Orders', '/orders/grid': 'Grid Editor',
    '/orders/new': 'New Order', '/upcoming-orders': 'Upcoming Orders', '/projects': 'Projects',
    '/governance/review': 'Gov. Review Dashboard', '/governance/new': 'New Governance Item',
    '/gov-tasks': 'Governance Tasks', '/gov-tasks/new': 'New Gov. Task',
    '/weekly-briefs': 'Order Descriptions', '/audit-log': 'Audit Log',
    '/units': 'Units', '/admin/users': 'Users & Roles',
    '/import-export': 'Import / Export', '/reports': 'Reports Center',
  };
  if (LABELS[pathname]) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
        <span style={{ color: 'var(--text-3)', fontWeight: 500, letterSpacing: '0.02em' }}>DGCC</span>
        <span style={{ color: 'var(--border-2)', fontSize: 10 }}>›</span>
        <span style={{ color: 'var(--text)', fontWeight: 600 }}>{LABELS[pathname]}</span>
      </div>
    );
  }
  const segments = pathname.split('/').filter(Boolean);
  let section = '', detail = '';
  if (segments[0] === 'orders' && segments.length >= 2) { section = 'All Orders'; detail = segments[2] === 'edit' ? 'Edit Order' : 'Order Detail'; }
  else if (segments[0] === 'governance' && segments.length >= 2) { section = 'Governance'; detail = segments[2] === 'edit' ? 'Edit Item' : 'Governance Item'; }
  else if (segments[0] === 'gov-tasks' && segments.length >= 2) { section = 'Gov. Tasks'; detail = 'Task Detail'; }
  else { detail = segments[segments.length - 1]?.replace(/-/g, ' ') ?? 'Page'; }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
      <span style={{ color: 'var(--text-3)', fontWeight: 500 }}>DGCC</span>
      {section && <><span style={{ color: 'var(--border-2)', fontSize: 10 }}>›</span><span style={{ color: 'var(--text-3)' }}>{section}</span></>}
      <span style={{ color: 'var(--border-2)', fontSize: 10 }}>›</span>
      <span style={{ color: 'var(--text)', fontWeight: 600, textTransform: 'capitalize' }}>{detail}</span>
    </div>
  );
}
