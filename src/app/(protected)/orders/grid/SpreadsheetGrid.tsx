'use client';
// src/app/(protected)/orders/grid/SpreadsheetGrid.tsx
// Excel-like inline editable grid with keyboard navigation, dirty tracking, and API save

import { useState, useRef, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import { RAGDot, Spinner } from '@/components/ui/badges';
import type { RAGStatus } from '@/types';

// ── Column definitions ─────────────────────────────────────────
type CellType = 'text' | 'select' | 'date' | 'number' | 'readonly';

interface ColDef {
  key:       string;
  label:     string;
  width:     number;
  type:      CellType;
  options?:  string[];
  optionKey?: string;   // key on lookup objects
  sticky?:   boolean;
  readOnly?: boolean;
  align?:    'left' | 'center' | 'right';
}

const STATUS_OPTIONS  = ['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED'];
const STATUS_LABELS: Record<string, string> = {
  NOT_STARTED:'Not Started', IN_PROGRESS:'In Progress', UNDER_REVIEW:'Under Review',
  BLOCKED:'Blocked', ON_HOLD:'On Hold', DONE:'Done', CANCELLED:'Cancelled',
};
const STATUS_COLORS: Record<string, string> = {
  NOT_STARTED:'#6b7280', IN_PROGRESS:'#3b82f6', UNDER_REVIEW:'#f59e0b',
  BLOCKED:'#ef4444', ON_HOLD:'#9ca3af', DONE:'#10b981', CANCELLED:'#374151',
};
const PRIORITY_OPTIONS = ['LOW','MEDIUM','HIGH','CRITICAL'];
const PRIORITY_COLORS: Record<string, string> = { LOW:'#6b7280', MEDIUM:'#f59e0b', HIGH:'#f87171', CRITICAL:'#ef4444' };
const TYPE_OPTIONS  = ['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK'];
const PCT_OPTIONS   = [0,10,20,30,40,50,60,70,80,90,100].map(String);

// ── Types ──────────────────────────────────────────────────────
interface OrderRow {
  id: string; orderCode: string; type: string; name: string;
  unitId: string|null; unitCode: string|null; unitName: string|null; unitColor: string|null;
  projectId: string|null; projectCode: string|null; projectName: string|null;
  ownerId: string|null; ownerName: string|null;
  priority: string; status: string;
  startDate: string|null; dueDate: string|null;
  percentComplete: number; rescheduleCount: number;
  notes: string|null; links: string|null; dependencies: string|null;
  updatedAt: string; effectiveRAG: RAGStatus; isOverdue: boolean;
  _dirty?: boolean;
  _new?: boolean;
  _deleted?: boolean;
}

interface Props {
  initialOrders: OrderRow[];
  units:    { id: string; code: string; name: string; colorHex: string|null }[];
  projects: { id: string; code: string; name: string }[];
  users:    { id: string; name: string; email: string }[];
  canEdit: boolean; canCreate: boolean; canDelete: boolean;
  currentUserId: string;
}

type CellCoord = { rowIdx: number; colIdx: number };

// ── Toast notification ─────────────────────────────────────────
function useToast() {
  const [toasts, setToasts] = useState<{ id: number; msg: string; type: 'success'|'error'|'info' }[]>([]);
  const show = useCallback((msg: string, type: 'success'|'error'|'info' = 'info') => {
    const id = Date.now();
    setToasts(t => [...t, { id, msg, type }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500);
  }, []);
  return { toasts, show };
}

// ── Main Component ─────────────────────────────────────────────
export default function SpreadsheetGrid({
  initialOrders, units, projects, users,
  canEdit, canCreate, canDelete,
}: Props) {
  const [rows, setRows]             = useState<OrderRow[]>(initialOrders);
  const [saving, setSaving]         = useState(false);
  const [activeCell, setActiveCell] = useState<CellCoord|null>(null);
  const [editingCell, setEditingCell] = useState<CellCoord|null>(null);
  const [search, setSearch]         = useState('');
  const [filterStatus, setFilterStatus]   = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterUnit, setFilterUnit]         = useState('');
  const [sortKey, setSortKey]       = useState<string>('');
  const [sortDir, setSortDir]       = useState<'asc'|'desc'>('asc');
  const { toasts, show: toast }     = useToast();
  const gridRef = useRef<HTMLDivElement>(null);

  // ── Column definitions ───────────────────────────────────────
  const COLS: ColDef[] = useMemo(() => [
    { key: 'orderCode',       label: 'ID',       width: 100, type: 'readonly', sticky: true, readOnly: true },
    { key: 'name',            label: 'Name',     width: 280, type: 'text' },
    { key: 'type',            label: 'Type',     width: 110, type: 'select', options: TYPE_OPTIONS },
    { key: 'unitCode',        label: 'Unit',     width: 90,  type: 'select', optionKey: 'unitCode' },
    { key: 'projectCode',     label: 'Project',  width: 120, type: 'select', optionKey: 'projectCode' },
    { key: 'ownerName',       label: 'Owner',    width: 130, type: 'select', optionKey: 'ownerName' },
    { key: 'priority',        label: 'Priority', width: 100, type: 'select', options: PRIORITY_OPTIONS },
    { key: 'status',          label: 'Status',   width: 135, type: 'select', options: STATUS_OPTIONS },
    { key: 'percentComplete', label: '%',        width: 70,  type: 'select', options: PCT_OPTIONS, align: 'center' },
    { key: 'startDate',       label: 'Start',    width: 115, type: 'date' },
    { key: 'dueDate',         label: 'Due',      width: 115, type: 'date' },
    { key: 'effectiveRAG',    label: 'RAG',      width: 60,  type: 'readonly', align: 'center' },
    { key: 'notes',           label: 'Notes',    width: 200, type: 'text' },
    { key: 'links',           label: 'Links',    width: 160, type: 'text' },
  ], []);

  // ── Filtered/sorted rows ─────────────────────────────────────
  const filteredRows = useMemo(() => {
    let r = rows.filter(o => !o._deleted);
    if (search)         r = r.filter(o => o.name.toLowerCase().includes(search.toLowerCase()) || o.orderCode.toLowerCase().includes(search.toLowerCase()) || (o.ownerName??'').toLowerCase().includes(search.toLowerCase()));
    if (filterStatus)   r = r.filter(o => o.status === filterStatus);
    if (filterPriority) r = r.filter(o => o.priority === filterPriority);
    if (filterUnit)     r = r.filter(o => o.unitCode === filterUnit);
    if (sortKey) {
      r = [...r].sort((a, b) => {
        const av = String((a as any)[sortKey] ?? '');
        const bv = String((b as any)[sortKey] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      });
    }
    return r;
  }, [rows, search, filterStatus, filterPriority, filterUnit, sortKey, sortDir]);

  const dirtyCount  = rows.filter(r => r._dirty || r._new).length;
  const newRowCount = rows.filter(r => r._new).length;

  // ── Cell editing ─────────────────────────────────────────────
  const startEdit = useCallback((rowIdx: number, colIdx: number) => {
    if (!canEdit) return;
    const col = COLS[colIdx];
    if (col?.readOnly || col?.type === 'readonly') return;
    setEditingCell({ rowIdx, colIdx });
    setActiveCell({ rowIdx, colIdx });
  }, [canEdit, COLS]);

  const stopEdit = useCallback(() => {
    setEditingCell(null);
  }, []);

  const commitValue = useCallback((rowIdx: number, colIdx: number, rawValue: string) => {
    const col = COLS[colIdx];
    const row = filteredRows[rowIdx];
    if (!row) return;

    let value: string | number = rawValue;
    if (col.key === 'percentComplete') value = parseInt(rawValue) || 0;

    // Resolve ID fields from display values
    let updates: Partial<OrderRow> = {};
    if (col.key === 'unitCode') {
      const u = units.find(x => x.code === rawValue);
      updates = { unitCode: u?.code ?? null, unitId: u?.id ?? null, unitName: u?.name ?? null, unitColor: u?.colorHex ?? null };
    } else if (col.key === 'projectCode') {
      const p = projects.find(x => x.code === rawValue);
      updates = { projectCode: p?.code ?? null, projectId: p?.id ?? null, projectName: p?.name ?? null };
    } else if (col.key === 'ownerName') {
      const u = users.find(x => x.name === rawValue);
      updates = { ownerName: u?.name ?? null, ownerId: u?.id ?? null };
    } else {
      updates = { [col.key]: value } as any;
    }

    setRows(prev => prev.map(r => {
      if (r.id !== row.id) return r;
      return { ...r, ...updates, _dirty: true };
    }));
  }, [filteredRows, COLS, units, projects, users]);

  // ── Keyboard navigation ───────────────────────────────────────
  const handleKeyDown = useCallback((e: React.KeyboardEvent, rowIdx: number, colIdx: number) => {
    if (editingCell) {
      if (e.key === 'Escape') { stopEdit(); return; }
      if (e.key === 'Tab') {
        e.preventDefault();
        stopEdit();
        const nextCol = e.shiftKey ? colIdx - 1 : colIdx + 1;
        if (nextCol >= 0 && nextCol < COLS.length) {
          setActiveCell({ rowIdx, colIdx: nextCol });
          startEdit(rowIdx, nextCol);
        }
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        stopEdit();
        const nextRow = e.shiftKey ? rowIdx - 1 : rowIdx + 1;
        if (nextRow >= 0 && nextRow < filteredRows.length) {
          setActiveCell({ rowIdx: nextRow, colIdx });
          startEdit(nextRow, colIdx);
        }
        return;
      }
      return;
    }

    // Not editing
    const move = (r: number, c: number) => {
      const nr = Math.max(0, Math.min(filteredRows.length - 1, rowIdx + r));
      const nc = Math.max(0, Math.min(COLS.length - 1, colIdx + c));
      setActiveCell({ rowIdx: nr, colIdx: nc });
    };

    switch (e.key) {
      case 'ArrowUp':    e.preventDefault(); move(-1, 0); break;
      case 'ArrowDown':  e.preventDefault(); move(1,  0); break;
      case 'ArrowLeft':  e.preventDefault(); move(0, -1); break;
      case 'ArrowRight': e.preventDefault(); move(0,  1); break;
      case 'Tab':        e.preventDefault(); move(0, e.shiftKey ? -1 : 1); break;
      case 'Enter':
        e.preventDefault();
        if (!editingCell) startEdit(rowIdx, colIdx);
        else { stopEdit(); move(1, 0); }
        break;
      case 'F2':
        e.preventDefault(); startEdit(rowIdx, colIdx); break;
      case 'Delete':
      case 'Backspace':
        if (!editingCell) {
          commitValue(rowIdx, colIdx, '');
        }
        break;
      default:
        // Start typing to begin edit (for text/select cells)
        if (e.key.length === 1 && !e.ctrlKey && !e.metaKey) {
          startEdit(rowIdx, colIdx);
        }
    }
  }, [editingCell, COLS, filteredRows.length, startEdit, stopEdit, commitValue]);

  // ── Add new row ───────────────────────────────────────────────
  function addNewRow() {
    if (!canCreate) return;
    const tempId = `NEW-${Date.now()}`;
    const newRow: OrderRow = {
      id: tempId, orderCode: '(new)', type: 'TASK', name: '',
      unitId: null, unitCode: null, unitName: null, unitColor: null,
      projectId: null, projectCode: null, projectName: null,
      ownerId: null, ownerName: null,
      priority: 'MEDIUM', status: 'NOT_STARTED',
      startDate: null, dueDate: null, percentComplete: 0,
      rescheduleCount: 0, notes: null, links: null, dependencies: null,
      updatedAt: new Date().toISOString(), effectiveRAG: 'GREY', isOverdue: false,
      _new: true, _dirty: true,
    };
    setRows(prev => [newRow, ...prev]);
    setTimeout(() => {
      setActiveCell({ rowIdx: 0, colIdx: 1 }); // focus Name column
      startEdit(0, 1);
    }, 50);
  }

  // ── Delete row ────────────────────────────────────────────────
  function markDelete(rowId: string) {
    if (!canDelete) return;
    if (!confirm('Delete this order?')) return;
    setRows(prev => prev.map(r => r.id === rowId ? { ...r, _deleted: true } : r));
    toast('Row marked for deletion — save to apply', 'info');
  }

  // ── Save all changes ──────────────────────────────────────────
  async function saveAll() {
    if (!canEdit && !canCreate) return;
    const toCreate = rows.filter(r => r._new && !r._deleted && r.name.trim());
    const toUpdate = rows.filter(r => r._dirty && !r._new && !r._deleted);
    const toDelete = rows.filter(r => r._deleted && !r._new);

    if (!toCreate.length && !toUpdate.length && !toDelete.length) {
      toast('Nothing to save', 'info'); return;
    }

    setSaving(true);
    let saved = 0, failed = 0;

    try {
      // CREATE
      for (const r of toCreate) {
        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: r.type, name: r.name.trim(),
            unitId: r.unitId, projectId: r.projectId, ownerId: r.ownerId,
            priority: r.priority, status: r.status,
            startDate: r.startDate, dueDate: r.dueDate,
            percentComplete: r.percentComplete,
            notes: r.notes, links: r.links,
          }),
        });
        if (res.ok) {
          const { data } = await res.json();
          setRows(prev => prev.map(x =>
            x.id === r.id ? { ...x, ...data, unitCode: data.unit?.code, orderCode: data.orderCode, _new: false, _dirty: false } : x
          ));
          saved++;
        } else { failed++; }
      }

      // UPDATE
      for (const r of toUpdate) {
        const res = await fetch(`/api/orders/${r.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: r.name, type: r.type,
            unitId: r.unitId, projectId: r.projectId, ownerId: r.ownerId,
            priority: r.priority, status: r.status,
            startDate: r.startDate, dueDate: r.dueDate,
            percentComplete: r.percentComplete,
            notes: r.notes, links: r.links,
          }),
        });
        if (res.ok) {
          setRows(prev => prev.map(x => x.id === r.id ? { ...x, _dirty: false } : x));
          saved++;
        } else { failed++; }
      }

      // DELETE
      for (const r of toDelete) {
        const res = await fetch(`/api/orders/${r.id}`, { method: 'DELETE' });
        if (res.ok) {
          setRows(prev => prev.filter(x => x.id !== r.id));
          saved++;
        } else { failed++; }
      }

      if (failed === 0)  toast(`✅ Saved ${saved} changes`, 'success');
      else               toast(`⚠ ${saved} saved, ${failed} failed`, 'error');
    } catch {
      toast('Save failed — check connection', 'error');
    } finally {
      setSaving(false);
    }
  }

  function discardAll() {
    if (!confirm('Discard all unsaved changes?')) return;
    setRows(initialOrders);
    setEditingCell(null);
    setActiveCell(null);
    toast('Changes discarded', 'info');
  }

  function toggleSort(key: string) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-90px)] space-y-3">

      {/* ── Header ────────────────────────────────────────────── */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-2xl text-[var(--text)]">Grid Editor</h1>
          <p className="text-sm text-[var(--text-3)] mt-0.5">
            Excel-like editing · {filteredRows.length} rows · {dirtyCount > 0 ? <span className="text-amber-400 font-semibold">{dirtyCount} unsaved changes</span> : 'No unsaved changes'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/orders">
            <button className="pes-btn-ghost text-xs">↗ Table View</button>
          </Link>
          {canCreate && (
            <button onClick={addNewRow} className="pes-btn-ghost text-xs">+ Add Row</button>
          )}
          {dirtyCount > 0 && (
            <>
              <button onClick={discardAll} className="pes-btn-ghost text-xs text-[var(--text-3)]">✕ Discard</button>
              <button onClick={saveAll} disabled={saving} className="pes-btn-primary text-xs">
                {saving ? <Spinner size={14} /> : `💾 Save All (${dirtyCount})`}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Filter bar ────────────────────────────────────────── */}
      <div className="pes-card px-4 py-2.5 flex flex-wrap items-center gap-3 flex-shrink-0">
        <div className="relative">
          <input
            type="text"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="pes-input w-[200px] pl-7 py-1 text-[12.5px]"
          />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-xs pointer-events-none">🔍</span>
        </div>
        <select value={filterStatus}   onChange={e => setFilterStatus(e.target.value)}   className="pes-input py-1 text-[12.5px] w-[130px]">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="pes-input py-1 text-[12.5px] w-[115px]">
          <option value="">All Priorities</option>
          {PRIORITY_OPTIONS.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select value={filterUnit}     onChange={e => setFilterUnit(e.target.value)}     className="pes-input py-1 text-[12.5px] w-[110px]">
          <option value="">All Units</option>
          {units.map(u => <option key={u.id} value={u.code}>{u.code}</option>)}
        </select>
        {(search || filterStatus || filterPriority || filterUnit) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterPriority(''); setFilterUnit(''); }} className="text-[12px] text-[var(--text-3)] hover:text-red-400 transition-colors">
            ✕ Clear
          </button>
        )}
        <div className="ml-auto text-[11px] text-[var(--text-3)]">
          Double-click or F2 to edit · Tab/Enter to navigate · Esc to cancel
        </div>
      </div>

      {/* ── Keyboard shortcuts legend ─────────────────────────── */}
      {dirtyCount > 0 && (
        <div className="flex-shrink-0 px-1 py-1 bg-amber-500/8 border border-amber-500/20 rounded-lg flex items-center gap-4 text-[11.5px] text-amber-400/80">
          <span>⚠ <strong className="text-amber-400">{dirtyCount} unsaved</strong> — {newRowCount} new rows</span>
          <span className="text-amber-300/50">|</span>
          <span>Ctrl+S to save · Esc to cancel edit</span>
        </div>
      )}

      {/* ── Grid ──────────────────────────────────────────────── */}
      <div
        ref={gridRef}
        className="pes-card flex-1 overflow-auto relative"
        onKeyDown={e => {
          // Global Ctrl+S
          if ((e.ctrlKey || e.metaKey) && e.key === 's') {
            e.preventDefault();
            saveAll();
          }
        }}
        tabIndex={-1}
      >
        <table className="border-collapse" style={{ minWidth: COLS.reduce((a, c) => a + c.width, 60) + 'px' }}>
          {/* Column headers */}
          <thead className="sticky top-0 z-20 bg-[var(--surface)]">
            <tr>
              {/* Row number col */}
              <th className="w-10 sticky left-0 bg-[var(--surface)] z-30 px-2 border-b border-r border-[var(--border)]" />
              {COLS.map((col, ci) => (
                <th
                  key={col.key}
                  onClick={() => !col.readOnly && toggleSort(col.key)}
                  style={{ width: col.width, minWidth: col.width }}
                  className={`
                    px-2.5 py-2 text-left border-b border-r border-[var(--border)]
                    text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)]
                    select-none whitespace-nowrap
                    ${!col.readOnly ? 'cursor-pointer hover:text-[var(--text-2)] hover:bg-[var(--surface-2)]' : ''}
                    ${col.sticky ? 'sticky left-10 bg-[var(--surface)] z-10' : ''}
                  `}
                >
                  {col.label}
                  {sortKey === col.key && <span className="ml-1 text-blue-400">{sortDir === 'asc' ? '↑' : '↓'}</span>}
                </th>
              ))}
              {/* Actions col */}
              <th className="w-16 px-2 py-2 border-b border-[var(--border)] text-[10.5px] font-bold uppercase tracking-wider text-[var(--text-3)] whitespace-nowrap">Act.</th>
            </tr>
          </thead>

          <tbody>
            {filteredRows.map((row, ri) => (
              <GridRow
                key={row.id}
                row={row}
                rowIdx={ri}
                cols={COLS}
                activeCell={activeCell}
                editingCell={editingCell}
                units={units}
                projects={projects}
                users={users}
                canEdit={canEdit}
                canDelete={canDelete}
                onActivate={(ci) => setActiveCell({ rowIdx: ri, colIdx: ci })}
                onStartEdit={(ci) => startEdit(ri, ci)}
                onCommit={(ci, val) => commitValue(ri, ci, val)}
                onKeyDown={(e, ci) => handleKeyDown(e, ri, ci)}
                onDelete={() => markDelete(row.id)}
              />
            ))}

            {filteredRows.length === 0 && (
              <tr>
                <td colSpan={COLS.length + 2} className="text-center py-12 text-[var(--text-3)] text-[13px]">
                  No rows match the current filters
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Status bar ────────────────────────────────────────── */}
      <div className="flex-shrink-0 flex items-center gap-4 px-1 text-[11.5px] text-[var(--text-3)]">
        <span>{filteredRows.length} rows visible</span>
        <span>·</span>
        <span>{rows.filter(r => r.status === 'IN_PROGRESS').length} in progress</span>
        <span>·</span>
        <span className="text-red-400/70">{rows.filter(r => r.isOverdue).length} overdue</span>
        <span>·</span>
        <span className="text-green-400/70">{rows.filter(r => r.status === 'DONE').length} done</span>
        {activeCell && (
          <>
            <span>·</span>
            <span className="text-blue-400/70">
              {filteredRows[activeCell.rowIdx]?.orderCode} · {COLS[activeCell.colIdx]?.label}
            </span>
          </>
        )}
      </div>

      {/* ── Toasts ────────────────────────────────────────────── */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className={`
              px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-2xl pointer-events-auto
              animate-[fadeInUp_0.2s_ease]
              ${t.type === 'success' ? 'bg-green-900/90 text-green-300 border border-green-700' :
                t.type === 'error'   ? 'bg-red-900/90 text-red-300 border border-red-700' :
                                       'bg-[var(--surface-3)] text-[var(--text-2)] border border-[var(--border-2)]'}
            `}
          >
            {t.msg}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── GridRow ────────────────────────────────────────────────────
interface GridRowProps {
  row:        OrderRow;
  rowIdx:     number;
  cols:       ColDef[];
  activeCell: CellCoord|null;
  editingCell: CellCoord|null;
  units:      { id: string; code: string; name: string; colorHex: string|null }[];
  projects:   { id: string; code: string; name: string }[];
  users:      { id: string; name: string; email: string }[];
  canEdit:    boolean;
  canDelete:  boolean;
  onActivate: (ci: number) => void;
  onStartEdit: (ci: number) => void;
  onCommit:   (ci: number, val: string) => void;
  onKeyDown:  (e: React.KeyboardEvent, ci: number) => void;
  onDelete:   () => void;
}

function GridRow({ row, rowIdx, cols, activeCell, editingCell, units, projects, users, canEdit, canDelete, onActivate, onStartEdit, onCommit, onKeyDown, onDelete }: GridRowProps) {
  const isNewRow = row._new;
  const isDirty  = row._dirty;

  return (
    <tr
      className={`
        border-b border-[var(--border)] group
        ${isNewRow ? 'bg-blue-500/5' : isDirty ? 'bg-amber-500/5' : ''}
        ${row.isOverdue ? 'border-l-2 border-l-red-500/40' : ''}
      `}
    >
      {/* Row number */}
      <td className="sticky left-0 bg-inherit z-10 w-10 px-2 py-0 border-r border-[var(--border)] text-center">
        <span className="text-[10.5px] text-[var(--text-3)]">{rowIdx + 1}</span>
        {isDirty && !isNewRow && <span className="block text-[8px] text-amber-500 leading-none">●</span>}
        {isNewRow && <span className="block text-[8px] text-blue-400 leading-none">+</span>}
      </td>

      {/* Data cells */}
      {cols.map((col, ci) => {
        const isActive  = activeCell?.rowIdx  === rowIdx && activeCell?.colIdx  === ci;
        const isEditing = editingCell?.rowIdx === rowIdx && editingCell?.colIdx === ci;

        return (
          <GridCell
            key={col.key}
            row={row}
            col={col}
            colIdx={ci}
            isActive={isActive}
            isEditing={isEditing}
            units={units}
            projects={projects}
            users={users}
            canEdit={canEdit}
            onActivate={() => onActivate(ci)}
            onStartEdit={() => onStartEdit(ci)}
            onCommit={(v) => onCommit(ci, v)}
            onKeyDown={(e) => onKeyDown(e, ci)}
          />
        );
      })}

      {/* Actions */}
      <td className="px-2 py-1 border-r border-[var(--border)]">
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Link href={`/orders/${row.id}`} title="View detail">
            <button className="w-6 h-6 rounded text-[11px] text-[var(--text-3)] hover:text-blue-400 hover:bg-[var(--surface-3)] transition-colors">↗</button>
          </Link>
          {canDelete && !isNewRow && (
            <button onClick={onDelete} title="Delete row" className="w-6 h-6 rounded text-[11px] text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors">✕</button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── GridCell ───────────────────────────────────────────────────
interface GridCellProps {
  row:      OrderRow;
  col:      ColDef;
  colIdx:   number;
  isActive: boolean;
  isEditing: boolean;
  units:    { id: string; code: string; name: string; colorHex: string|null }[];
  projects: { id: string; code: string; name: string }[];
  users:    { id: string; name: string; email: string }[];
  canEdit:  boolean;
  onActivate:  () => void;
  onStartEdit: () => void;
  onCommit:    (v: string) => void;
  onKeyDown:   (e: React.KeyboardEvent) => void;
}

function GridCell({ row, col, isActive, isEditing, units, projects, users, canEdit, onActivate, onStartEdit, onCommit, onKeyDown }: GridCellProps) {
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement>(null);
  const rawVal = (row as any)[col.key];

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      if (inputRef.current instanceof HTMLInputElement) inputRef.current.select();
    }
  }, [isEditing]);

  // Build select options
  const selectOptions: string[] = useMemo(() => {
    if (col.options) return col.options;
    if (col.optionKey === 'unitCode')    return ['', ...units.map(u => u.code)];
    if (col.optionKey === 'projectCode') return ['', ...projects.map(p => p.code)];
    if (col.optionKey === 'ownerName')   return ['', ...users.map(u => u.name)];
    return [];
  }, [col, units, projects, users]);

  const displayVal = useMemo(() => {
    if (col.key === 'percentComplete') return `${rawVal ?? 0}%`;
    if (col.key === 'effectiveRAG')    return null; // rendered as RAGDot
    if (col.key === 'status')          return STATUS_LABELS[rawVal] ?? rawVal;
    if (col.key === 'startDate' || col.key === 'dueDate') {
      return rawVal ? new Date(rawVal).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }) : '—';
    }
    return rawVal ?? '';
  }, [col, rawVal]);

  const cellStyle: React.CSSProperties = {
    width: col.width,
    minWidth: col.width,
    maxWidth: col.width,
  };

  return (
    <td
      style={cellStyle}
      tabIndex={0}
      onClick={onActivate}
      onDoubleClick={onStartEdit}
      onFocus={onActivate}
      onKeyDown={onKeyDown}
      className={`
        border-r border-[var(--border)] px-0 py-0 text-[13px]
        overflow-hidden relative
        ${isActive  ? 'outline outline-2 outline-blue-500 outline-offset-[-2px] z-10' : ''}
        ${col.sticky ? 'sticky left-10 bg-inherit z-10' : ''}
        ${canEdit && col.type !== 'readonly' ? 'cursor-cell' : 'cursor-default'}
        ${col.align === 'center' ? 'text-center' : ''}
      `}
    >
      {isEditing && col.type !== 'readonly' ? (
        /* ── EDIT MODE ─── */
        col.type === 'select' ? (
          <select
            ref={inputRef as any}
            defaultValue={rawVal ?? ''}
            onChange={e => onCommit(e.target.value)}
            onBlur={e => onCommit(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full h-full px-2.5 py-1.5 bg-[#0d1929] text-[var(--text)] text-[13px] border-0 outline-none"
          >
            {selectOptions.map(o => (
              <option key={o} value={o}>
                {col.key === 'status' ? (STATUS_LABELS[o] || o) : o || '—'}
              </option>
            ))}
          </select>
        ) : col.type === 'date' ? (
          <input
            ref={inputRef as any}
            type="date"
            defaultValue={rawVal ?? ''}
            onChange={e => onCommit(e.target.value)}
            onBlur={e => onCommit(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full h-full px-2.5 py-1.5 bg-[#0d1929] text-[var(--text)] text-[13px] border-0 outline-none"
          />
        ) : (
          <input
            ref={inputRef as any}
            type="text"
            defaultValue={rawVal ?? ''}
            onBlur={e => onCommit(e.target.value)}
            onKeyDown={onKeyDown}
            className="w-full h-full px-2.5 py-1.5 bg-[#0d1929] text-[var(--text)] text-[13px] border-0 outline-none"
          />
        )
      ) : (
        /* ── VIEW MODE ─── */
        <div className="px-2.5 py-1.5 overflow-hidden truncate h-full min-h-[32px] flex items-center">
          {col.key === 'effectiveRAG' ? (
            <RAGDot rag={rawVal as RAGStatus} />
          ) : col.key === 'orderCode' ? (
            <span className="font-display text-[11.5px] text-blue-400 font-semibold whitespace-nowrap">{rawVal}</span>
          ) : col.key === 'status' && rawVal ? (
            <span className="text-[11.5px] font-semibold" style={{ color: STATUS_COLORS[rawVal] }}>
              {STATUS_LABELS[rawVal]}
            </span>
          ) : col.key === 'priority' && rawVal ? (
            <span className="text-[11.5px] font-semibold" style={{ color: PRIORITY_COLORS[rawVal] }}>
              {rawVal}
            </span>
          ) : col.key === 'percentComplete' ? (
            <div className="w-full">
              <div className="h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden mb-0.5">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${rawVal ?? 0}%`, background: (rawVal ?? 0) === 100 ? '#10b981' : (rawVal ?? 0) >= 70 ? '#3b82f6' : '#f59e0b' }}
                />
              </div>
              <span className="text-[10px] text-[var(--text-3)]">{rawVal ?? 0}%</span>
            </div>
          ) : col.key === 'unitCode' && rawVal ? (
            (() => {
              const u = units.find(x => x.code === rawVal);
              const color = u?.colorHex && u.colorHex.length <= 9 ? u.colorHex : '#3b82f6';
              return (
                <span className="text-[11px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
                  style={{ borderLeft: `2px solid ${color}`, background: `${color}18`, color }}>
                  {rawVal}
                </span>
              );
            })()
          ) : col.key === 'dueDate' && row.isOverdue ? (
            <span className="text-red-400 text-[12px] font-medium">⚠ {displayVal}</span>
          ) : (
            <span className="text-[var(--text)] truncate text-[12.5px]">{String(displayVal ?? '')}</span>
          )}
        </div>
      )}
    </td>
  );
}
