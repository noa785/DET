'use client';
// src/app/(protected)/orders/grid/GridPageClient.tsx — Batch 3

import { useState, useCallback, useMemo, useEffect } from 'react';
import Link from 'next/link';
import GridEditor, { type GridColumn, type GridRow } from '@/components/tables/GridEditor';
import { useGridSaveQueue, type SelectOption } from '@/hooks/useOrders';
import { StatusBadge, RAGDot } from '@/components/ui/badges';
import type { RAGStatus } from '@/types';

// ── Option constants ───────────────────────────────────────────
const STATUS_OPTS = [
  { value: 'NOT_STARTED',  label: 'Not Started',  color: '#6b7280' },
  { value: 'IN_PROGRESS',  label: 'In Progress',  color: '#3b82f6' },
  { value: 'UNDER_REVIEW', label: 'Under Review', color: '#f59e0b' },
  { value: 'BLOCKED',      label: 'Blocked',      color: '#ef4444' },
  { value: 'ON_HOLD',      label: 'On Hold',      color: '#9ca3af' },
  { value: 'DONE',         label: 'Done',         color: '#10b981' },
  { value: 'CANCELLED',    label: 'Cancelled',    color: '#6b7280' },
];
const PRIORITY_OPTS = [
  { value: 'LOW',      label: 'Low',      color: '#6b7280' },
  { value: 'MEDIUM',   label: 'Medium',   color: '#f59e0b' },
  { value: 'HIGH',     label: 'High',     color: '#f87171' },
  { value: 'CRITICAL', label: 'Critical', color: '#ef4444' },
];
const TYPE_OPTS = [
  { value: 'PROGRAM',     label: 'Program',     color: '#8b5cf6' },
  { value: 'PROJECT',     label: 'Project',     color: '#3b82f6' },
  { value: 'DELIVERABLE', label: 'Deliverable', color: '#06b6d4' },
  { value: 'TASK',        label: 'Task',        color: '#10b981' },
  { value: 'SUBTASK',     label: 'Subtask',     color: '#6b7280' },
];
const RAG_OPTS = [
  { value: 'RED',   label: 'Red',   color: '#ef4444' },
  { value: 'AMBER', label: 'Amber', color: '#f59e0b' },
  { value: 'GREEN', label: 'Green', color: '#10b981' },
  { value: 'BLUE',  label: 'Blue',  color: '#3b82f6' },
  { value: 'GREY',  label: 'Grey',  color: '#6b7280' },
];
const PRIO_COLORS: Record<string, string> = { LOW: '#6b7280', MEDIUM: '#f59e0b', HIGH: '#f87171', CRITICAL: '#ef4444' };

// ── Props ──────────────────────────────────────────────────────
interface Props {
  initialRows: GridRow[];
  units:    SelectOption[];
  projects: SelectOption[];
  users:    SelectOption[];
  canEdit:  boolean;
  totalRows: number;
}

export default function GridPageClient({ initialRows, units, projects, users, canEdit, totalRows }: Props) {
  const [rows,           setRows]          = useState<GridRow[]>(initialRows);
  const [toast,          setToast]         = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [search,         setSearch]        = useState('');
  const [filterStatus,   setFilterStatus]  = useState('');
  const [filterUnit,     setFilterUnit]    = useState('');
  const [filterPriority, setFilterPriority]= useState('');
  const [unsaved,        setUnsaved]       = useState(0);

  function toast_(msg: string, type: 'success' | 'error' = 'success') {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2800);
  }

  // ── Batch flush to API ────────────────────────────────────
  // Groups all pending edits by orderId and sends one PATCH per order
  const flushSaves = useCallback(async (items: { orderId: string; field: string; value: any }[]) => {
    const byOrder = new Map<string, Record<string, any>>();
    for (const { orderId, field, value } of items) {
      if (!byOrder.has(orderId)) byOrder.set(orderId, {});
      byOrder.get(orderId)![field] = value;
    }
    let errors = 0;
    await Promise.all([...byOrder.entries()].map(async ([id, patch]) => {
      try {
        const r = await fetch(`/api/orders/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(patch),
        });
        if (!r.ok) errors++;
      } catch { errors++; }
    }));
    setUnsaved(0);
    if (errors) toast_(`${errors} save(s) failed — check connection`, 'error');
  }, []);

  const { enqueue, flush, saving } = useGridSaveQueue(flushSaves);

  // ── Cell save — optimistic update + enqueue ───────────────
  const handleCellSave = useCallback(async (rowId: string, field: string, value: any) => {
    // Optimistic update — update display fields derived from IDs
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const updated: GridRow = { ...r, [field]: value };
      // Update derived display labels
      if (field === 'unitId') {
        const unit = units.find(u => u.id === value);
        updated.unitCode  = unit?.code  ?? '';
        updated.unitColor = unit?.color ?? '';
      }
      if (field === 'ownerId') {
        const owner = users.find(u => u.id === value);
        updated.ownerName = owner?.label ?? '';
      }
      if (field === 'projectId') {
        const proj = projects.find(p => p.id === value);
        updated.projectName = proj?.label?.split(' — ')[1] ?? proj?.label ?? '';
      }
      return updated;
    }));
    setUnsaved(n => n + 1);
    enqueue({ orderId: rowId, field, value });
  }, [units, users, projects, enqueue]);

  // ── Add row ───────────────────────────────────────────────
  const handleAddRow = useCallback(async ({ name, unitId }: { name: string; unitId?: string | null }) => {
    const r = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, unitId, type: 'TASK', priority: 'MEDIUM', status: 'NOT_STARTED', percentComplete: 0 }),
    });
    if (!r.ok) { toast_('Failed to create row', 'error'); return; }
    const { data: o } = await r.json();
    const unit = units.find(u => u.id === unitId);
    setRows(prev => [...prev, {
      id: o.id, orderCode: o.orderCode, type: o.type, name: o.name,
      unitId: o.unitId ?? '', unitCode: unit?.code ?? '', unitColor: unit?.color ?? '',
      projectId: '', projectName: '', ownerId: '', ownerName: '',
      priority: o.priority, status: o.status,
      startDate: '', dueDate: '', percentComplete: 0, rescheduleCount: 0,
      notes: '', ragOverride: '', effectiveRAG: 'GREY', isOverdue: false,
    }]);
    toast_(`✓ Created ${o.orderCode}`);
  }, [units]);

  // ── Delete rows ───────────────────────────────────────────
  const handleDeleteRows = useCallback(async (ids: string[]) => {
    await Promise.all(ids.map(id => fetch(`/api/orders/${id}`, { method: 'DELETE' })));
    setRows(prev => prev.filter(r => !ids.includes(r.id)));
    toast_(`Deleted ${ids.length} row(s)`);
  }, []);

  // ── Filtered rows ─────────────────────────────────────────
  const filteredRows = useMemo(() => {
    let out = rows;
    if (search) {
      const q = search.toLowerCase();
      out = out.filter(r =>
        r.name.toLowerCase().includes(q) ||
        r.orderCode.toLowerCase().includes(q) ||
        (r.ownerName ?? '').toLowerCase().includes(q) ||
        (r.unitCode  ?? '').toLowerCase().includes(q)
      );
    }
    if (filterStatus)   out = out.filter(r => r.status   === filterStatus);
    if (filterUnit)     out = out.filter(r => r.unitId   === filterUnit);
    if (filterPriority) out = out.filter(r => r.priority === filterPriority);
    return out;
  }, [rows, search, filterStatus, filterUnit, filterPriority]);

  // ── Column definitions (react to select data changes) ────
  const columns: GridColumn[] = useMemo(() => [
    {
      key: 'orderCode', header: 'ID', width: 88, type: 'readonly',
      render: row => (
        <span className="font-display text-[11.5px] font-bold text-blue-400">{row.orderCode}</span>
      ),
    },
    {
      key: 'type', header: 'Type', width: 108, type: 'select', editable: canEdit,
      options: TYPE_OPTS,
    },
    {
      key: 'name', header: 'Task / Name', width: 280, type: 'text', editable: canEdit,
      render: (row, val) => (
        <div className="flex items-center gap-1.5 min-w-0">
          {row.isOverdue && <span className="text-red-400 text-[10px] flex-shrink-0">⚠</span>}
          <span className="truncate text-[var(--text)] text-[12.5px]">{val}</span>
        </div>
      ),
    },
    {
      key: 'unitId', header: 'Unit', width: 96, type: 'select', editable: canEdit,
      options: units.map(u => ({ value: u.id, label: u.code ?? u.label, color: u.color })),
      render: row => {
        if (!row.unitCode) return null;
        const color = (row.unitColor || '#3b82f6') as string;
        return (
          <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded whitespace-nowrap"
            style={{ borderLeft: `2px solid ${color}`, background: `${color}18`, color }}>
            {row.unitCode}
          </span>
        );
      },
    },
    {
      key: 'status', header: 'Status', width: 126, type: 'select', editable: canEdit,
      options: STATUS_OPTS,
      render: row => <StatusBadge status={row.status as any} />,
    },
    {
      key: 'priority', header: 'Priority', width: 88, type: 'select', editable: canEdit,
      options: PRIORITY_OPTS,
      render: row => {
        const c = PRIO_COLORS[row.priority] ?? '#6b7280';
        return (
          <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{ color: c }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: c }} />
            {row.priority.charAt(0) + row.priority.slice(1).toLowerCase()}
          </span>
        );
      },
    },
    {
      key: 'percentComplete', header: 'Progress', width: 130, type: 'percent', editable: canEdit,
    },
    {
      key: 'effectiveRAG', header: 'RAG', width: 72, type: 'select', editable: false,
      options: RAG_OPTS,
      render: row => <RAGDot rag={row.effectiveRAG as RAGStatus} showLabel />,
    },
    {
      key: 'ownerId', header: 'Owner', width: 128, type: 'select', editable: canEdit,
      options: users.map(u => ({ value: u.id, label: u.label })),
      render: row => <span className="text-[12px] text-[var(--text-2)]">{row.ownerName || '—'}</span>,
    },
    {
      key: 'startDate', header: 'Start', width: 96, type: 'date', editable: canEdit,
    },
    {
      key: 'dueDate', header: 'Due', width: 96, type: 'date', editable: canEdit,
      render: (row, val) => {
        if (!val) return <span className="text-[var(--text-3)] text-[12px]">—</span>;
        const d = new Date(val);
        return (
          <span className={`text-[12px] ${row.isOverdue ? 'text-red-400 font-semibold' : 'text-[var(--text-2)]'}`}>
            {isNaN(d.getTime()) ? val : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })}
          </span>
        );
      },
    },
    {
      key: 'projectId', header: 'Project', width: 148, type: 'select', editable: canEdit,
      options: projects.map(p => ({ value: p.id, label: p.label })),
      render: row => <span className="text-[12px] text-[var(--text-3)] truncate">{row.projectName || '—'}</span>,
    },
    {
      key: 'notes', header: 'Notes', width: 196, type: 'text', editable: canEdit,
      render: (row, val) => <span className="text-[11.5px] text-[var(--text-3)] truncate">{val || '—'}</span>,
    },
  ], [units, projects, users, canEdit]);

  return (
    <div className="flex flex-col h-[calc(100vh-58px-1.5rem)] space-y-2">

      {/* Page header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="font-display font-bold text-xl text-[var(--text)] flex items-center gap-2">
            ⚡ Grid Editor
            {unsaved > 0 && !saving && (
              <span className="text-[11px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full border border-amber-500/20">
                {unsaved} unsaved
              </span>
            )}
            {saving && (
              <span className="text-[11px] bg-blue-500/15 text-blue-400 px-2 py-0.5 rounded-full border border-blue-500/20 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                Saving…
              </span>
            )}
          </h1>
          <p className="text-xs text-[var(--text-3)] mt-0.5">
            Double-click or F2 to edit · Tab / Arrow keys to navigate · Esc to cancel · Ctrl+S to save now
          </p>
        </div>
        <div className="flex gap-2">
          {unsaved > 0 && (
            <button onClick={flush} className="pes-btn-ghost text-xs text-amber-400 hover:bg-amber-500/8">
              💾 Save Now
            </button>
          )}
          <Link href="/orders"><button className="pes-btn-ghost text-xs">Table View</button></Link>
          <Link href="/orders/new"><button className="pes-btn-primary text-xs">+ Full Form</button></Link>
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2 bg-[var(--surface)] rounded-lg border border-[var(--border)] px-3 py-2 flex-shrink-0">
        <div className="relative flex-1 min-w-[180px]">
          <input type="text" value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search name, code, owner, unit…"
            className="pes-input pl-7 py-1 text-[12px] w-full" />
          <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-xs pointer-events-none">🔍</span>
        </div>
        <select value={filterStatus}   onChange={e => setFilterStatus(e.target.value)}   className="pes-input py-1 text-[12px] w-[130px]">
          <option value="">All Statuses</option>
          {STATUS_OPTS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <select value={filterUnit}     onChange={e => setFilterUnit(e.target.value)}     className="pes-input py-1 text-[12px] w-[120px]">
          <option value="">All Units</option>
          {units.map(u => <option key={u.id} value={u.id}>{u.code ?? u.label}</option>)}
        </select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="pes-input py-1 text-[12px] w-[120px]">
          <option value="">All Priorities</option>
          {PRIORITY_OPTS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
        </select>
        {(search || filterStatus || filterUnit || filterPriority) && (
          <button onClick={() => { setSearch(''); setFilterStatus(''); setFilterUnit(''); setFilterPriority(''); }}
            className="text-[11.5px] text-[var(--text-3)] hover:text-red-400 transition-colors">
            ✕ Clear
          </button>
        )}
        <div className="text-[11px] text-[var(--text-3)] ml-auto tabular-nums">
          {filteredRows.length} {filteredRows.length !== rows.length ? `/ ${rows.length} ` : ''}rows
        </div>
      </div>

      {/* Grid */}
      <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-lg overflow-hidden">
        <GridEditor
          rows={filteredRows}
          columns={columns}
          onCellSave={handleCellSave}
          onAddRow={handleAddRow}
          onDeleteRows={handleDeleteRows}
          units={units}
          saving={saving}
          totalRows={totalRows}
          canEdit={canEdit}
          onFlushNow={flush}
        />
      </div>

      {/* Toast */}
      {toast && (
        <div className={`
          fixed bottom-6 right-6 z-50 px-4 py-2.5 rounded-lg text-[13px] font-medium shadow-xl border
          ${toast.type === 'error'
            ? 'bg-red-500/15 text-red-400 border-red-500/25'
            : 'bg-green-500/15 text-green-400 border-green-500/25'
          }
        `}>
          {toast.type === 'error' ? '✕ ' : '✓ '}{toast.msg}
        </div>
      )}
    </div>
  );
}
