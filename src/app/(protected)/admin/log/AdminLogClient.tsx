'use client';
// Admin Log: every recorded action, newest first, with filters and an Excel download.

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { SECTIONS, SECTION_LIST, fdate } from '@/lib/det/shared';
import { Icon, PageHeader, Person, api } from '@/components/det/ui';
import type { LogRow } from '@/lib/det/adminlog';

type Overview = { today: number; last7: number; signIns: number; active: number; people: string[] };
type Page = { rows: LogRow[]; total: number; page: number; pages: number };
type F = { person: string; action: string; section: string; from: string; to: string; q: string };
const EMPTY: F = { person: '', action: '', section: '', from: '', to: '', q: '' };

const ACTIONS: [string, string, string][] = [
  ['CREATE', 'Created', '#1E9E6A'], ['UPDATE', 'Updated', '#158B87'], ['STATUS_CHANGE', 'Status changed', '#158B87'],
  ['DELETE', 'Deleted', '#CC3D33'], ['LOGIN', 'Signed in', '#2F74C0'], ['LOGOUT', 'Signed out', '#93A3A1'],
  ['EXPORT', 'Downloaded', '#C9A24E'], ['IMPORT', 'Imported', '#6B5BB5'], ['APPROVE', 'Approved', '#1E9E6A'],
];
const color = (a: string) => ACTIONS.find(x => x[0] === a)?.[2] ?? '#93A3A1';
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
const day = (iso: string) => { const d = new Date(iso); return fdate(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`); };

export default function AdminLogClient({ overview, canDownload }: { overview: Overview; canDownload: boolean }) {
  const [f, setF] = useState<F>(EMPTY);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  // Search waits until typing pauses
  useEffect(() => { const t = setTimeout(() => setF(p => (p.q === q ? p : { ...p, q })), 350); return () => clearTimeout(t); }, [q]);
  useEffect(() => setPage(1), [f]);
  const qs = useMemo(() => {
    const p = new URLSearchParams();
    Object.entries(f).forEach(([k, v]) => v && p.set(k, v));
    return p.toString();
  }, [f]);
  useEffect(() => {
    let live = true;
    setLoading(true); setErr('');
    api<Page>(`/api/work/admin-log?${qs}${qs ? '&' : ''}page=${page}`, 'GET')
      .then(d => { if (live) setData(d); })
      .catch(e => { if (live) setErr((e as Error).message); })
      .finally(() => { if (live) setLoading(false); });
    return () => { live = false; };
  }, [qs, page]);

  const active = Object.values(f).some(Boolean);
  const set = (patch: Partial<F>) => setF(p => ({ ...p, ...patch }));
  const stats: [string, number, string][] = [
    ['Actions today', overview.today, 'Everything recorded since midnight'],
    ['Last 7 days', overview.last7, 'Changes, sign-ins and downloads'],
    ['People active', overview.active, 'Did something in the last 7 days'],
    ['Sign-ins', overview.signIns, 'In the last 7 days'],
  ];

  return (
    <>
      <PageHeader title="Admin Log" sub="Who did what, and when: orders created and changed, sign-ins, downloads and imports."
        actions={canDownload ? (
          <a className="btn" href={`/api/work/admin-log?${qs}${qs ? '&' : ''}format=xlsx`} download>
            <Icon name="xls" size={16} />Download Excel
          </a>
        ) : undefined} />

      <div className="grid g4 log-stats">
        {stats.map(([l, v, s]) => (
          <div className="card log-stat" key={l}><b>{v}</b><span>{l}</span><small>{s}</small></div>
        ))}
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="chips">
            <button className={`chip${!f.section ? ' on' : ''}`} onClick={() => set({ section: '' })}>Everything</button>
            {SECTION_LIST.map(s => (
              <button key={s.key} className={`chip${f.section === s.key ? ' on' : ''}`} onClick={() => set({ section: s.key })}>{s.name}</button>
            ))}
            <button className={`chip${f.section === 'GENERAL' ? ' on' : ''}`} onClick={() => set({ section: 'GENERAL' })}>Sign-ins and downloads</button>
          </div>
          <div className="tb-search"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search name, order or detail" /></div>
        </div>
        <div className="filter-row">
          <span className="fr-label"><Icon name="filter" size={14} />Filter</span>
          <select value={f.person} onChange={e => set({ person: e.target.value })} aria-label="Person">
            <option value="">Everyone</option>
            {overview.people.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={f.action} onChange={e => set({ action: e.target.value })} aria-label="Action">
            <option value="">All actions</option>
            {ACTIONS.filter(a => a[0] !== 'STATUS_CHANGE').map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <label className="fr-date">From<input type="date" value={f.from} max={f.to || undefined} onChange={e => set({ from: e.target.value })} /></label>
          <label className="fr-date">to<input type="date" value={f.to} min={f.from || undefined} onChange={e => set({ to: e.target.value })} /></label>
          {active && <button type="button" className="fr-clear" onClick={() => { setF(EMPTY); setQ(''); }}><Icon name="x" size={13} />Clear</button>}
          <span className="fr-count">{data ? `${data.total} entr${data.total === 1 ? 'y' : 'ies'}` : ''}</span>
        </div>
        {err && <div className="err-banner" style={{ margin: 16 }}>{err}</div>}
        <div className="tbl-wrap">
          <table className="log-tbl">
            <thead><tr><th style={{ width: 120 }}>When</th><th>Person</th><th>Action</th><th>Order</th><th>Details</th></tr></thead>
            <tbody>
              {data?.rows.map(r => (
                <tr key={r.id}>
                  <td style={{ whiteSpace: 'nowrap' }}><div className="t-name" style={{ fontWeight: 500 }}>{day(r.at)}</div><div className="t-code">{time(r.at)}</div></td>
                  <td><Person name={r.person} />{r.email && <div className="t-code" style={{ marginTop: 4 }}>{r.email}</div>}</td>
                  <td><span className="pill" style={{ color: color(r.action), background: `${color(r.action)}17` }}>{r.label}</span></td>
                  <td>
                    {r.code ? (
                      <>
                        {r.section && r.orderId
                          ? <Link className="t-name link" href={`/work/${SECTIONS[r.section].slug}?open=${r.orderId}`}>{r.orderName ?? r.code}</Link>
                          : <div className="t-name">{r.orderName ?? r.code}</div>}
                        <div className="t-code">{r.code}{r.section && <span className="unit-tag">{SECTIONS[r.section].short}</span>}</div>
                      </>
                    ) : <span className="muted">-</span>}
                  </td>
                  <td className="log-details">{r.details || <span className="muted">-</span>}</td>
                </tr>
              ))}
              {!loading && data && !data.rows.length && (
                <tr><td colSpan={5}><div className="empty"><b>{active ? 'Nothing matches' : 'Nothing recorded yet'}</b>{active ? 'Try another filter, or clear the filters.' : 'Actions appear here as people use the system.'}</div></td></tr>
              )}
              {loading && !data && <tr><td colSpan={5}><div className="empty">Loading…</div></td></tr>}
            </tbody>
          </table>
        </div>
        {data && data.pages > 1 && (
          <div className="pager">
            <span>Page {data.page} of {data.pages}</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" disabled={page <= 1 || loading} onClick={() => setPage(p => p - 1)}>Newer</button>
              <button className="btn" disabled={page >= data.pages || loading} onClick={() => setPage(p => p + 1)}>Older</button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
