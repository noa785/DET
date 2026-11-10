'use client';
// All Orders: filter by status, unit and due date, search, click an order to update it.
// Orders keep the tracker Excel's row order.

import { Fragment, useEffect, useMemo, useState } from 'react';
import { BUCKETS, BUCKET_KEYS, NO_PROJECT, SECTIONS, isLate, pct, type Bucket, type DetOrder, type DetProject, type DetUnit, type SectionKey } from '@/lib/det/shared';
import { DateHeader, GovPill, Icon, NO_FILTERS, OrderFilters, PageHeader, Person, Progress, StatusPill, applyOrderFilters, fdateIn, type OrderFilterState } from '@/components/det/ui';
import { useLang } from '@/lib/i18n/client';
import OrderDrawer from '@/components/det/OrderDrawer';
import Link from 'next/link';

const PAGE = 50;

export default function OrdersClient({ section, initial, owners, units, projects: initialProjects = [], openId, canEdit = true }: {
  section: SectionKey; initial: DetOrder[]; owners: string[]; units: DetUnit[]; projects?: DetProject[]; openId: string | null; canEdit?: boolean;
}) {
  const { t, lang } = useLang();
  const [orders, setOrders] = useState(initial);
  const [projects, setProjects] = useState(initialProjects);
  const [filter, setFilter] = useState<'ALL' | Bucket>('ALL');
  const [q, setQ] = useState('');
  const [f, setF] = useState<OrderFilterState>(NO_FILTERS);
  const [page, setPage] = useState(1);
  const [openOrder, setOpenOrder] = useState<DetOrder | null>(null);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => { setOrders(initial); }, [initial]);
  useEffect(() => {
    if (openId) setOpenOrder(initial.find(o => o.id === openId) ?? null);
    const n = new URLSearchParams(window.location.search).get('new');
    if (n) { setFlash(n); setTimeout(() => setFlash(null), 2600); }
  }, [openId, initial]);
  useEffect(() => setPage(1), [filter, q, f]);

  // Unit and date filters first, so the status counts match what is filtered.
  const scoped = useMemo(() => applyOrderFilters(orders, f), [orders, f]);
  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return scoped.filter(o => (filter === 'ALL' || o.bucket === filter) &&
      (!s || `${o.name} ${o.code} ${o.owner} ${o.unitCode ?? ''} ${o.unitName ?? ''} ${o.projectName ?? ''} ${o.projectCode ?? ''}`.toLowerCase().includes(s)));
  }, [scoped, filter, q]);
  const shown = list.slice(0, page * PAGE);
  const count = (b: Bucket) => scoped.filter(o => o.bucket === b).length;
  // Group header rows when the list is shown by project
  const byProject = f.sort === 'project';
  const groupStats = useMemo(() => {
    const m = new Map<string, { n: number; done: number }>();
    for (const o of list) {
      const k = o.projectName || NO_PROJECT, g = m.get(k) ?? { n: 0, done: 0 };
      g.n++; if (o.bucket === 'DONE') g.done++; m.set(k, g);
    }
    return m;
  }, [list]);

  return (
    <>
      <PageHeader section={section} title={t('All Orders')} sub={canEdit ? t('Click any order to update its progress.') : t('View only. {section} is updated by its own team.', { section: t(SECTIONS[section].name) })} />
      <div className="card">
        <div className="toolbar">
          <div className="chips">
            <button className={`chip${filter === 'ALL' ? ' on' : ''}`} onClick={() => setFilter('ALL')}>{t('All')} <span className="n">{scoped.length}</span></button>
            {BUCKET_KEYS.map(k => (
              <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{t(BUCKETS[k].label)} <span className="n">{count(k)}</span></button>
            ))}
          </div>
          <div className="tb-search"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder={t('Search orders')} /></div>
        </div>
        <OrderFilters orders={orders} units={units} value={f} onChange={setF} shown={list.length} />
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>{t('Order')}</th><th>{t('Project')}</th><th>{t('Unit')}</th><th>{t('Responsible')}</th><th>{t('Status')}</th><th>{t('Progress')}</th><th><DateHeader field="start" value={f} onChange={setF} /></th><th><DateHeader field="due" value={f} onChange={setF} /></th><th>{t('Governance')}</th></tr></thead>
            <tbody>
              {shown.map((o, i) => {
                const k = o.projectName || NO_PROJECT;
                const head = byProject && (i === 0 || (shown[i - 1].projectName || NO_PROJECT) !== k);
                const g = groupStats.get(k);
                return (
                <Fragment key={o.id}>
                {head && (
                  <tr className="proj-row"><td colSpan={9}>
                    <Icon name="folder" size={15} /><b>{t(k)}</b>{o.projectCode && <span className="t-code">{o.projectCode}</span>}
                    {g && <span className="muted">{t(g.n === 1 ? '{n} order · {p}% done' : '{n} orders · {p}% done', { n: g.n, p: pct(g.done, g.n) })}</span>}
                  </td></tr>
                )}
                <tr className={`click${flash === o.id ? ' new' : ''}`} onClick={() => setOpenOrder(o)}>
                  <td><div className="t-name">{o.name}</div><div className="t-code">{o.code}</div></td>
                  <td>{o.projectName ? <span className="t-unit proj" title={t(o.projectName)}>{t(o.projectName)}</span> : <span className="muted">-</span>}</td>
                  <td>{o.unitCode ? <><span className="unit-tag" style={{ marginLeft: 0 }}>{o.unitCode}</span><span className="t-unit" title={o.unitName ? t(o.unitName) : undefined}>{o.unitName ? t(o.unitName) : null}</span></> : <span className="muted">-</span>}</td>
                  <td><Person name={o.owner} /></td>
                  <td><StatusPill bucket={o.bucket} /></td>
                  <td><Progress value={o.progress} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{o.start ? fdateIn(lang, o.start) : <span className="muted">-</span>}</td>
                  <td className={isLate(o) ? 'over' : ''} style={{ whiteSpace: 'nowrap' }}>{fdateIn(lang, o.due)}{isLate(o) ? ` · ${t('late')}` : ''}</td>
                  <td><GovPill gov={o.gov} /></td>
                </tr>
                </Fragment>
                );
              })}
              {!shown.length && (
                <tr><td colSpan={9}><div className="empty">
                  <b>{t(orders.length ? 'No orders match' : 'No orders here yet')}</b>
                  {orders.length ? t('Try another filter or search, or clear the filters.') : canEdit ? <>{t('Use')} <Link href={`/work/${SECTIONS[section].slug}/new`} className="link">{t('Add Order')}</Link> {t('to create the first one.')}</> : t('This section has no orders yet.')}
                </div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {list.length > shown.length && (
          <div className="pager">
            <span>{t('Showing {shown} of {total}', { shown: shown.length, total: list.length })}</span>
            <button className="btn" onClick={() => setPage(p => p + 1)}>{t('Show more')}</button>
          </div>
        )}
      </div>
      <OrderDrawer order={openOrder} owners={owners} units={units} projects={projects} readOnly={!canEdit} onClose={() => setOpenOrder(null)}
        onSaved={o => { if (o.projectName && o.projectCode && !projects.some(p => p.name === o.projectName)) setProjects(prev => [...prev, { code: o.projectCode!, name: o.projectName!, section: o.section }]); setOrders(prev => (o.section === section ? prev.map(x => (x.id === o.id ? o : x)) : prev.filter(x => x.id !== o.id))); }} />
    </>
  );
}
