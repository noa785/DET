'use client';
// src/components/det/ui.tsx
// Small building blocks shared by the DET v2 pages.

import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react';
import { BUCKETS, GOV, SECTIONS, groupUnits, initials, personColor, type Bucket, type DetOrder, type DetUnit, type GovStatus, type SectionKey } from '@/lib/det/shared';

/* ── Icons ─────────────────────────────────────────────── */
const paths: Record<string, ReactNode> = {
  orders: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="4.5" cy="6" r="1.2" /><circle cx="4.5" cy="12" r="1.2" /><circle cx="4.5" cy="18" r="1.2" /></>,
  grid: <><rect x="3" y="3" width="18" height="18" rx="2" /><path d="M3 9h18M3 15h18M9 3v18M15 3v18" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  se: <><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M8 20h8M12 16v4M7 9l2 2-2 2M12 13h4" /></>,
  au: <path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  check: <path d="M20 6L9 17l-5-5" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>,
  x: <path d="M18 6L6 18M6 6l12 12" />,
  shield: <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  pdf: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M12 12v6M9 15l3 3 3-3" /></>,
  out: <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  filter: <path d="M3 5h18l-7 8v6l-4 2v-8z" />,
  xls: <><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M8.5 12.5l4 5M12.5 12.5l-4 5" /></>,
  log: <><path d="M12 8v4l3 2" /><circle cx="12" cy="12" r="9" /></>,
  download: <path d="M12 3v12M7 10l5 5 5-5M5 21h14" />,
  chev: <path d="M6 9l6 6 6-6" />,
};
export function Icon({ name, size = 16 }: { name: keyof typeof paths | string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[name]}
    </svg>
  );
}
export const sectionIcon = (s: SectionKey) => (s === 'AUTOMATION' ? 'au' : 'se');

/* ── DET diamond mark ──────────────────────────────────── */
export function DetMark({ variant = 'dark', className }: { variant?: 'dark' | 'light'; className?: string }) {
  const id = `dm${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const dark = variant === 'dark';
  return (
    <svg className={`detmark ${className ?? ''}`} viewBox="0 0 200 200" role="img" aria-label="DET">
      <defs>
        <linearGradient id={`s${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={dark ? '#5FD1C9' : '#158B87'} /><stop offset=".5" stopColor={dark ? '#F3DFA8' : '#C9A24E'} /><stop offset="1" stopColor={dark ? '#5FD1C9' : '#158B87'} />
        </linearGradient>
        <linearGradient id={`f${id}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#1A9E99" /><stop offset="1" stopColor={dark ? '#0A4542' : '#0D5C59'} />
        </linearGradient>
      </defs>
      <g className="dm-star">
        <path d="M100 6 L128 72 L194 100 L128 128 L100 194 L72 128 L6 100 L72 72 Z" fill="none" stroke={`url(#s${id})`} strokeWidth="3" strokeLinejoin="round" />
        <rect x="46" y="46" width="108" height="108" fill="none" stroke={`url(#s${id})`} strokeWidth="1.6" opacity=".55" />
      </g>
      <rect x="56" y="56" width="88" height="88" rx="6" transform="rotate(45 100 100)" fill={`url(#f${id})`} stroke={dark ? '#F3DFA8' : '#C9A24E'} strokeWidth="2" />
      <text x="100" y="101" textAnchor="middle" dominantBaseline="central" fontFamily="IBM Plex Sans, Segoe UI, Arial, sans-serif" fontWeight="700" fontSize="34" letterSpacing="2" fill="#FFFFFF">DET</text>
    </svg>
  );
}

/* ── Ring (progress circle) ────────────────────────────── */
export function Ring({ value, size = 104, stroke = 10, color, track = '#EDF2F1', children }: { value: number; size?: number; stroke?: number; color: string; track?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const [off, setOff] = useState(c);
  useEffect(() => { const t = requestAnimationFrame(() => setOff(c * (1 - value / 100))); return () => cancelAnimationFrame(t); }, [value, c]);
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)' }} />
      </svg>
      <div className="lbl">{children}</div>
    </div>
  );
}

/* ── Pills, people, progress ───────────────────────────── */
export function StatusPill({ bucket }: { bucket: Bucket }) {
  const b = BUCKETS[bucket];
  return <span className="pill" style={{ color: b.color, background: `${b.color}17` }}>{b.label}</span>;
}
export function GovPill({ gov }: { gov: GovStatus }) {
  const g = GOV[gov];
  return <span className="gov" style={{ color: g.color, background: `${g.color}14` }}><Icon name="shield" size={13} />{g.label}</span>;
}
export function Person({ name, showName = true }: { name: string; showName?: boolean }) {
  return (
    <span className="owner">
      <span className="av" style={{ background: personColor(name) }}>{initials(name)}</span>
      {showName && name}
    </span>
  );
}
export function Progress({ value }: { value: number }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(value)); return () => cancelAnimationFrame(t); }, [value]);
  return (
    <div className="prog">
      <div className="bar"><span style={{ width: `${w}%`, ...(value === 100 ? { background: 'var(--green)' } : {}) }} /></div>
      <small>{value}%</small>
    </div>
  );
}

/* ── Page header ───────────────────────────────────────── */
export function PageHeader({ section, title, sub, actions }: { section?: SectionKey; title: string; sub?: string; actions?: ReactNode }) {
  const s = section ? SECTIONS[section] : null;
  return (
    <div className="ph">
      <div>
        {s && <div className="eyebrow" style={{ color: s.color }}><Icon name={sectionIcon(s.key)} size={14} />{s.name}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ── Segmented buttons ─────────────────────────────────── */
export function Segmented<T extends string>({ value, options, onChange, three }: {
  value: T; options: { key: T; label: string; color?: string }[]; onChange: (v: T) => void; three?: boolean;
}) {
  return (
    <div className={`seg${three ? ' three' : ''}`}>
      {options.map(o => (
        <button key={o.key} type="button" className={o.key === value ? 'on' : ''} onClick={() => onChange(o.key)}>
          {o.color && <i style={{ background: o.color }} />}{o.label}
        </button>
      ))}
    </div>
  );
}

/* ── Bullet editor: Enter adds a point, Backspace on an empty point removes it ── */
export function BulletEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const items = value.length ? value : [''];
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const focusAt = useRef<number | null>(null);
  useEffect(() => {
    if (focusAt.current !== null) { refs.current[focusAt.current]?.focus(); focusAt.current = null; }
  });
  const set = (next: string[], focus?: number) => { if (focus !== undefined) focusAt.current = focus; onChange(next); };
  return (
    <>
      <div className="bullets">
        {items.map((v, i) => (
          <div className="b-row" key={i}>
            <span className="dot" />
            <input
              ref={el => { refs.current[i] = el; }}
              type="text" value={v} placeholder="Write a point"
              onChange={e => { const n = [...items]; n[i] = e.target.value; set(n); }}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); const n = [...items]; n.splice(i + 1, 0, ''); set(n, i + 1); }
                if (e.key === 'Backspace' && !v && items.length > 1) { e.preventDefault(); const n = [...items]; n.splice(i, 1); set(n, Math.max(0, i - 1)); }
              }}
              onPaste={e => {
                const lines = e.clipboardData.getData('text').split(/\r?\n/).map(l => l.replace(/^\s*[-•*\d.)]+\s*/, '').trim()).filter(Boolean);
                if (lines.length > 1) { e.preventDefault(); const n = [...items]; n.splice(i, 1, v + lines[0], ...lines.slice(1)); set(n, i + lines.length - 1); }
              }}
            />
          </div>
        ))}
      </div>
      <button type="button" className="link-btn" onClick={() => set([...items, ''], items.length)}><Icon name="plus" size={15} />Add point</button>
    </>
  );
}

/* ── Governance box ────────────────────────────────────── */
export function GovBox({ section, value, note, onChange, onNote }: {
  section: SectionKey; value: GovStatus; note: string; onChange: (v: GovStatus) => void; onNote: (v: string) => void;
}) {
  return (
    <div className="govbox">
      <div className="govbox-h"><Icon name="shield" size={18} /><div><b>Governance</b><span>Owned by {SECTIONS[section].name}</span></div></div>
      <Segmented three value={value} onChange={onChange}
        options={(Object.keys(GOV) as GovStatus[]).map(k => ({ key: k, label: GOV[k].label, color: GOV[k].color }))} />
      <textarea value={note} onChange={e => onNote(e.target.value)} placeholder="Governance note (optional): policy, approval or decision" />
    </div>
  );
}

/* ── Toast ─────────────────────────────────────────────── */
let pushToast: ((m: string) => void) | null = null;
export function toast(m: string) { pushToast?.(m); }
export function ToastHost() {
  const [msg, setMsg] = useState('');
  const [show, setShow] = useState(false);
  const t = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    pushToast = m => { setMsg(m); setShow(true); clearTimeout(t.current); t.current = setTimeout(() => setShow(false), 2400); };
    return () => { pushToast = null; };
  }, []);
  return <div className={`toast${show ? ' show' : ''}`} role="status"><Icon name="check" size={15} />{msg}</div>;
}

/* ── API helper ────────────────────────────────────────── */
export async function api<T = unknown>(url: string, method: string, body?: unknown): Promise<T> {
  const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.');
  return json.data as T;
}

/* ── ELI department / unit / committee dropdown ────────── */
export function UnitSelect({ id, units, value, onChange, emptyLabel = 'None', className }: {
  id?: string; units: DetUnit[]; value: string; onChange: (code: string) => void; emptyLabel?: string; className?: string;
}) {
  const groups = useMemo(() => groupUnits(units), [units]);
  return (
    <select id={id} className={className} value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{emptyLabel}</option>
      {groups.map(g => (
        <optgroup key={g.group} label={g.group}>
          {g.units.map(u => <option key={u.code} value={u.code}>{u.name} ({u.code})</option>)}
        </optgroup>
      ))}
    </select>
  );
}

/* ── Filters by unit and due date (All Orders and Grid Editor) ── */
export type OrderSort = 'sheet' | 'newest' | 'oldest' | 'start-newest' | 'start-oldest';
export type OrderFilterState = { unit: string; from: string; to: string; sort: OrderSort };
export const NO_FILTERS: OrderFilterState = { unit: '', from: '', to: '', sort: 'sheet' };
/** Filter by unit and due date, then sort: Excel order (as loaded), or by due date either way.
 *  Orders without a due date stay at the end; ties keep the Excel order. */
export function applyOrderFilters(orders: DetOrder[], f: OrderFilterState): DetOrder[] {
  const list = orders.filter(o =>
    (!f.unit || o.unitCode === f.unit) &&
    (!f.from || (!!o.due && o.due >= f.from)) &&
    (!f.to || (!!o.due && o.due <= f.to)));
  if (f.sort === 'sheet') return list;
  const dir = f.sort === 'newest' || f.sort === 'start-newest' ? -1 : 1;
  const key = (o: DetOrder) => (f.sort.startsWith('start') ? o.start : o.due);
  return list
    .map((o, i) => ({ o, i, k: key(o) }))
    .sort((a, b) => {
      if (!a.k || !b.k) return (a.k ? -1 : b.k ? 1 : 0) || a.i - b.i;
      return (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) * dir || a.i - b.i;
    })
    .map(x => x.o);
}
export function OrderFilters({ orders, units, value, onChange, shown }: {
  orders: DetOrder[]; units: DetUnit[]; value: OrderFilterState; onChange: (f: OrderFilterState) => void; shown: number;
}) {
  // Only list the units that have orders here, so every choice gives results.
  const used = useMemo(() => {
    const codes = new Set(orders.map(o => o.unitCode).filter(Boolean));
    const known = units.filter(u => codes.has(u.code));
    const extra = [...codes].filter(c => !known.some(u => u.code === c)).map(c => ({ code: c as string, name: c as string }));
    return [...known, ...extra];
  }, [orders, units]);
  const active = !!(value.unit || value.from || value.to || value.sort !== 'sheet');
  return (
    <div className="filter-row">
      <span className="fr-label"><Icon name="filter" size={14} />Filter</span>
      <UnitSelect className="fr-unit" units={used} value={value.unit} emptyLabel="All units" onChange={unit => onChange({ ...value, unit })} />
      <label className="fr-date">Due from<input type="date" value={value.from} max={value.to || undefined} onChange={e => onChange({ ...value, from: e.target.value })} /></label>
      <label className="fr-date">to<input type="date" value={value.to} min={value.from || undefined} onChange={e => onChange({ ...value, to: e.target.value })} /></label>
      <label className="fr-date">Sort
        <select value={value.sort} onChange={e => onChange({ ...value, sort: e.target.value as OrderSort })}>
          <option value="sheet">Excel order</option>
          <option value="newest">Newest due date first</option>
          <option value="oldest">Oldest due date first</option>
          <option value="start-newest">Newest start date first</option>
          <option value="start-oldest">Oldest start date first</option>
        </select>
      </label>
      {active && <button type="button" className="fr-clear" onClick={() => onChange(NO_FILTERS)}><Icon name="x" size={13} />Clear</button>}
      <span className="fr-count">{shown} order{shown === 1 ? '' : 's'}</span>
    </div>
  );
}

/* ── Clickable date headers: oldest first, then newest first, then back to Excel order ── */
export function DateHeader({ field, value, onChange }: { field: 'due' | 'start'; value: OrderFilterState; onChange: (f: OrderFilterState) => void }) {
  const oldest: OrderSort = field === 'start' ? 'start-oldest' : 'oldest';
  const newest: OrderSort = field === 'start' ? 'start-newest' : 'newest';
  const state = value.sort === oldest ? 'oldest' : value.sort === newest ? 'newest' : 'none';
  const nextSort: OrderSort = state === 'none' ? oldest : state === 'oldest' ? newest : 'sheet';
  return (
    <button type="button" className={`th-sort${state !== 'none' ? ' on' : ''}`}
      title={state === 'oldest' ? 'Oldest first' : state === 'newest' ? 'Newest first' : 'Click to sort'}
      onClick={() => onChange({ ...value, sort: nextSort })}>
      {field === 'start' ? 'Start date' : 'Due date'}
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {state === 'newest' ? <path d="M12 5v14M6 13l6 6 6-6" /> : state === 'oldest' ? <path d="M12 19V5M6 11l6-6 6 6" /> : <path d="M8 9l4-4 4 4M8 15l4 4 4-4" />}
      </svg>
    </button>
  );
}
export const DueDateHeader = (p: { value: OrderFilterState; onChange: (f: OrderFilterState) => void }) => <DateHeader field="due" {...p} />;
