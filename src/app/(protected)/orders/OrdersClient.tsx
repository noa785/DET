'use client';
// src/app/(protected)/orders/OrdersClient.tsx

import { useState, useMemo, useTransition } from 'react';
import Link from 'next/link';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { StatusBadge, PriorityBadge, RAGDot, ProgressBar, EmptyState, Spinner } from '@/components/ui/badges';
import type { OrderStatus, Priority, RAGStatus } from '@/types';

// ── Types ──────────────────────────────────────────────────────
interface OrderRow {
  id: string; orderCode: string; type: string; name: string;
  unitCode: string | null; unitName: string | null; unitColor: string | null;
  projectName: string | null; ownerName: string | null;
  priority: string; status: string;
  startDate: string | null; dueDate: string | null;
  percentComplete: number; rescheduleCount: number;
  createdAt: string; updatedAt: string;
  effectiveRAG: RAGStatus; isOverdue: boolean;
  govReviewRequired?: boolean;
  projectType?: string | null;
}

interface Props {
  orders: OrderRow[];
  total: number; page: number; pageSize: number;
  units: { id: string; code: string; name: string }[];
  projects: { id: string; code: string; name: string }[];
  userRole?: string;
}

type SortKey = 'orderCode' | 'name' | 'status' | 'priority' | 'percentComplete' | 'dueDate' | 'unitCode';

// ── Component ──────────────────────────────────────────────────
export default function OrdersClient({ orders, total, page, pageSize, units, projects, userRole }: Props) {
  const router       = useRouter();
  const pathname     = usePathname();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const [search, setSearch]   = useState(searchParams.get('search') ?? '');
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt' as any);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [govFilter, setGovFilter] = useState<'' | 'yes' | 'no'>('');

  const visible = useMemo(() => {
    let rows = [...orders];
    if (search.trim()) {
      const q = search.toLowerCase();
      rows = rows.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.orderCode.toLowerCase().includes(q) ||
        (o.ownerName ?? '').toLowerCase().includes(q) ||
        (o.unitCode ?? '').toLowerCase().includes(q)
      );
    }
    if (govFilter === 'yes') rows = rows.filter(o => o.govReviewRequired);
    if (govFilter === 'no')  rows = rows.filter(o => !o.govReviewRequired);
    rows.sort((a, b) => {
      const av = String((a as any)[sortKey] ?? '');
      const bv = String((b as any)[sortKey] ?? '');
      return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    return rows;
  }, [orders, search, sortKey, sortDir, govFilter]);

  function setURLParam(key: string, value: string | null) {
    const p = new URLSearchParams(searchParams.toString());
    if (value) p.set(key, value); else p.delete(key);
    p.delete('page');
    startTransition(() => router.push(`${pathname}?${p.toString()}`));
  }

  function sort(key: SortKey) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  function toggleSelect(id: string) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function toggleAll() {
    setSelected(s => s.size === visible.length ? new Set() : new Set(visible.map(o => o.id)));
  }

  const totalPages = Math.ceil(total / pageSize);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* ── GOV EDITOR Guidance Banner ── */}
      {userRole === 'GOV_EDITOR' && (
        <div style={{
          display: 'flex', alignItems: 'flex-start', gap: 14,
          padding: '14px 18px', borderRadius: 10,
          background: 'rgba(139,92,246,0.07)',
          border: '1px solid rgba(139,92,246,0.25)',
        }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>⬙</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>
              Your Role: Governance Editor
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6 }}>
              Orders flagged for governance review are marked with <strong style={{ color: '#8b5cf6' }}>⬙ Required</strong> in the <strong>Gov. Review</strong> column.
              Open any flagged order → go to the <strong>Governance</strong> tab → add your governance documentation there.
              You can also view all flagged orders from{' '}
              <Link href="/governance/review" style={{ color: '#8b5cf6', textDecoration: 'underline' }}>
                Gov. Review Dashboard → Orders for Review
              </Link>.
            </div>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.02em', margin: 0 }}>
            All Orders
          </h1>
          <p style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>
            {total} total orders &mdash; {visible.length} shown
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {selected.size > 0 && (
            <button className="pes-btn pes-btn-ghost" style={{ fontSize: 12 }}>
              Bulk Edit ({selected.size})
            </button>
          )}
          <Link href="/orders/grid">
            <button className="pes-btn pes-btn-ghost" style={{ fontSize: 12 }}>⊞ Grid Editor</button>
          </Link>
          <Link href="/orders/new">
            <button className="pes-btn pes-btn-primary" style={{ fontSize: 12 }}>+ New Order</button>
          </Link>
        </div>
      </div>

      {/* ── Filter bar ── */}
      <div className="pes-card" style={{ padding: '12px 16px', overflow: 'visible' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: 10 }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1 1 200px', minWidth: 180 }}>
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, code, owner, unit…"
              className="pes-input"
              style={{ paddingLeft: 30, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
            />
            <span style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)', fontSize: 11, pointerEvents: 'none' }}>🔍</span>
          </div>

          {/* Status */}
          <select
            value={searchParams.get('status') ?? ''}
            onChange={e => setURLParam('status', e.target.value || null)}
            className="pes-input"
            style={{ width: 148, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
          >
            <option value="">All Statuses</option>
            {(['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED'] as OrderStatus[]).map(s => (
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
            ))}
          </select>

          {/* Priority */}
          <select
            value={searchParams.get('priority') ?? ''}
            onChange={e => setURLParam('priority', e.target.value || null)}
            className="pes-input"
            style={{ width: 130, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
          >
            <option value="">All Priorities</option>
            {(['LOW','MEDIUM','HIGH','CRITICAL'] as Priority[]).map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Unit */}
          <select
            value={searchParams.get('unit') ?? ''}
            onChange={e => setURLParam('unit', e.target.value || null)}
            className="pes-input"
            style={{ width: 130, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
          >
            <option value="">All Units</option>
            {units.map(u => <option key={u.id} value={u.code}>{u.code}</option>)}
          </select>

          {/* Gov Review filter */}
          <select
            value={govFilter}
            onChange={e => setGovFilter(e.target.value as any)}
            className="pes-input"
            style={{ width: 170, paddingTop: 7, paddingBottom: 7, fontSize: 12 }}
          >
            <option value="">All — Gov. Review</option>
            <option value="yes">Requires Gov. Review</option>
            <option value="no">No Gov. Review</option>
          </select>

          {/* Clear */}
          {(searchParams.get('status') || searchParams.get('priority') || searchParams.get('unit') || search || govFilter) && (
            <button
              onClick={() => {
                setSearch('');
                setGovFilter('');
                setURLParam('status', null);
                setURLParam('priority', null);
                setURLParam('unit', null);
              }}
              style={{ fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', background: 'none', border: 'none', padding: '4px 6px', transition: 'color 0.15s' }}
            >
              ✕ Clear filters
            </button>
          )}

          {isPending && <Spinner size={14} />}
        </div>
      </div>

      {/* ── Bulk actions ── */}
      {selected.size > 0 && (
        <div className="pes-card" style={{ padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 12, borderColor: 'rgba(var(--accent-rgb),0.3)', background: 'rgba(var(--accent-rgb),0.04)' }}>
          <span style={{ fontSize: 12.5, color: 'var(--accent)', fontWeight: 600 }}>{selected.size} selected</span>
          <select className="pes-input" style={{ width: 150, paddingTop: 5, paddingBottom: 5, fontSize: 12 }}>
            <option>Change Status…</option>
            {(['NOT_STARTED','IN_PROGRESS','DONE','CANCELLED'] as OrderStatus[]).map(s => (
              <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
            ))}
          </select>
          <button className="pes-btn pes-btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}>Apply</button>
          <button className="pes-btn" style={{ fontSize: 11, padding: '4px 10px', color: 'var(--red)', background: 'transparent', border: '1px solid var(--border-2)' }}>
            Delete
          </button>
          <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>✕</button>
        </div>
      )}

      {/* ── Table ── */}
      <div className="pes-card" style={{ overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ width: 40, padding: '10px 16px' }}>
                  <input
                    type="checkbox"
                    checked={selected.size === visible.length && visible.length > 0}
                    onChange={toggleAll}
                    style={{ accentColor: 'var(--accent)', cursor: 'pointer' }}
                  />
                </th>
                <Th label="Ref"      sKey="orderCode"       current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Order Name" sKey="name"          current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Unit"     sKey="unitCode"        current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Type"     sKey="status"          current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Status"   sKey="status"          current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Priority" sKey="priority"        current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Progress" sKey="percentComplete" current={sortKey} dir={sortDir} onSort={sort} />
                <Th label="Due Date" sKey="dueDate"         current={sortKey} dir={sortDir} onSort={sort} />
                <th style={{ ...thStyle, minWidth: 130 }}>Gov. Review</th>
                <th style={{ width: 40, padding: '10px 8px' }} />
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ padding: 0 }}>
                    <EmptyState icon="📋" title="No orders found" sub="Adjust filters or create a new order" />
                  </td>
                </tr>
              ) : (
                visible.map(o => (
                  <OrderTableRow
                    key={o.id}
                    order={o}
                    checked={selected.has(o.id)}
                    onCheck={() => toggleSelect(o.id)}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{
            padding: '10px 20px',
            borderTop: '1px solid var(--border)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          }}>
            <span style={{ fontSize: 12, color: 'var(--text-3)' }}>
              Page {page} of {totalPages} &mdash; {total} records
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map(p => (
                <button
                  key={p}
                  onClick={() => setURLParam('page', String(p))}
                  style={{
                    width: 28, height: 28, borderRadius: 6, fontSize: 12, cursor: 'pointer',
                    border: p === page ? 'none' : '1px solid var(--border)',
                    background: p === page ? 'var(--accent)' : 'transparent',
                    color: p === page ? '#fff' : 'var(--text-2)',
                    transition: 'all 0.1s',
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: '10px 16px',
  textAlign: 'left',
  fontSize: 10.5,
  fontWeight: 600,
  letterSpacing: '0.06em',
  textTransform: 'uppercase',
  color: 'var(--text-3)',
  whiteSpace: 'nowrap',
};

function Th({ label, sKey, current, dir, onSort }: {
  label: string; sKey: SortKey;
  current: SortKey; dir: 'asc' | 'desc';
  onSort: (k: SortKey) => void;
}) {
  const active = current === sKey;
  return (
    <th
      style={{ ...thStyle, cursor: 'pointer', userSelect: 'none', color: active ? 'var(--accent)' : 'var(--text-3)' }}
      onClick={() => onSort(sKey)}
    >
      {label} {active ? (dir === 'asc' ? '↑' : '↓') : ''}
    </th>
  );
}

function OrderTableRow({ order, checked, onCheck }: { order: OrderRow; checked: boolean; onCheck: () => void }) {
  const color = order.unitColor && order.unitColor.length <= 9 ? order.unitColor : 'var(--accent)';
  const dueStr = order.dueDate
    ? new Date(order.dueDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
    : '—';

  return (
    <tr style={{
      borderBottom: '1px solid var(--border)',
      background: order.isOverdue ? 'rgba(239,68,68,0.03)' : 'transparent',
      transition: 'background 0.1s',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = order.isOverdue ? 'rgba(239,68,68,0.03)' : 'transparent'; }}
    >
      {/* Checkbox */}
      <td style={{ width: 40, padding: '8px 16px' }}>
        <input type="checkbox" checked={checked} onChange={onCheck} style={{ accentColor: 'var(--accent)', cursor: 'pointer' }} />
      </td>

      {/* Ref + icon */}
      <td style={{ padding: '8px 16px', whiteSpace: 'nowrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{
            width: 22, height: 22, borderRadius: 5,
            background: `rgba(var(--accent-rgb), 0.12)`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, flexShrink: 0,
          }}>
            {order.type === 'PROGRAM' ? '◈' : order.type === 'PROJECT' ? '◫' : order.type === 'DELIVERABLE' ? '◉' : '◻'}
          </div>
          <Link href={`/orders/${order.id}`} style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 600, textDecoration: 'none' }}>
            {order.orderCode}
          </Link>
        </div>
      </td>

      {/* Name */}
      <td style={{ padding: '8px 16px', maxWidth: 280 }}>
        <Link href={`/orders/${order.id}`} style={{ color: 'var(--text)', textDecoration: 'none', display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {order.name}
        </Link>
        {order.projectName && (
          <div style={{ fontSize: 11, color: 'var(--text-3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: 1 }}>{order.projectName}</div>
        )}
      </td>

      {/* Unit */}
      <td style={{ padding: '8px 16px' }}>
        {order.unitCode ? (
          <span style={{
            fontSize: 10.5, fontWeight: 700, padding: '2px 7px', borderRadius: 99,
            borderLeft: `2px solid ${color}`,
            background: `${color}18`, color,
            whiteSpace: 'nowrap',
          }}>
            {order.unitCode}
          </span>
        ) : '—'}
      </td>

      {/* Project Type */}
      <td style={{ padding: '8px 16px' }}>
        {order.projectType ? (
          <span style={{
            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: order.projectType === 'DATA_ANALYSIS' ? 'rgba(14,165,233,0.12)'
              : order.projectType === 'SYSTEM_BUILD' ? 'rgba(99,102,241,0.12)'
              : 'rgba(107,114,128,0.12)',
            color: order.projectType === 'DATA_ANALYSIS' ? '#0ea5e9'
              : order.projectType === 'SYSTEM_BUILD' ? '#6366f1'
              : '#6b7280',
            whiteSpace: 'nowrap',
          }}>
            {order.projectType === 'DATA_ANALYSIS' ? '📊 Data'
              : order.projectType === 'SYSTEM_BUILD' ? '🖥 System'
              : '◻ Other'}
          </span>
        ) : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>}
      </td>

      {/* Status */}
      <td style={{ padding: '8px 16px' }}>
        <StatusBadge status={order.status as any} />
      </td>

      {/* Priority */}
      <td style={{ padding: '8px 16px' }}>
        <PriorityBadge priority={order.priority as any} />
      </td>

      {/* Progress */}
      <td style={{ padding: '8px 16px', minWidth: 90 }}>
        <ProgressBar value={order.percentComplete} size="sm" />
        <div style={{ fontSize: 10.5, color: 'var(--text-3)', textAlign: 'right', marginTop: 2 }}>{order.percentComplete}%</div>
      </td>

      {/* Due */}
      <td style={{ padding: '8px 16px', whiteSpace: 'nowrap', fontSize: 12.5, color: order.isOverdue ? 'var(--red)' : 'var(--text-2)', fontWeight: order.isOverdue ? 600 : 400 }}>
        {order.isOverdue && <span style={{ marginRight: 4 }}>⚠</span>}
        {dueStr}
      </td>

      {/* Gov. Review Required */}
      <td style={{ padding: '8px 16px' }}>
        {order.govReviewRequired ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 10.5, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
            background: 'rgba(139,92,246,0.12)', color: '#8b5cf6',
            border: '1px solid rgba(139,92,246,0.2)',
          }}>
            ⬙ Required
          </span>
        ) : (
          <span style={{ fontSize: 11, color: 'var(--text-3)' }}>—</span>
        )}
      </td>

      {/* Actions */}
      <td style={{ padding: '8px 8px' }}>
        <Link href={`/orders/${order.id}`}>
          <button style={{
            width: 28, height: 28, borderRadius: 6,
            background: 'transparent', border: '1px solid var(--border)',
            color: 'var(--text-3)', cursor: 'pointer', fontSize: 13,
            transition: 'all 0.1s',
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'; (e.currentTarget as HTMLElement).style.color = 'var(--accent)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-3)'; }}
          >→</button>
        </Link>
      </td>
    </tr>
  );
}
