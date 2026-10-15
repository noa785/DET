'use client';
// All Orders: filter by status, unit and due date, search, click an order to update it.
// Orders keep the tracker Excel's row order.

import { useEffect, useMemo, useState } from 'react';
import { BUCKETS, BUCKET_KEYS, SECTIONS, fdate, isLate, type Bucket, type DetOrder, type DetUnit, type SectionKey } from '@/lib/det/shared';
import { DateHeader, GovPill, Icon, NO_FILTERS, OrderFilters, PageHeader, Person, Progress, StatusPill, applyOrderFilters, type OrderFilterState } from '@/components/det/ui';
import OrderDrawer from '@/components/det/OrderDrawer';
import Link from 'next/link';

const PAGE = 50;

export default function OrdersClient({ section, initial, owners, units, openId, canEdit = true }: {
  section: SectionKey; initial: DetOrder[]; owners: string[]; units: DetUnit[]; openId: string | null; canEdit?: boolean;
}) {
  const [orders, setOrders] = useState(initial);
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
      (!s || `${o.name} ${o.code} ${o.owner} ${o.unitCode ?? ''} ${o.unitName ?? ''}`.toLowerCase().includes(s)));
  }, [scoped, filter, q]);
  const shown = list.slice(0, page * PAGE);
  const count = (b: Bucket) => scoped.filter(o => o.bucket === b).length;

  return (
    <>
      <PageHeader section={section} title="All Orders" sub={canEdit ? 'Click any order to update its progress.' : `View only. ${SECTIONS[section].name} is updated by its own team.`} />
      <div className="card">
        <div className="toolbar">
          <div className="chips">
            <button className={`chip${filter === 'ALL' ? ' on' : ''}`} onClick={() => setFilter('ALL')}>All <span className="n">{scoped.length}</span></button>
            {BUCKET_KEYS.map(k => (
              <button key={k} className={`chip${filter === k ? ' on' : ''}`} onClick={() => setFilter(k)}>{BUCKETS[k].label} <span className="n">{count(k)}</span></button>
            ))}
          </div>
          <div className="tb-search"><Icon name="search" size={15} /><input value={q} onChange={e => setQ(e.target.value)} placeholder="Search orders" /></div>
        </div>
        <OrderFilters orders={orders} units={units} value={f} onChange={setF} shown={list.length} />
        <div className="tbl-wrap">
          <table>
            <thead><tr><th>Order</th><th>Unit</th><th>Responsible</th><th>Status</th><th>Progress</th><th><DateHeader field="start" value={f} onChange={setF} /></th><th><DateHeader field="due" value={f} onChange={setF} /></th><th>Governance</th></tr></thead>
            <tbody>
              {shown.map(o => (
                <tr key={o.id} className={`click${flash === o.id ? ' new' : ''}`} onClick={() => setOpenOrder(o)}>
                  <td><div className="t-name">{o.name}</div><div className="t-code">{o.code}</div></td>
                  <td>{o.unitCode ? <><span className="unit-tag" style={{ marginLeft: 0 }}>{o.unitCode}</span><span className="t-unit" title={o.unitName ?? undefined}>{o.unitName}</span></> : <span className="muted">-</span>}</td>
                  <td><Person name={o.owner} /></td>
                  <td><StatusPill bucket={o.bucket} /></td>
                  <td><Progress value={o.progress} /></td>
                  <td style={{ whiteSpace: 'nowrap' }}>{o.start ? fdate(o.start) : <span className="muted">-</span>}</td>
                  <td className={isLate(o) ? 'over' : ''} style={{ whiteSpace: 'nowrap' }}>{fdate(o.due)}{isLate(o) ? ' · late' : ''}</td>
                  <td><GovPill gov={o.gov} /></td>
                </tr>
              ))}
              {!shown.length && (
                <tr><td colSpan={8}><div className="empty">
                  <b>{orders.length ? 'No orders match' : 'No orders here yet'}</b>
                  {orders.length ? 'Try another filter or search, or clear the filters.' : canEdit ? <>Use <Link href={`/work/${SECTIONS[section].slug}/new`} className="link">Add Order</Link> to create the first one.</> : 'This section has no orders yet.'}
                </div></td></tr>
              )}
            </tbody>
          </table>
        </div>
        {list.length > shown.length && (
          <div className="pager">
            <span>Showing {shown.length} of {list.length}</span>
            <button className="btn" onClick={() => setPage(p => p + 1)}>Show more</button>
          </div>
        )}
      </div>
      <OrderDrawer order={openOrder} owners={owners} units={units} readOnly={!canEdit} onClose={() => setOpenOrder(null)}
        onSaved={o => setOrders(prev => (o.section === section ? prev.map(x => (x.id === o.id ? o : x)) : prev.filter(x => x.id !== o.id)))} />
    </>
  );
}
