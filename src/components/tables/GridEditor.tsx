'use client';
// src/components/tables/GridEditor.tsx  — Batch 3 complete
//
// Excel-like inline grid:
//  • Single-click  → select cell (blue ring)
//  • Double-click or F2 → enter edit mode
//  • Tab/Shift+Tab → next/prev column (wraps rows)
//  • Enter         → confirm + move down
//  • Escape        → cancel
//  • Arrow keys    → move selection
//  • Delete/Bksp   → clear cell
//  • Ctrl/Cmd+S    → save signal to parent
//  • Optimistic updates — appears instantly, saved in background

import React, {
  useState, useRef, useCallback, useEffect, memo, useMemo,
} from 'react';
import Link from 'next/link';
import type { SelectOption } from '@/hooks/useOrders';
import { StatusBadge, RAGDot } from '@/components/ui/badges';
import type { RAGStatus } from '@/types';

// ── Public types ───────────────────────────────────────────────
export type CellType = 'text' | 'select' | 'date' | 'number' | 'percent' | 'readonly';

export interface GridColumn {
  key:      string;
  header:   string;
  width:    number;
  type:     CellType;
  options?: { value: string; label: string; color?: string }[];
  editable?: boolean;
  render?:  (row: GridRow, value: any) => React.ReactNode;
}

export interface GridRow {
  id:        string;
  orderCode: string;
  [key: string]: any;
}

export interface GridEditorProps {
  rows:          GridRow[];
  columns:       GridColumn[];
  onCellSave:    (rowId: string, field: string, value: any) => Promise<void>;
  onAddRow:      (data: { name: string; unitId?: string | null }) => Promise<void>;
  onDeleteRows:  (ids: string[]) => Promise<void>;
  units:         SelectOption[];
  saving?:       boolean;
  totalRows?:    number;
  onLoadMore?:   () => void;
  hasMore?:      boolean;
  canEdit?:      boolean;
  onFlushNow?:   () => void;
}

interface AC { ri: number; ci: number; editing: boolean; }

// ═══════════════════════════════════════════════════════════════
//  Main
// ═══════════════════════════════════════════════════════════════
export default function GridEditor({
  rows, columns, onCellSave, onAddRow, onDeleteRows,
  units, saving, totalRows, onLoadMore, hasMore, canEdit = true, onFlushNow,
}: GridEditorProps) {
  const [ac,         setAC]         = useState<AC | null>(null);
  const [selected,   setSelected]   = useState<Set<string>>(new Set());
  const [addingRow,  setAddingRow]  = useState(false);
  const [newName,    setNewName]    = useState('');
  const [newUnit,    setNewUnit]    = useState('');
  const [rowSaving,  setRowSaving]  = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const addRef       = useRef<HTMLInputElement>(null);
  const clickRef     = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Keyboard handler (grid-level) ──────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        onFlushNow?.();
        return;
      }
      if (!ac) return;
      const { ri, ci, editing } = ac;
      const nR = rows.length;
      const nC = columns.length;

      if (editing) {
        if (e.key === 'Escape') {
          e.preventDefault();
          setAC({ ri, ci, editing: false });
          containerRef.current?.focus();
        }
        return;
      }

      switch (e.key) {
        case 'F2':
        case 'Enter':
          if (canEdit && columns[ci]?.editable !== false && columns[ci]?.type !== 'readonly') {
            e.preventDefault();
            setAC({ ri, ci, editing: true });
          }
          break;
        case 'Tab': {
          e.preventDefault();
          const d = e.shiftKey ? -1 : 1;
          let ni = ci + d, nr = ri;
          if (ni < 0)   { nr = Math.max(0, ri - 1);   ni = nC - 1; }
          if (ni >= nC) { nr = Math.min(nR - 1, ri + 1); ni = 0; }
          setAC({ ri: nr, ci: ni, editing: false });
          break;
        }
        case 'ArrowDown':  e.preventDefault(); setAC({ ri: Math.min(nR - 1, ri + 1), ci, editing: false }); break;
        case 'ArrowUp':    e.preventDefault(); setAC({ ri: Math.max(0, ri - 1),       ci, editing: false }); break;
        case 'ArrowLeft':  e.preventDefault(); setAC({ ri, ci: Math.max(0, ci - 1),   editing: false });     break;
        case 'ArrowRight': e.preventDefault(); setAC({ ri, ci: Math.min(nC - 1, ci + 1), editing: false }); break;
        case 'Delete':
        case 'Backspace': {
          const col = columns[ci];
          if (canEdit && col?.editable !== false && col?.type !== 'readonly') {
            onCellSave(rows[ri].id, col.key, col.type === 'number' || col.type === 'percent' ? 0 : null);
          }
          break;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ac, rows, columns, canEdit, onCellSave, onFlushNow]);

  // ── Click handler — single vs double click ─────────────────
  const handleCellClick = useCallback((ri: number, ci: number) => {
    if (clickRef.current) {
      clearTimeout(clickRef.current);
      clickRef.current = null;
      // double click → edit
      if (canEdit && columns[ci]?.editable !== false && columns[ci]?.type !== 'readonly') {
        setAC({ ri, ci, editing: true });
      }
    } else {
      clickRef.current = setTimeout(() => {
        clickRef.current = null;
        setAC(prev =>
          prev?.ri === ri && prev.ci === ci && !prev.editing
            ? { ri, ci, editing: false }  // same cell — keep selected
            : { ri, ci, editing: false }  // new cell
        );
        containerRef.current?.focus();
      }, 220);
    }
  }, [canEdit, columns]);

  // After cell saves — move focus down
  const handleCellCommit = useCallback((ri: number, ci: number, rowId: string, field: string, value: any) => {
    onCellSave(rowId, field, value);
    const nR = rows.length;
    setAC({ ri: Math.min(nR - 1, ri + 1), ci, editing: false });
    containerRef.current?.focus();
  }, [onCellSave, rows.length]);

  const handleCellCancel = useCallback((ri: number, ci: number) => {
    setAC({ ri, ci, editing: false });
    containerRef.current?.focus();
  }, []);

  // ── Selection ──────────────────────────────────────────────
  const toggleSelect = (id: string) =>
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () =>
    setSelected(s => s.size === rows.length ? new Set() : new Set(rows.map(r => r.id)));

  // ── Add row ────────────────────────────────────────────────
  async function addRow() {
    if (!newName.trim()) return;
    setRowSaving(true);
    try {
      await onAddRow({ name: newName.trim(), unitId: newUnit || null });
      setNewName(''); setNewUnit(''); setAddingRow(false);
    } finally { setRowSaving(false); }
  }

  // ── Delete ─────────────────────────────────────────────────
  async function deleteSelected() {
    if (!selected.size) return;
    if (!confirm(`Delete ${selected.size} row(s)? (soft delete)`)) return;
    await onDeleteRows([...selected]);
    setSelected(new Set());
  }

  const isSaving = saving || rowSaving;

  return (
    <div
      ref={containerRef}
      className="flex flex-col h-full outline-none"
      tabIndex={0}
    >

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div className="flex items-center gap-2.5 px-4 py-2 bg-[var(--surface)] border-b border-[var(--border)] flex-shrink-0 min-h-[40px]">
        {selected.size > 0 && (
          <>
            <span className="text-[12px] font-semibold text-blue-400">{selected.size} selected</span>
            <button onClick={deleteSelected} className="pes-btn-ghost text-xs py-1 text-red-400 hover:bg-red-500/8">🗑 Delete</button>
            <button onClick={() => setSelected(new Set())} className="pes-btn-ghost text-xs py-1">✕ Deselect</button>
            <div className="w-px h-4 bg-[#1f2d45]" />
          </>
        )}
        {canEdit && (
          <button
            onClick={() => { setAddingRow(true); setTimeout(() => addRef.current?.focus(), 60); }}
            className="pes-btn-ghost text-xs py-1 text-green-400 hover:bg-green-500/8"
          >
            + Add Row
          </button>
        )}
        <div className="flex-1" />
        <span className={`flex items-center gap-1.5 text-[11.5px] transition-colors ${isSaving ? 'text-amber-400' : 'text-[var(--text-3)]'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${isSaving ? 'bg-amber-400 animate-pulse' : 'bg-slate-700'}`} />
          {isSaving ? 'Saving…' : totalRows !== undefined ? `${rows.length} / ${totalRows} rows` : `${rows.length} rows`}
        </span>
        <span className="text-[9.5px] text-[var(--text-3)] hidden 2xl:block tracking-widest uppercase">
          dbl-click · F2 · Tab · Esc · Ctrl+S
        </span>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-auto">
        <table
          className="border-collapse text-[12.5px]"
          style={{ minWidth: columns.reduce((s, c) => s + c.width, 100) + 88 }}
        >
          <thead className="sticky top-0 z-20">
            <tr className="bg-[var(--surface)]">
              <th className="border-b border-r border-[var(--border)] w-10 px-2 py-2.5 text-center">
                <input type="checkbox" checked={selected.size === rows.length && rows.length > 0} onChange={toggleAll} className="accent-blue-500 cursor-pointer" />
              </th>
              <th className="border-b border-r border-[var(--border)] w-8 text-center text-[9.5px] text-[var(--text-3)] font-bold">#</th>
              {columns.map(col => (
                <th
                  key={col.key}
                  style={{ width: col.width, minWidth: col.width }}
                  className="border-b border-r border-[var(--border)] px-3 py-2.5 text-left text-[9.5px] font-bold uppercase tracking-widest text-[var(--text-3)] whitespace-nowrap select-none"
                >
                  {col.header}
                </th>
              ))}
              <th className="border-b border-[var(--border)] w-10" />
            </tr>
          </thead>

          <tbody>
            {rows.map((row, ri) => (
              <GRow
                key={row.id}
                row={row} ri={ri} columns={columns} ac={ac}
                isSelected={selected.has(row.id)}
                canEdit={canEdit}
                onCellClick={handleCellClick}
                onCellCommit={handleCellCommit}
                onCellCancel={handleCellCancel}
                onToggle={() => toggleSelect(row.id)}
              />
            ))}

            {/* Add row input */}
            {addingRow && (
              <tr className="bg-green-500/5 border-b border-[var(--border)]">
                <td className="border-r border-[var(--border)] px-2 text-center w-10">
                  <input type="checkbox" disabled className="opacity-20" />
                </td>
                <td className="border-r border-[var(--border)] w-8 text-center text-[10px] text-[var(--text-3)]">{rows.length + 1}</td>
                <td colSpan={3} className="border-r border-[var(--border)] px-3 py-1.5">
                  <input
                    ref={addRef}
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addRow();
                      if (e.key === 'Escape') { setAddingRow(false); setNewName(''); setNewUnit(''); }
                      e.stopPropagation();
                    }}
                    placeholder="Task name… (Enter to add, Esc to cancel)"
                    className="w-full bg-transparent outline-none text-[var(--text)] placeholder-slate-700 text-[13px]"
                    autoComplete="off"
                  />
                </td>
                <td className="border-r border-[var(--border)] px-2 py-1.5">
                  <select value={newUnit} onChange={e => setNewUnit(e.target.value)} className="bg-transparent text-[var(--text-2)] text-[12px] outline-none w-full">
                    <option value="">Unit…</option>
                    {units.map(u => <option key={u.id} value={u.id}>{u.code ?? u.label}</option>)}
                  </select>
                </td>
                <td colSpan={Math.max(1, columns.length - 4)} />
                <td className="px-2 py-1">
                  <div className="flex gap-1">
                    <button onClick={addRow} disabled={!newName.trim() || rowSaving}
                      className="text-[11px] px-2.5 py-1 rounded bg-green-500/20 text-green-400 hover:bg-green-500/30 disabled:opacity-40">
                      ✓ Add
                    </button>
                    <button onClick={() => { setAddingRow(false); setNewName(''); setNewUnit(''); }}
                      className="text-[11px] px-2 py-1 rounded hover:bg-[var(--surface-3)] text-[var(--text-3)]">
                      ✕
                    </button>
                  </div>
                </td>
              </tr>
            )}

            {rows.length === 0 && !addingRow && (
              <tr><td colSpan={columns.length + 3} className="py-20 text-center">
                <div className="text-4xl mb-2 opacity-20">📋</div>
                <div className="text-[var(--text-3)] text-[13px]">No rows. Click <strong className="text-[var(--text-3)]">+ Add Row</strong> to start.</div>
              </td></tr>
            )}
          </tbody>
        </table>

        {hasMore && onLoadMore && (
          <div className="flex justify-center py-4 border-t border-[var(--border)]">
            <button onClick={onLoadMore} className="pes-btn-ghost text-xs">Load More ↓</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  GRow — memoized row
// ═══════════════════════════════════════════════════════════════
const GRow = memo(function GRow({
  row, ri, columns, ac, isSelected, canEdit,
  onCellClick, onCellCommit, onCellCancel, onToggle,
}: {
  row: GridRow; ri: number; columns: GridColumn[]; ac: AC | null;
  isSelected: boolean; canEdit: boolean;
  onCellClick:   (ri: number, ci: number) => void;
  onCellCommit:  (ri: number, ci: number, id: string, field: string, val: any) => void;
  onCellCancel:  (ri: number, ci: number) => void;
  onToggle: () => void;
}) {
  const isActiveRow = ac?.ri === ri;

  return (
    <tr className={`border-b border-[#10151e] group transition-colors ${
      isSelected ? 'bg-blue-500/6' : isActiveRow ? 'bg-[var(--surface-2)]' : 'hover:bg-[var(--surface)]'
    }`}>
      <td className="border-r border-[#10151e] px-2 w-10 text-center">
        <input type="checkbox" checked={isSelected} onChange={onToggle}
          className="accent-blue-500 cursor-pointer" onClick={e => e.stopPropagation()} />
      </td>
      <td className="border-r border-[#10151e] w-8 text-center text-[10px] text-[var(--text-3)] select-none">{ri + 1}</td>

      {columns.map((col, ci) => {
        const isThis    = ac?.ri === ri && ac.ci === ci;
        const isEditing = isThis && ac?.editing;
        const editable  = canEdit && col.editable !== false && col.type !== 'readonly';

        return (
          <td
            key={col.key}
            style={{ width: col.width, minWidth: col.width, maxWidth: col.width + 24 }}
            className={`border-r border-[#10151e] relative overflow-visible ${
              isThis ? 'ring-2 ring-inset ring-blue-500/70 z-10 bg-[var(--surface-2)]' : ''
            }`}
            onClick={() => onCellClick(ri, ci)}
          >
            {isEditing
              ? <EditCell col={col} value={row[col.key]}
                  onSave={v => onCellCommit(ri, ci, row.id, col.key, v)}
                  onCancel={() => onCellCancel(ri, ci)} />
              : <DCell col={col} value={row[col.key]} row={row} isActive={isThis} />
            }
          </td>
        );
      })}

      <td className="w-10 px-1 text-center">
        <Link href={`/orders/${row.id}`} onClick={e => e.stopPropagation()}>
          <button className="opacity-0 group-hover:opacity-100 w-7 h-7 rounded text-[var(--text-3)] hover:text-blue-400 hover:bg-[var(--surface-3)] transition-all text-[12px]">→</button>
        </Link>
      </td>
    </tr>
  );
});

// ═══════════════════════════════════════════════════════════════
//  DCell — display mode
// ═══════════════════════════════════════════════════════════════
function DCell({ col, value, row, isActive }: { col: GridColumn; value: any; row: GridRow; isActive: boolean }) {
  if (col.render) return <div className="px-2.5 py-1.5 min-h-[30px] flex items-center">{col.render(row, value)}</div>;

  const empty = value === null || value === undefined || value === '';
  if (empty) return (
    <div className="px-2.5 py-1.5 h-[30px] flex items-center text-[11px] text-[var(--text-3)]">
      {isActive ? 'dbl-click' : '—'}
    </div>
  );

  switch (col.type) {
    case 'select': {
      const opt = col.options?.find(o => o.value === value);
      return (
        <div className="px-2 py-1 flex items-center min-h-[30px]">
          <span className="text-[11.5px] px-1.5 py-0.5 rounded font-semibold whitespace-nowrap"
            style={opt?.color ? { background: `${opt.color}20`, color: opt.color } : { background: '#1c2540', color: '#9ca3af' }}>
            {opt?.label ?? value}
          </span>
        </div>
      );
    }
    case 'percent': {
      const pct = typeof value === 'number' ? value : parseInt(value) || 0;
      const c = pct === 100 ? '#10b981' : pct >= 70 ? '#3b82f6' : pct >= 40 ? '#f59e0b' : '#6b7280';
      return (
        <div className="px-2.5 py-1.5 flex items-center gap-2 min-h-[30px]">
          <div className="flex-1 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
            <div className="h-full rounded-full" style={{ width: `${pct}%`, background: c }} />
          </div>
          <span className="text-[11px] w-7 text-right flex-shrink-0" style={{ color: c }}>{pct}%</span>
        </div>
      );
    }
    case 'date': {
      const d = new Date(value);
      return (
        <div className="px-2.5 py-1.5 text-[12px] text-[var(--text-2)] min-h-[30px] flex items-center">
          {isNaN(d.getTime()) ? value : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
        </div>
      );
    }
    case 'number':
      return <div className="px-2.5 py-1.5 text-[12px] text-[var(--text-2)] text-right min-h-[30px] flex items-center justify-end">{value}</div>;
    default:
      return <div className="px-2.5 py-1.5 text-[12.5px] text-[var(--text)] truncate min-h-[30px] flex items-center">{String(value)}</div>;
  }
}

// ═══════════════════════════════════════════════════════════════
//  EditCell — edit mode
// ═══════════════════════════════════════════════════════════════
function EditCell({ col, value, onSave, onCancel }: {
  col: GridColumn; value: any; onSave: (v: any) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState<any>(
    value ?? (col.type === 'percent' || col.type === 'number' ? 0 : '')
  );
  const ref = useRef<any>(null);

  useEffect(() => { requestAnimationFrame(() => ref.current?.focus?.()); }, []);

  function commit(v: any = draft) { onSave(v === '' ? null : v); }

  function onKey(e: React.KeyboardEvent) {
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); onCancel(); }
    else if (e.key === 'Enter' && col.type !== 'select') { e.preventDefault(); commit(); }
    else if (e.key === 'Tab')  { e.preventDefault(); commit(); }
  }

  const base = 'w-full h-full min-h-[30px] px-2.5 py-1.5 bg-[var(--surface-2)] text-[var(--text)] outline-none border-none text-[12.5px]';

  switch (col.type) {
    case 'select':
      return (
        <select ref={ref} value={draft ?? ''} autoFocus
          onChange={e => { const v = e.target.value || null; setDraft(v); onSave(v); }}
          onKeyDown={onKey} onBlur={() => commit()} className={`${base} cursor-pointer`}
        >
          <option value="">— None —</option>
          {col.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
    case 'date':
      return <input ref={ref} type="date" value={draft ?? ''} autoFocus onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => commit()} className={base} style={{ colorScheme: 'dark' }} />;
    case 'percent':
      return <input ref={ref} type="number" min={0} max={100} value={draft} autoFocus onChange={e => setDraft(Math.min(100, Math.max(0, Number(e.target.value))))} onKeyDown={onKey} onBlur={() => commit()} className={`${base} text-right`} />;
    case 'number':
      return <input ref={ref} type="number" value={draft} autoFocus onChange={e => setDraft(Number(e.target.value))} onKeyDown={onKey} onBlur={() => commit()} className={`${base} text-right`} />;
    default:
      return <input ref={ref} type="text" value={draft ?? ''} autoFocus onChange={e => setDraft(e.target.value)} onKeyDown={onKey} onBlur={() => commit()} className={base} />;
  }
}
