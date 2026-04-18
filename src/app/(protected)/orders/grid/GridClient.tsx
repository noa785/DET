'use client';
// src/app/(protected)/orders/grid/GridClient.tsx
// Excel-like Grid Editor — Production version
// • Click to select, double-click / Enter / F2 to edit
// • Tab / Shift+Tab / Arrow keys navigation
// • Escape = cancel, Enter = commit + move down
// • Dirty row tracking (amber indicator)
// • Auto-save on cell blur
// • Bulk Save → POST /api/orders/bulk
// • Add row (+ button or Ctrl+Enter)
// • Delete row (✕ button)
// • Frozen column #1 (row numbers)
// • Sticky column (order code)
// • Status bar with keyboard hints

import {
  useState, useCallback, useRef, useEffect, useMemo,
  useTransition, KeyboardEvent as RKE,
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/ui/badges';

const STATUS_COLOR: Record<string, string> = {
  NOT_STARTED:'#4b5563', IN_PROGRESS:'#3b82f6', UNDER_REVIEW:'#f59e0b',
  BLOCKED:'#ef4444', ON_HOLD:'#6b7280', DONE:'#10b981', CANCELLED:'#374151',
};
const PRIORITY_COLOR: Record<string, string> = {
  LOW:'#6b7280', MEDIUM:'#f59e0b', HIGH:'#f87171', CRITICAL:'#ef4444',
};
const RAG_COLOR: Record<string, string> = {
  RED:'#ef4444', AMBER:'#f59e0b', GREEN:'#10b981', BLUE:'#3b82f6', GREY:'#6b7280',
};
const STATUS_OPTIONS   = ['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED'];
const PRIORITY_OPTIONS = ['LOW','MEDIUM','HIGH','CRITICAL'];
const TYPE_OPTIONS     = ['PROGRAM','PROJECT','DELIVERABLE','TASK','SUBTASK'];

type ColType = 'readonly'|'text'|'textarea'|'status'|'priority'|'type'|'percent'|'date'|'select-unit'|'select-project'|'select-owner'|'rag';
interface ColDef { key:string; label:string; width:number; type:ColType; readOnly?:boolean; sticky?:boolean; }

const COLS: ColDef[] = [
  { key:'orderCode',       label:'ID',      width:96,  type:'readonly',      readOnly:true, sticky:true },
  { key:'name',            label:'Name',    width:280, type:'text' },
  { key:'type',            label:'Type',    width:110, type:'type' },
  { key:'unitId',          label:'Unit',    width:90,  type:'select-unit' },
  { key:'status',          label:'Status',  width:130, type:'status' },
  { key:'priority',        label:'Priority',width:100, type:'priority' },
  { key:'percentComplete', label:'%',       width:80,  type:'percent' },
  { key:'effectiveRAG',    label:'RAG',     width:72,  type:'rag',          readOnly:true },
  { key:'ownerId',         label:'Owner',   width:130, type:'select-owner' },
  { key:'projectId',       label:'Project', width:110, type:'select-project' },
  { key:'startDate',       label:'Start',   width:110, type:'date' },
  { key:'dueDate',         label:'Due',     width:110, type:'date' },
  { key:'notes',           label:'Notes',   width:200, type:'textarea' },
];

export interface GridRow {
  id:string; orderCode:string; type:string; name:string;
  unitId:string; unitCode:string; unitColor:string|null;
  projectId:string; projectCode:string; ownerId:string; ownerName:string;
  priority:string; status:string; startDate:string; dueDate:string;
  percentComplete:number; notes:string; effectiveRAG:string;
  isOverdue:boolean; isDirty:boolean; isNew?:boolean; _saveState?:'saving'|'saved'|'error';
}
interface CellAddr { row:number; col:number }
interface Props {
  initialRows: GridRow[];
  units:    { id:string; code:string; name:string; colorHex:string|null }[];
  projects: { id:string; code:string; name:string }[];
  users:    { id:string; name:string }[];
  canEdit:  boolean;
}

export default function GridClient({ initialRows, units, projects, users, canEdit }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows,         setRows]         = useState<GridRow[]>(initialRows);
  const [active,       setActive]       = useState<CellAddr|null>(null);
  const [editing,      setEditing]      = useState<CellAddr|null>(null);
  const [search,       setSearch]       = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterUnit,   setFilterUnit]   = useState('');
  const [saving,       setSaving]       = useState(false);
  const [saveResult,   setSaveResult]   = useState<{ok:number; errors:number}|null>(null);
  const [autoSave,     setAutoSave]     = useState(true);
  const [selected,     setSelected]     = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const visible = useMemo(() => {
    let r = rows;
    if (search.trim()) {
      const q = search.toLowerCase();
      r = r.filter(o =>
        o.name.toLowerCase().includes(q) ||
        o.orderCode.toLowerCase().includes(q) ||
        o.ownerName.toLowerCase().includes(q) ||
        o.unitCode.toLowerCase().includes(q)
      );
    }
    if (filterStatus) r = r.filter(o => o.status === filterStatus);
    if (filterUnit)   r = r.filter(o => o.unitId === filterUnit);
    return r;
  }, [rows, search, filterStatus, filterUnit]);

  const dirtyCount = useMemo(() => rows.filter(r => r.isDirty).length, [rows]);

  const updateCell = useCallback((rowId:string, field:string, value:unknown) => {
    setRows(prev => prev.map(r => {
      if (r.id !== rowId) return r;
      const u = { ...r, [field]:value, isDirty:true };
      if (field==='ownerId')   u.ownerName   = users.find(u=>u.id===value)?.name ?? '';
      if (field==='unitId')    { const un=units.find(u=>u.id===value); u.unitCode=un?.code??''; u.unitColor=un?.colorHex??null; }
      if (field==='projectId') u.projectCode = projects.find(p=>p.id===value)?.code ?? '';
      return u;
    }));
  }, [users, units, projects]);

  const saveAll = useCallback(async () => {
    const dirty = rows.filter(r=>r.isDirty);
    if (!dirty.length) return;
    setSaving(true); setSaveResult(null);
    setRows(prev => prev.map(r => r.isDirty ? {...r, _saveState:'saving'} : r));
    try {
      const updates = dirty.filter(r=>!r.isNew).map(r=>({
        id:r.id, name:r.name, type:r.type,
        unitId:r.unitId||null, projectId:r.projectId||null, ownerId:r.ownerId||null,
        priority:r.priority, status:r.status,
        startDate:r.startDate||null, dueDate:r.dueDate||null,
        percentComplete:r.percentComplete, notes:r.notes||null,
      }));
      const creates = dirty.filter(r=>r.isNew&&r.name.trim()).map(r=>({
        _isNew:true as const, _tempId:r.id, name:r.name.trim(), type:r.type,
        unitId:r.unitId||null, projectId:r.projectId||null, ownerId:r.ownerId||null,
        priority:r.priority as any, status:r.status as any,
        startDate:r.startDate||null, dueDate:r.dueDate||null,
        percentComplete:r.percentComplete, notes:r.notes||null,
      }));
      const res  = await fetch('/api/orders/bulk', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({updates,creates}) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      const created = data.data.created as Array<{id:string;orderCode:string;_tempId?:string}>;
      const ok      = data.data.updated + created.length;
      const errors  = data.data.errors?.length ?? 0;
      setRows(prev => prev
        .filter(r => !(r.isNew && !r.name.trim()))
        .map(r => {
          if (!r.isDirty) return r;
          if (r.isNew) {
            const m = created.find(c=>c._tempId===r.id);
            return m ? {...r, id:m.id, orderCode:m.orderCode, isDirty:false, isNew:false, _saveState:'saved'} : {...r, _saveState:'error'};
          }
          return {...r, isDirty:false, _saveState:'saved'};
        })
      );
      setSaveResult({ok, errors});
      if (ok>0) startTransition(()=>router.refresh());
      setTimeout(()=>{ setRows(prev=>prev.map(r=>r._saveState?{...r,_saveState:undefined}:r)); setSaveResult(null); }, 2500);
    } catch {
      setRows(prev=>prev.map(r=>r.isDirty?{...r,_saveState:'error'}:r));
      setSaveResult({ok:0, errors:dirtyCount});
    } finally { setSaving(false); }
  }, [rows, dirtyCount, router]);

  const triggerAutoSave = useCallback(() => {
    if (autoSave && dirtyCount > 0 && canEdit) {
      const t = setTimeout(()=>saveAll(), 1000);
      return ()=>clearTimeout(t);
    }
  }, [autoSave, dirtyCount, canEdit, saveAll]);

  // Navigation
  function navigate(dr:number, dc:number, fromRow:number, fromCol:number) {
    const newRow = Math.max(0, Math.min(visible.length-1, fromRow+dr));
    const editable = COLS.filter(c=>!c.readOnly);
    const curIdx   = editable.findIndex(c=>c.key===COLS[fromCol]?.key);
    const nIdx     = Math.max(0, Math.min(editable.length-1, curIdx+dc));
    const nColKey  = editable[nIdx]?.key ?? COLS[fromCol]?.key;
    const nCol     = COLS.findIndex(c=>c.key===nColKey);
    setActive({row:newRow, col:nCol}); setEditing(null);
  }

  function handleGridKey(e:RKE<HTMLDivElement>) {
    if (!active) return;
    const {row,col} = active;
    if (editing) {
      if (e.key==='Escape') { e.preventDefault(); setEditing(null); }
      if (e.key==='Tab')    { e.preventDefault(); setEditing(null); navigate(0, e.shiftKey?-1:1, row, col); }
      return;
    }
    switch(e.key) {
      case 'ArrowUp':   e.preventDefault(); navigate(-1,0,row,col); break;
      case 'ArrowDown': e.preventDefault(); navigate(1,0,row,col);  break;
      case 'ArrowLeft': e.preventDefault(); navigate(0,-1,row,col); break;
      case 'ArrowRight':e.preventDefault(); navigate(0,1,row,col);  break;
      case 'Tab':       e.preventDefault(); navigate(0,e.shiftKey?-1:1,row,col); break;
      case 'Enter':
      case 'F2':        e.preventDefault(); if (COLS[col] && !COLS[col].readOnly && canEdit) setEditing(active); break;
      case 'Delete':
      case 'Backspace': if (canEdit && COLS[col] && !COLS[col].readOnly && visible[row]) updateCell(visible[row].id, COLS[col].key, COLS[col].type==='percent'?0:''); break;
    }
    if ((e.ctrlKey||e.metaKey) && e.key==='s') { e.preventDefault(); saveAll(); }
    if ((e.ctrlKey||e.metaKey) && e.key==='Enter') { e.preventDefault(); addRow(); }
  }

  function addRow() {
    const tempId = `new-${Date.now()}`;
    const nr: GridRow = {
      id:tempId, orderCode:'…', type:'TASK', name:'',
      unitId:'', unitCode:'', unitColor:null,
      projectId:'', projectCode:'', ownerId:'', ownerName:'',
      priority:'MEDIUM', status:'NOT_STARTED',
      startDate:'', dueDate:'', percentComplete:0,
      notes:'', effectiveRAG:'GREY', isOverdue:false, isDirty:true, isNew:true,
    };
    setRows(prev=>[...prev, nr]);
    const nameCol = COLS.findIndex(c=>c.key==='name');
    setTimeout(()=>{ setActive({row:visible.length, col:nameCol}); setEditing({row:visible.length, col:nameCol}); }, 50);
  }

  async function deleteRow(rowId:string, isNew:boolean) {
    if (!canEdit) return;
    if (isNew) { setRows(prev=>prev.filter(r=>r.id!==rowId)); return; }
    if (!confirm('Delete this order?')) return;
    try {
      await fetch(`/api/orders/${rowId}`, {method:'DELETE'});
      setRows(prev=>prev.filter(r=>r.id!==rowId));
    } catch { alert('Delete failed'); }
  }

  function discardDirty() {
    setRows(prev=>prev
      .filter(r=>!r.isNew)
      .map(r=>{
        if (!r.isDirty) return r;
        const o = initialRows.find(x=>x.id===r.id);
        return o ? {...o, isDirty:false, _saveState:undefined} : r;
      })
    );
  }

  const totalWidth = COLS.reduce((s,c)=>s+c.width,0)+48;

  return (
    <div className="flex flex-col" style={{height:'calc(100vh - 104px)'}} onKeyDown={handleGridKey} tabIndex={-1} ref={containerRef}>

      {/* Toolbar */}
      <div className="flex items-center gap-2.5 mb-3 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-xl text-[var(--text)] flex items-center gap-2">
            <span className="text-yellow-400">⚡</span> Grid Editor
          </h1>
          <p className="text-[11px] text-[var(--text-3)]">Click → select · Enter/F2 → edit · Tab → next · Ctrl+S → save · Ctrl+Enter → add row</p>
        </div>
        <div className="flex-1" />

        <div className="relative">
          <input type="text" value={search} onChange={e=>setSearch(e.target.value)}
            placeholder="Search…" className="pes-input pl-7 py-1.5 text-[12.5px] w-[160px]" />
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--text-3)] text-[11px] pointer-events-none">🔍</span>
        </div>

        <select value={filterStatus} onChange={e=>setFilterStatus(e.target.value)} className="pes-input py-1.5 text-[12.5px] w-[130px]">
          <option value="">All Statuses</option>
          {STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}
        </select>

        <select value={filterUnit} onChange={e=>setFilterUnit(e.target.value)} className="pes-input py-1.5 text-[12.5px] w-[110px]">
          <option value="">All Units</option>
          {units.map(u=><option key={u.id} value={u.id}>{u.code}</option>)}
        </select>

        <label className="flex items-center gap-1.5 text-[12px] text-[var(--text-2)] cursor-pointer select-none">
          <input type="checkbox" checked={autoSave} onChange={e=>setAutoSave(e.target.checked)} className="accent-blue-500 w-3.5 h-3.5" />
          Auto-save
        </label>

        <span className="text-[12px] text-[var(--text-3)] tabular-nums">{visible.length} rows</span>

        {dirtyCount>0 && <span className="text-[12px] font-semibold text-amber-400 animate-pulse">● {dirtyCount} unsaved</span>}

        {saveResult && (
          <span className={`text-[12px] font-semibold ${saveResult.errors ? 'text-red-400':'text-green-400'}`}>
            {saveResult.errors ? `✕ ${saveResult.errors} error${saveResult.errors>1?'s':''}` : `✓ Saved ${saveResult.ok}`}
          </span>
        )}

        {canEdit && (
          <div className="flex items-center gap-1.5">
            <button onClick={addRow} className="pes-btn-ghost text-xs py-1.5" title="Ctrl+Enter">+ Row</button>
            {dirtyCount>0 && (
              <>
                <button onClick={discardDirty} className="pes-btn-ghost text-xs py-1.5 text-[var(--text-3)] hover:text-red-400">↩</button>
                <button onClick={saveAll} disabled={saving} className="pes-btn-primary text-xs py-1.5 flex items-center gap-1.5" title="Ctrl+S">
                  {saving ? <Spinner size={11}/> : '💾'} Save {dirtyCount}
                </button>
              </>
            )}
          </div>
        )}

        <Link href="/orders"><button className="pes-btn-ghost text-xs py-1.5">← List</button></Link>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto rounded-xl border border-[var(--border)] bg-[#0a0f1a]">
        <table className="border-collapse text-[12.5px] select-none" style={{minWidth:totalWidth}}>
          <thead className="sticky top-0 z-20">
            <tr className="bg-[var(--surface)]">
              <th className="w-10 border-r border-b border-[#1a2540] sticky left-0 bg-[var(--surface)] z-30" />
              {COLS.map(col=>(
                <th key={col.key} style={{width:col.width, minWidth:col.width}}
                  className={`px-3 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-[var(--text-3)] border-r border-b border-[#1a2540] last:border-r-0 whitespace-nowrap ${col.sticky?'sticky left-10 bg-[var(--surface)] z-20':''}`}>
                  {col.label}
                </th>
              ))}
              <th className="w-10 border-b border-[#1a2540]" />
            </tr>
          </thead>
          <tbody>
            {visible.length===0 && (
              <tr><td colSpan={COLS.length+2} className="py-16 text-center text-[var(--text-3)] text-[13px]">No orders match filters</td></tr>
            )}
            {visible.map((row,rIdx)=>{
              const ss = row._saveState;
              return (
                <tr key={row.id} className={`border-b border-[#1a2540]/60 hover:bg-[#121b2e]/80 transition-colors ${row.isOverdue&&!row.isDirty?'bg-red-500/3':''} ${row.isDirty&&!ss?'bg-amber-500/4':''} ${ss==='saving'?'opacity-60':''} ${ss==='saved'?'bg-green-500/4':''} ${ss==='error'?'bg-red-500/8':''}`}>
                  {/* Row # */}
                  <td className="w-10 px-2 py-1.5 text-center text-[10.5px] tabular-nums border-r border-[#1a2540] sticky left-0 z-10 cursor-default"
                    style={{background: row.isDirty&&!ss?'#1a1400': ss==='saved'?'#0a1a12': ss==='error'?'#1a0a0a':'#0a0f1a', borderLeft: row.isDirty?'2px solid #f59e0b': ss==='saved'?'2px solid #10b981': ss==='error'?'2px solid #ef4444':'2px solid transparent', color: row.isDirty?'#d97706':'#374151'}}
                    onClick={()=>setSelected(s=>{ const n=new Set(s); n.has(row.id)?n.delete(row.id):n.add(row.id); return n; })}>
                    {ss==='saving'?<Spinner size={10}/>:row.isNew?'✦':rIdx+1}
                  </td>
                  {/* Data cells */}
                  {COLS.map((col,ci)=>{
                    const isActive  = active?.row===rIdx && active?.col===ci;
                    const isEditing = editing?.row===rIdx && editing?.col===ci;
                    const value     = (row as any)[col.key];
                    const editable  = canEdit && !col.readOnly;
                    return (
                      <td key={col.key} style={{width:col.width, minWidth:col.width}}
                        className={`px-2.5 py-1 border-r border-[#1a2540] last:border-r-0 cursor-default ${col.sticky?'sticky left-10 z-10':''} ${isActive&&!isEditing?'ring-inset ring-2 ring-blue-500':''} ${isEditing?'p-0 ring-inset ring-2 ring-blue-400':''}`}
                        style={col.sticky?{background: row.isDirty&&!ss?'#1a1400':'#0a0f1a'}:{}}
                        onClick={()=>{ setActive({row:rIdx,col:ci}); if(editing?.row!==rIdx||editing?.col!==ci) setEditing(null); }}
                        onDoubleClick={()=>{ if(editable){ setActive({row:rIdx,col:ci}); setEditing({row:rIdx,col:ci}); } }}>
                        {isEditing && editable
                          ? <EditCell col={col} row={row} value={value} units={units} projects={projects} users={users}
                              onChange={(v:unknown)=>updateCell(row.id,col.key,v)}
                              onCommit={(dr=1)=>{ setEditing(null); navigate(dr,0,rIdx,ci); triggerAutoSave(); }}
                              onCancel={()=>setEditing(null)} />
                          : <DisplayCell col={col} row={row} value={value} />
                        }
                      </td>
                    );
                  })}
                  {/* Actions */}
                  <td className="w-10 px-1 py-1 text-center">
                    {canEdit && (
                      <div className="flex items-center gap-1">
                        <Link href={`/orders/${row.id}`} onClick={e=>e.stopPropagation()}>
                          <button className="w-5 h-5 rounded text-[var(--text-3)] hover:text-blue-400 transition-colors text-[10px]" title="Open">→</button>
                        </Link>
                        <button onClick={()=>deleteRow(row.id,!!row.isNew)} className="w-5 h-5 rounded text-[var(--text-3)] hover:text-red-400 hover:bg-red-500/10 transition-colors text-[10px]" title="Delete">✕</button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {canEdit && (
              <tr className="border-b border-[#1a2540]/30">
                <td colSpan={COLS.length+2} className="px-3 py-2">
                  <button onClick={addRow} className="text-[12px] text-[var(--text-3)] hover:text-blue-400 transition-colors flex items-center gap-1.5">
                    <span className="text-[14px]">+</span> Add row
                  </button>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Status bar */}
      <div className="flex items-center gap-4 mt-2 px-1 text-[11px] text-[var(--text-3)]">
        <span className="tabular-nums">{rows.length} total · {visible.length} shown</span>
        {dirtyCount>0 && <span className="text-amber-500">{dirtyCount} unsaved</span>}
        {selected.size>0 && <span className="text-blue-400">{selected.size} selected</span>}
        <span className="ml-auto">Enter/F2 = edit · Tab = next · Esc = cancel · Ctrl+S = save · Ctrl+Enter = new row · Delete = clear cell</span>
      </div>
    </div>
  );
}

// ── Edit Cell ──────────────────────────────────────────────────
interface ECProps { col:ColDef; row:GridRow; value:unknown; units:{id:string;code:string;name:string;colorHex:string|null}[]; projects:{id:string;code:string;name:string}[]; users:{id:string;name:string}[]; onChange:(v:unknown)=>void; onCommit:(dr?:number)=>void; onCancel:()=>void; }

function EditCell({col,row,value,units,projects,users,onChange,onCommit,onCancel}:ECProps) {
  const ref = useRef<any>(null);
  useEffect(()=>{ ref.current?.focus(); if(ref.current&&'select'in ref.current) ref.current.select(); },[]);
  const base = "w-full h-full px-2.5 py-1.5 text-[12.5px] bg-[#0d1b30] text-[var(--text)] outline-none border-0 focus:ring-0 leading-tight";
  const hk = (e:React.KeyboardEvent) => {
    if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();onCommit(1);}
    if(e.key==='Escape'){e.preventDefault();onCancel();}
    if(e.key==='Tab'){e.preventDefault();onCommit(0);}
  };
  if (col.type==='text') return <input ref={ref} type="text" defaultValue={String(value??'')} className={base} onChange={e=>onChange(e.target.value)} onKeyDown={hk} onBlur={()=>onCommit(0)} style={{minWidth:col.width-20}} />;
  if (col.type==='textarea') return <textarea ref={ref} defaultValue={String(value??'')} rows={3} className={`${base} resize-none`} onChange={e=>onChange(e.target.value)} onKeyDown={e=>{if(e.key==='Escape')onCancel();if(e.key==='Tab'){e.preventDefault();onCommit(0);}}} onBlur={()=>onCommit(0)} style={{minWidth:col.width-20}} />;
  if (col.type==='percent') return <input ref={ref} type="number" min={0} max={100} defaultValue={Number(value??0)} className={base} onChange={e=>onChange(Math.min(100,Math.max(0,parseInt(e.target.value)||0)))} onKeyDown={hk} onBlur={()=>onCommit(0)} style={{width:col.width-20}} />;
  if (col.type==='date') return <input ref={ref} type="date" defaultValue={String(value??'')} className={base} onChange={e=>onChange(e.target.value)} onKeyDown={hk} onBlur={()=>onCommit(0)} style={{width:col.width-20,colorScheme:'dark'}} />;
  const selBase = `${base} cursor-pointer`;
  const selHK   = (e:React.KeyboardEvent)=>{ if(e.key==='Escape')onCancel(); };
  if (col.type==='status')         return <select ref={ref} defaultValue={String(value??'')} className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onKeyDown={selHK} onBlur={()=>onCommit(0)}>{STATUS_OPTIONS.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select>;
  if (col.type==='priority')       return <select ref={ref} defaultValue={String(value??'')} className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onKeyDown={selHK} onBlur={()=>onCommit(0)}>{PRIORITY_OPTIONS.map(p=><option key={p} value={p}>{p}</option>)}</select>;
  if (col.type==='type')           return <select ref={ref} defaultValue={String(value??'')} className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onBlur={()=>onCommit(0)}>{TYPE_OPTIONS.map(t=><option key={t} value={t}>{t}</option>)}</select>;
  if (col.type==='select-unit')    return <select ref={ref} defaultValue={row.unitId}    className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onBlur={()=>onCommit(0)}><option value="">— none —</option>{units.map(u=><option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}</select>;
  if (col.type==='select-owner')   return <select ref={ref} defaultValue={row.ownerId}   className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onBlur={()=>onCommit(0)}><option value="">— none —</option>{users.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>;
  if (col.type==='select-project') return <select ref={ref} defaultValue={row.projectId} className={selBase} onChange={e=>{onChange(e.target.value);onCommit(0);}} onBlur={()=>onCommit(0)}><option value="">— none —</option>{projects.map(p=><option key={p.id} value={p.id}>{p.code}</option>)}</select>;
  return <span className="px-2.5 py-1.5 text-[12.5px]">{String(value??'')}</span>;
}

// ── Display Cell ───────────────────────────────────────────────
function DisplayCell({col,row,value}:{col:ColDef;row:GridRow;value:unknown}) {
  const str = String(value??'');
  if (col.type==='readonly') return <span className="font-display font-bold text-[11.5px] text-blue-400 tabular-nums">{str||'…'}</span>;
  if (col.type==='status') { const c=STATUS_COLOR[str]??'#6b7280'; return <span className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2 py-0.5 rounded" style={{background:`${c}18`,color:c}}>{str.replace(/_/g,' ')}</span>; }
  if (col.type==='priority') { const c=PRIORITY_COLOR[str]??'#6b7280'; return <span className="inline-flex items-center gap-1 text-[11.5px] font-semibold" style={{color:c}}><span className="w-1.5 h-1.5 rounded-full" style={{background:c}}/>{str}</span>; }
  if (col.type==='rag') { const c=RAG_COLOR[str]??'#6b7280'; return <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{background:c,boxShadow:`0 0 5px ${c}80`}}/><span className="text-[10.5px]" style={{color:c}}>{str}</span></span>; }
  if (col.type==='type') return <span className="text-[11px] text-[var(--text-2)] bg-[var(--surface-3)] px-1.5 py-0.5 rounded">{str}</span>;
  if (col.type==='percent') { const n=Number(value??0); const c=n===100?'#10b981':n>=70?'#3b82f6':n>=40?'#f59e0b':'#6b7280'; return <div className="flex items-center gap-2"><div className="flex-1 h-1 bg-[var(--surface-3)] rounded-full overflow-hidden"><div className="h-full rounded-full" style={{width:`${n}%`,background:c}}/></div><span className="text-[11px] text-[var(--text-2)] w-7 text-right tabular-nums">{n}%</span></div>; }
  if (col.type==='date') { if(!str) return <span className="text-[var(--text-3)] text-[11.5px]">—</span>; const d=new Date(str+'T00:00:00'); return <span className={`text-[11.5px] ${row.isOverdue&&col.key==='dueDate'?'text-red-400 font-semibold':'text-[var(--text-2)]'}`}>{d.toLocaleDateString('en-GB',{day:'2-digit',month:'short',year:'2-digit'})}</span>; }
  if (col.type==='select-unit') { if(!row.unitCode) return <span className="text-[var(--text-3)] text-[11.5px]">—</span>; const color=row.unitColor&&row.unitColor.length<=9?row.unitColor:'#3b82f6'; return <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{borderLeft:`2px solid ${color}`,background:`${color}18`,color}}>{row.unitCode}</span>; }
  if (col.type==='select-owner')   return <span className="text-[12px] text-[var(--text-2)]">{row.ownerName||<span className="text-[var(--text-3)]">—</span>}</span>;
  if (col.type==='select-project') return <span className="text-[11.5px] text-[var(--text-2)]">{row.projectCode||<span className="text-[var(--text-3)]">—</span>}</span>;
  if (col.type==='textarea') return <span className="text-[12px] text-[var(--text-2)] truncate block max-w-full">{str||<span className="text-[var(--text-3)] italic text-[11px]">—</span>}</span>;
  return <span className={`text-[12.5px] truncate block max-w-full ${col.key==='name'?'text-[var(--text)] font-medium':'text-[var(--text-2)]'}`}>{str||<span className="text-[var(--text-3)] italic text-[11px]">—</span>}</span>;
}
