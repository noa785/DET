'use client';
// Grid Editor: every change is saved on its own. Rows keep the tracker Excel's order.

import { useMemo, useState } from 'react';
import { BUCKETS, BUCKET_KEYS, GOV, GOV_KEYS, type Bucket, type DetOrder, type DetUnit, type GovStatus, type SectionKey } from '@/lib/det/shared';
import { DateHeader, Icon, NO_FILTERS, OrderFilters, PageHeader, UnitSelect, api, applyOrderFilters, type OrderFilterState } from '@/components/det/ui';

type State = 'saved' | 'saving' | 'error';
const PAGE = 60;

export default function GridClient({ section, initial, owners, units }: { section: SectionKey; initial: DetOrder[]; owners: string[]; units: DetUnit[] }) {
  const [rows, setRows] = useState(initial);
  const [state, setState] = useState<State>('saved');
  const [q, setQ] = useState('');
  const [f, setF] = useState<OrderFilterState>(NO_FILTERS);
  const [page, setPage] = useState(1);

  const list = useMemo(() => {
    const s = q.trim().toLowerCase();
    return applyOrderFilters(rows, f).filter(o => !s || `${o.name} ${o.code} ${o.owner} ${o.unitName ?? ''}`.toLowerCase().includes(s));
  }, [rows, q, f]);
  const shown = list.slice(0, page * PAGE);

  async function save(o: DetOrder, body: Record<string, unknown>) {
    setState('saving');
    try {
      const saved = await api<DetOrder>(`/api/work/orders/${o.id}`, 'PATCH', body);
      setRows(prev => prev.map(x => (x.id === o.id ? saved : x)));
      setState('saved');
    } catch { setState('error'); }
  }
  const local = (id: string, patch: Partial<DetOrder>) => setRows(prev => prev.map(x => (x.id === id ? { ...x, ...patch } : x)));

  return (
    <>
      <PageHeader section={section} title="Grid Editor" sub="Edit any cell directly. Changes save on their own." />
      <div className="card ge">
        <div className="card-h">
          <h3>{rows.length} orders</h3>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div className="tb-search"><Icon name="search" size={15} /><input value={q} onChange={e => { setQ(e.target.value); setPage(1); }} placeholder="Search orders" /></div>
            <span className="saved" style={state === 'error' ? { color: 'var(--red)' } : undefined}>
              {state === 'saving' ? 'Saving…' : state === 'error' ? 'Could not save. Try again.' : <><Icon name="check" size={14} />All changes saved</>}
            </span>
          </div>
        </div>
        <OrderFilters orders={rows} units={units} value={f} onChange={v => { setF(v); setPage(1); }} shown={list.length} />
        <datalist id="grid-owners">{owners.map(o => <option key={o} value={o} />)}</datalist>
        <div className="tbl-wrap">
          <table>
            <thead><tr><th style={{ width: '30%' }}>Order</th><th style={{ width: 190 }}>Unit</th><th>Responsible</th><th>Status</th><th style={{ width: 100 }}>Progress %</th><th><DateHeader field="start" value={f} onChange={v => { setF(v); setPage(1); }} /></th><th><DateHeader field="due" value={f} onChange={v => { setF(v); setPage(1); }} /></th><th>Governance</th></tr></thead>
            <tbody>
              {shown.map(o => (
                <tr key={o.id}>
                  <td><input type="text" value={o.name} onChange={e => local(o.id, { name: e.target.value })}
                    onBlur={e => e.target.value.trim() && save(o, { name: e.target.value.trim() })} /></td>
                  <td><UnitSelect units={units} value={o.unitCode ?? ''} emptyLabel="No unit"
                    onChange={code => { local(o.id, { unitCode: code || null, unitName: units.find(u => u.code === code)?.name ?? null }); save(o, { unitCode: code || null }); }} /></td>
                  <td><input type="text" list="grid-owners" value={o.owner} onChange={e => local(o.id, { owner: e.target.value })}
                    onBlur={e => save(o, { ownerName: e.target.value.trim() })} /></td>
                  <td><select value={o.bucket} onChange={e => { local(o.id, { bucket: e.target.value as Bucket }); save(o, { bucket: e.target.value }); }}>
                    {BUCKET_KEYS.map(k => <option key={k} value={k}>{BUCKETS[k].label}</option>)}
                  </select></td>
                  <td><input type="number" min={0} max={100} value={o.progress} onChange={e => local(o.id, { progress: Number(e.target.value) })}
                    onBlur={e => save(o, { progress: Math.max(0, Math.min(100, Number(e.target.value) || 0)) })} /></td>
                  <td><input type="date" value={o.start ?? ''} aria-label="Start date" onChange={e => { local(o.id, { start: e.target.value || null }); save(o, { startDate: e.target.value || null }); }} /></td>
                  <td><input type="date" value={o.due ?? ''} onChange={e => { local(o.id, { due: e.target.value || null }); save(o, { dueDate: e.target.value || null }); }} /></td>
                  <td><select value={o.gov} onChange={e => { local(o.id, { gov: e.target.value as GovStatus }); save(o, { govStatus: e.target.value }); }}>
                    {GOV_KEYS.map(k => <option key={k} value={k}>{GOV[k].label}</option>)}
                  </select></td>
                </tr>
              ))}
              {!shown.length && <tr><td colSpan={8}><div className="empty"><b>{rows.length ? 'No orders match' : 'No orders here yet'}</b>{rows.length ? 'Try another filter or search, or clear the filters.' : 'Orders you add will appear here.'}</div></td></tr>}
            </tbody>
          </table>
        </div>
        {list.length > shown.length && (
          <div className="pager"><span>Showing {shown.length} of {list.length}</span><button className="btn" onClick={() => setPage(p => p + 1)}>Show more</button></div>
        )}
      </div>
    </>
  );
}
