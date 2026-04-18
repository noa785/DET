'use client';
// src/app/(protected)/import-export/ImportExportClient.tsx
// Full import/export UI:
//  • Export Orders (xlsx / csv) with filters
//  • Export Governance Items (xlsx / csv)
//  • Import Orders from xlsx/csv with drag-drop, validation preview, confirm

import { useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Spinner } from '@/components/ui/badges';

// ── Types ──────────────────────────────────────────────────────
interface ImportResult {
  imported:     number;
  skipped:      number;
  total:        number;
  errors:       { row: number; messages: string[] }[];
  insertErrors: string[];
}

interface Props {
  units:    { id: string; code: string; name: string }[];
  canImport: boolean;
}

// ── Component ──────────────────────────────────────────────────
export default function ImportExportClient({ units, canImport }: Props) {
  const [section, setSection] = useState<'export' | 'import' | 'update'>('export');

  return (
    <div className="space-y-5 max-w-4xl">

      {/* Header */}
      <div>
        <div className="flex items-center gap-1.5 text-[12.5px] text-[var(--text-3)] mb-1">
          <span>System</span>
          <span>›</span>
          <span className="text-[var(--text)]">Import / Export</span>
        </div>
        <h1 className="font-display font-bold text-[22px] text-[var(--text)]">📂 Import / Export</h1>
        <p className="text-[12.5px] text-[var(--text-3)] mt-1">
          Export data to Excel for reporting, or import bulk data from a spreadsheet.
        </p>
      </div>

      {/* Section tabs */}
      <div className="flex gap-1 border-b border-[var(--border)]">
        {[
          { id: 'export', label: '⬇ Export Data' },
          { id: 'import', label: '⬆ Import Data' },
          { id: 'update', label: '✏ Bulk Update' },
        ].map(t => (
          <button key={t.id} type="button"
            onClick={() => setSection(t.id as any)}
            className={`px-5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-all
              ${section === t.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {section === 'export' && <ExportSection units={units} />}
      {section === 'import' && <ImportSection canImport={canImport} />}
      {section === 'update' && <BulkUpdateSection canImport={canImport} units={units} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// EXPORT SECTION
// ══════════════════════════════════════════════════════════════
function ExportSection({ units }: { units: { id: string; code: string; name: string }[] }) {
  const [ordersFormat,  setOrdersFormat]  = useState<'xlsx' | 'csv'>('xlsx');
  const [ordersStatus,  setOrdersStatus]  = useState('');
  const [ordersUnit,    setOrdersUnit]    = useState('');
  const [govFormat,     setGovFormat]     = useState<'xlsx' | 'csv'>('xlsx');
  const [govStatus,     setGovStatus]     = useState('');
  const [govType,       setGovType]       = useState('');
  const [downloadingO,  setDownloadingO]  = useState(false);
  const [downloadingG,  setDownloadingG]  = useState(false);
  const [tasksFormat,   setTasksFormat]   = useState<'xlsx' | 'csv'>('xlsx');
  const [tasksStatus,   setTasksStatus]   = useState('');
  const [downloadingT,  setDownloadingT]  = useState(false);

  async function downloadOrders() {
    setDownloadingO(true);
    try {
      const params = new URLSearchParams({ format: ordersFormat });
      if (ordersStatus) params.set('status', ordersStatus);
      if (ordersUnit)   params.set('unitId', ordersUnit);
      const res = await fetch(`/api/orders/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await triggerDownload(res, `orders-export.${ordersFormat}`);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setDownloadingO(false);
    }
  }

  async function downloadGovernance() {
    setDownloadingG(true);
    try {
      const params = new URLSearchParams({ format: govFormat });
      if (govStatus) params.set('status', govStatus);
      if (govType)   params.set('type',   govType);
      const res = await fetch(`/api/governance/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await triggerDownload(res, `governance-export.${govFormat}`);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setDownloadingG(false);
    }
  }

  async function downloadTasks() {
    setDownloadingT(true);
    try {
      const params = new URLSearchParams({ format: tasksFormat });
      if (tasksStatus) params.set('status', tasksStatus);
      const res = await fetch(`/api/gov-tasks/export?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await triggerDownload(res, `gov-tasks-export.${tasksFormat}`);
    } catch (e: any) {
      alert(`Export failed: ${e.message}`);
    } finally {
      setDownloadingT(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* Orders export card */}
      <div className="pes-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">📋</span>
          <div>
            <h2 className="font-display font-bold text-[16px] text-[var(--text)]">Export Orders</h2>
            <p className="text-[12px] text-[var(--text-3)]">All order fields + governance descriptions in one file</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="pes-label">Format</label>
            <select value={ordersFormat} onChange={e => setOrdersFormat(e.target.value as any)} className="pes-input w-full mt-1 text-[13px]">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Status</label>
            <select value={ordersStatus} onChange={e => setOrdersStatus(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Statuses</option>
              {['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD','DONE','CANCELLED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Unit</label>
            <select value={ordersUnit} onChange={e => setOrdersUnit(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <button onClick={downloadOrders} disabled={downloadingO}
            className="pes-btn-primary flex items-center gap-2 text-[13px]">
            {downloadingO ? <><Spinner size={14}/> Generating…</> : '⬇ Download Orders'}
          </button>
          <span className="text-[11.5px] text-[var(--text-3)]">
            Includes: code, name, type, unit, project, owner, status, priority, %, RAG, dates, description fields
          </span>
        </div>
      </div>

      {/* Governance export card */}
      <div className="pes-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">🛡</span>
          <div>
            <h2 className="font-display font-bold text-[16px] text-[var(--text)]">Export Governance</h2>
            <p className="text-[12px] text-[var(--text-3)]">Governance items + tasks in separate sheets</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="pes-label">Format</label>
            <select value={govFormat} onChange={e => setGovFormat(e.target.value as any)} className="pes-input w-full mt-1 text-[13px]">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Status</label>
            <select value={govStatus} onChange={e => setGovStatus(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Statuses</option>
              {['DRAFT','ACTIVE','UNDER_REVIEW','SUPERSEDED','ARCHIVED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Type</label>
            <select value={govType} onChange={e => setGovType(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Types</option>
              {['POLICY','PROCEDURE','STANDARD','GUIDELINE','COMMITTEE_DECISION','CONTROL','COMPLIANCE_REQUIREMENT'].map(t => (
                <option key={t} value={t}>{t.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <button onClick={downloadGovernance} disabled={downloadingG}
            className="pes-btn-primary flex items-center gap-2 text-[13px]" style={{ background: '#7c3aed' }}>
            {downloadingG ? <><Spinner size={14}/> Generating…</> : '⬇ Download Governance'}
          </button>
          <span className="text-[11.5px] text-[var(--text-3)]">
            Sheet 1: Governance Items · Sheet 2: All Tasks
          </span>
        </div>
      </div>


      {/* Gov Tasks export card */}
      <div className="pes-card p-6 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-xl">✅</span>
          <div>
            <h2 className="font-display font-bold text-[16px] text-[var(--text)]">Export Gov. Tasks</h2>
            <p className="text-[12px] text-[var(--text-3)]">All governance tasks with approval status and assignees</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="pes-label">Format</label>
            <select value={tasksFormat} onChange={e => setTasksFormat(e.target.value as any)} className="pes-input w-full mt-1 text-[13px]">
              <option value="xlsx">Excel (.xlsx)</option>
              <option value="csv">CSV (.csv)</option>
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Status</label>
            <select value={tasksStatus} onChange={e => setTasksStatus(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Statuses</option>
              {['TODO','IN_PROGRESS','AWAITING_APPROVAL','DONE','CANCELLED'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g,' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <button onClick={downloadTasks} disabled={downloadingT}
            className="pes-btn-primary flex items-center gap-2 text-[13px]" style={{ background: '#059669' }}>
            {downloadingT ? <><Spinner size={14}/> Generating…</> : '⬇ Download Gov. Tasks'}
          </button>
          <span className="text-[11.5px] text-[var(--text-3)]">
            Includes: task code, gov item, type, status, assignee, due date, approval status
          </span>
        </div>
      </div>

      {/* Info boxes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="pes-card p-4 border-blue-500/20 bg-blue-500/5">
          <p className="text-[12.5px] text-blue-300 font-semibold mb-1">📊 Excel Export includes:</p>
          <ul className="text-[12px] text-[var(--text-2)] space-y-0.5">
            <li>• Orders sheet with all fields</li>
            <li>• Summary statistics sheet</li>
            <li>• Import Template sheet</li>
            <li>• Auto-filter + frozen header row</li>
          </ul>
        </div>
        <div className="pes-card p-4 border-green-500/20 bg-green-500/5">
          <p className="text-[12.5px] text-green-300 font-semibold mb-1">✅ Export is audit-logged</p>
          <p className="text-[12px] text-[var(--text-2)]">
            Every export is recorded in the Audit Log with timestamp and user identity for compliance tracking.
          </p>
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// IMPORT SECTION
// ══════════════════════════════════════════════════════════════
function ImportSection({ canImport }: { canImport: boolean }) {
  const [importType, setImportType] = useState<'orders' | 'governance'>('orders');
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['orders','governance'] as const).map(t => (
          <button key={t} type="button" onClick={() => setImportType(t)}
            className={`px-4 py-1.5 rounded-lg text-[12.5px] font-medium transition-all
              ${importType === t ? 'bg-[#1f2d45] text-[var(--text)]' : 'text-[var(--text-3)] hover:text-[var(--text-2)]'}`}>
            {t === 'orders' ? '📋 Import Orders' : '🛡 Import Governance'}
          </button>
        ))}
      </div>
      {importType === 'orders'     && <SingleImport canImport={canImport} mode="orders"     />}
      {importType === 'governance' && <SingleImport canImport={canImport} mode="governance" />}
    </div>
  );
}

function SingleImport({ canImport, mode }: { canImport: boolean; mode: 'orders' | 'governance' }) {
  const [dragging,  setDragging]  = useState(false);
  const [file,      setFile]      = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]    = useState<ImportResult | null>(null);
  const [error,     setError]     = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) acceptFile(dropped);
  }, []);

  function acceptFile(f: File) {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setError('Only .xlsx, .xls, or .csv files are accepted');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);

    try {
      const fd = new FormData();
      fd.append('file', file);
      const endpoint = mode === 'governance' ? '/api/governance/import' : '/api/orders/import';
      const res  = await fetch(endpoint, { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok && json.error) { setError(json.error); return; }
      setResult(json);
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function downloadTemplate() {
    try {
      const endpoint = mode === 'governance' ? '/api/governance/template' : '/api/orders/template';
      const filename  = mode === 'governance' ? 'PES-Governance-Import-Template.xlsx' : 'PES-Import-Template.xlsx';
      const res = await fetch(endpoint);
      if (!res.ok) { alert('Failed to download template'); return; }
      await triggerDownload(res, filename);
    } catch {
      alert('Failed to download template — please try again');
    }
  }

  if (!canImport) {
    return (
      <div className="pes-card p-8 text-center">
        <div className="text-4xl mb-3 opacity-30">🔒</div>
        <div className="text-[14px] text-[var(--text-3)]">You don't have permission to import data.</div>
        <p className="text-[12.5px] text-[var(--text-3)] mt-1">Contact your system administrator.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Template download */}
      <div className="pes-card p-5 bg-amber-500/5 border-amber-500/20 flex items-start gap-4">
        <span className="text-2xl flex-shrink-0">📥</span>
        <div className="flex-1">
          <div className="font-semibold text-amber-200 text-[14px] mb-1">Download Import Template first</div>
          <p className="text-[12.5px] text-[var(--text-2)] mb-3">
            Use the template to ensure your data matches the required format. 
            The "Import Template" sheet in the exported Excel shows all column headers and an example row.
          </p>
          <button onClick={downloadTemplate} className="pes-btn-ghost text-[12.5px] border-amber-500/30 text-amber-300 hover:text-amber-200">
            ⬇ Download Import Template (.xlsx)
          </button>
        </div>
      </div>

      {/* Drag-drop zone */}
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${dragging ? 'border-blue-400 bg-blue-500/10' : 'border-[var(--border-2)] hover:border-[#3b4f6b] hover:bg-[var(--surface)]'}
          ${file ? 'border-green-500/50 bg-green-500/5' : ''}
        `}
      >
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />

        {file ? (
          <div>
            <div className="text-3xl mb-2">📄</div>
            <div className="text-[14px] text-green-400 font-semibold">{file.name}</div>
            <div className="text-[12px] text-[var(--text-3)] mt-0.5">
              {(file.size / 1024).toFixed(1)} KB · Click to change
            </div>
          </div>
        ) : (
          <div>
            <div className="text-4xl mb-3 opacity-40">📂</div>
            <div className="text-[14px] text-[var(--text-2)] font-medium">
              Drop your Excel or CSV file here
            </div>
            <div className="text-[12px] text-[var(--text-3)] mt-1">or click to browse · .xlsx, .xls, .csv</div>
          </div>
        )}
      </div>

      {/* Actions */}
      {file && (
        <div className="flex items-center gap-3">
          <button onClick={handleUpload} disabled={uploading}
            className="pes-btn-primary flex items-center gap-2 text-[13px]">
            {uploading ? <><Spinner size={14}/> Importing…</> : '⬆ Start Import'}
          </button>
          <button onClick={() => { setFile(null); setResult(null); setError(null); }}
            className="pes-btn-ghost text-[12.5px] text-[var(--text-3)]">
            ✕ Clear
          </button>
          <span className="text-[11.5px] text-[var(--text-3)] ml-2">
            Rows with errors will be skipped — valid rows will be imported.
          </span>
        </div>
      )}

      {/* Error banner */}
      {error && (
        <div className="pes-card p-4 border-red-500/30 bg-red-500/10">
          <p className="text-red-400 text-[13px]">✕ {error}</p>
        </div>
      )}

      {/* Result */}
      {result && <ImportResultCard result={result} mode={mode} />}

      {/* Instructions */}
      <div className="pes-card p-5">
        <div className="text-[12px] font-bold uppercase tracking-wider text-[var(--text-3)] mb-3">Column Reference</div>
        <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-[12px]">
          {mode === 'orders' ? [
            ['name *',          'Task/order title (required)'],
            ['type',            'PROGRAM | PROJECT | DELIVERABLE | TASK | SUBTASK'],
            ['status',          'NOT_STARTED | IN_PROGRESS | DONE | …'],
            ['priority',        'LOW | MEDIUM | HIGH | CRITICAL'],
            ['unitCode',        'Unit code (e.g. PROC, FIN, HR)'],
            ['projectCode',     'Project code (e.g. GOV-2025)'],
            ['ownerEmail',      'User email address'],
            ['startDate',       'YYYY-MM-DD'],
            ['dueDate',         'YYYY-MM-DD'],
            ['percentComplete', '0 – 100'],
            ['notes',           'Free text'],
            ['links',           'Comma-separated URLs'],
            ['dependencies',    'Comma-separated order codes'],
          ] : [
            ['title *',           'Governance item title (required)'],
            ['type',              'POLICY | PROCEDURE | STANDARD | GUIDELINE | …'],
            ['status',            'DRAFT | ACTIVE | UNDER_REVIEW | SUPERSEDED | ARCHIVED'],
            ['priority',          'LOW | MEDIUM | HIGH | CRITICAL'],
            ['riskLevel',         'LOW | MEDIUM | HIGH | CRITICAL'],
            ['version',           'e.g. 1.0, 2.1'],
            ['unitCode',          'Unit code (e.g. PROC, FIN, HR)'],
            ['ownerEmail',        'User email address'],
            ['reviewerEmail',     'User email address'],
            ['effectiveDate',     'YYYY-MM-DD'],
            ['nextReviewDate',    'YYYY-MM-DD'],
            ['reviewCycleDays',   'Days between reviews (e.g. 365)'],
            ['source',            'Reference / legal source'],
            ['complianceImpact',  'Free text'],
            ['notes',             'Free text'],
            ['evidenceLinks',     'Comma-separated URLs'],
          ].map(([col, desc]) => (
            <div key={col} className="flex gap-2">
              <code className="text-blue-400 flex-shrink-0 w-36">{col}</code>
              <span className="text-[var(--text-3)]">{desc}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Import result display ──────────────────────────────────────
function ImportResultCard({ result, mode }: { result: ImportResult; mode: 'orders' | 'governance' }) {
  const allGood = result.skipped === 0 && result.insertErrors.length === 0;

  return (
    <div className={`pes-card p-5 ${allGood ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{allGood ? '✅' : '⚠'}</span>
        <div>
          <div className={`font-display font-bold text-[16px] ${allGood ? 'text-green-400' : 'text-amber-400'}`}>
            Import Complete
          </div>
          <div className="text-[12px] text-[var(--text-3)]">
            {result.imported} created · {result.skipped} skipped · {result.total} total rows processed
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {[
          { label: 'Created',    value: result.imported, color: '#10b981' },
          { label: 'Skipped',    value: result.skipped,  color: result.skipped > 0 ? '#f59e0b' : '#10b981' },
          { label: 'Total Rows', value: result.total,    color: '#6b7280' },
        ].map(s => (
          <div key={s.label} className="pes-card p-3 text-center">
            <div className="font-display font-bold text-xl" style={{ color: s.color }}>{s.value}</div>
            <div className="text-[10.5px] text-[var(--text-3)] uppercase tracking-wider mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Row errors */}
      {result.errors.length > 0 && (
        <div className="space-y-1">
          <div className="text-[11.5px] font-semibold text-amber-400 mb-2">
            Rows skipped ({result.errors.length}):
          </div>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {result.errors.map((e, i) => (
              <div key={i} className="text-[11.5px] text-[var(--text-2)] bg-[var(--surface)] rounded px-3 py-1.5">
                <span className="text-[var(--text-3)] mr-2">Row {e.row}:</span>
                {e.messages.join(' · ')}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Insert errors */}
      {result.insertErrors.length > 0 && (
        <div className="mt-3 space-y-1">
          <div className="text-[11.5px] font-semibold text-red-400">Database errors:</div>
          {result.insertErrors.map((e, i) => (
            <div key={i} className="text-[11.5px] text-red-300 bg-red-500/10 rounded px-3 py-1.5">{e}</div>
          ))}
        </div>
      )}

      {result.imported > 0 && (
        <div className="mt-4 pt-3 border-t border-[var(--border)]">
          <Link href={mode === 'governance' ? '/governance' : '/orders'}>
            <button className="pes-btn-primary text-[12.5px]">
              → View {mode === 'governance' ? 'Governance Items' : 'Orders'}
            </button>
          </Link>
        </div>
      )}
    </div>
  );
}


// ══════════════════════════════════════════════════════════════
// BULK UPDATE SECTION
// ══════════════════════════════════════════════════════════════
interface UpdateResult {
  updated:  number;
  skipped:  number;
  notFound: number;
  total:    number;
  errors:   { row: number; code: string; messages: string[] }[];
}

function BulkUpdateSection({
  canImport,
  units,
}: {
  canImport: boolean;
  units: { id: string; code: string; name: string }[];
}) {
  const [filterUnit,    setFilterUnit]   = useState('');
  const [filterStatus,  setFilterStatus] = useState('');
  const [downloading,   setDownloading]  = useState(false);

  const [file,      setFile]    = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [result,    setResult]  = useState<UpdateResult | null>(null);
  const [error,     setError]   = useState<string | null>(null);
  const [dragging,  setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function downloadUpdateTemplate() {
    setDownloading(true);
    try {
      const params = new URLSearchParams();
      if (filterUnit)   params.set('unitId', filterUnit);
      if (filterStatus) params.set('status', filterStatus);
      const res = await fetch(`/api/orders/bulk-update-template?${params}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      await triggerDownload(res, `PES-Bulk-Update.xlsx`);
    } catch (e: any) {
      alert(`Download failed: ${e.message}`);
    } finally {
      setDownloading(false);
    }
  }

  function acceptFile(f: File) {
    const name = f.name.toLowerCase();
    if (!name.endsWith('.xlsx') && !name.endsWith('.xls') && !name.endsWith('.csv')) {
      setError('Only .xlsx, .xls, or .csv files are accepted');
      return;
    }
    setFile(f);
    setResult(null);
    setError(null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    setResult(null);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch('/api/orders/bulk-update', { method: 'POST', body: fd });
      const json = await res.json();
      if (!res.ok && json.error) { setError(json.error); return; }
      setResult(json);
    } catch (e: any) {
      setError(`Upload failed: ${e.message}`);
    } finally {
      setUploading(false);
    }
  }

  if (!canImport) {
    
    return (
      <div className="pes-card p-8 text-center">
        <div className="text-4xl mb-3 opacity-30">🔒</div>
        <div className="text-[14px] text-[var(--text-3)]">You do not have permission to update data.</div>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Step 1: Download template */}
      <div className="pes-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-[16px] text-[var(--text)]">Step 1 — Download Current Orders</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1">
            Download your existing orders as an editable Excel file. Then modify status, priority, % complete, dates, etc.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="pes-label">Filter: Unit (optional)</label>
            <select value={filterUnit} onChange={e => setFilterUnit(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Units</option>
              {units.map(u => <option key={u.id} value={u.id}>{u.code} — {u.name}</option>)}
            </select>
          </div>
          <div>
            <label className="pes-label">Filter: Status (optional)</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="pes-input w-full mt-1 text-[13px]">
              <option value="">All Statuses</option>
              {['NOT_STARTED','IN_PROGRESS','UNDER_REVIEW','BLOCKED','ON_HOLD'].map(s => (
                <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t border-[var(--border)]">
          <button onClick={downloadUpdateTemplate} disabled={downloading}
            className="pes-btn-primary flex items-center gap-2 text-[13px]" style={{ background: '#0284c7' }}>
            {downloading ? <><Spinner size={14}/> Generating…</> : '⬇ Download Editable Template'}
          </button>
          <span className="text-[11.5px] text-[var(--text-3)]">Up to 500 orders · Includes Instructions sheet</span>
        </div>
      </div>

      {/* Step 2: Upload updated file */}
      <div className="pes-card p-6 space-y-4">
        <div>
          <h2 className="font-display font-bold text-[16px] text-[var(--text)]">Step 2 — Upload Updated File</h2>
          <p className="text-[12.5px] text-[var(--text-3)] mt-1">
            Upload the edited file. Orders are matched by <code className="text-purple-400">orderCode</code>.
            Only changed fields are updated.
          </p>
        </div>

        <div
          onDragOver={e => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) acceptFile(f); }}
          onClick={() => fileRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
            ${dragging ? 'border-blue-400 bg-blue-500/10' : file ? 'border-green-500/50 bg-green-500/5' : 'border-[var(--border-2)] hover:border-[#3b4f6b] hover:bg-[var(--surface)]'}`}
        >
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) acceptFile(f); }} />
          {file ? (
            <div>
              <div className="text-2xl mb-1">📄</div>
              <div className="text-[14px] text-green-400 font-semibold">{file.name}</div>
              <div className="text-[11.5px] text-[var(--text-3)] mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to change</div>
            </div>
          ) : (
            <div>
              <div className="text-3xl mb-2 opacity-30">📂</div>
              <div className="text-[13.5px] text-[var(--text-2)]">Drop updated Excel/CSV here or click to browse</div>
            </div>
          )}
        </div>

        {file && (
          <div className="flex items-center gap-3">
            <button onClick={handleUpload} disabled={uploading}
              className="pes-btn-primary flex items-center gap-2 text-[13px]" style={{ background: '#059669' }}>
              {uploading ? <><Spinner size={14}/> Updating…</> : '⬆ Apply Updates'}
            </button>
            <button onClick={() => { setFile(null); setResult(null); setError(null); }}
              className="pes-btn-ghost text-[12.5px] text-[var(--text-3)]">
              ✕ Clear
            </button>
          </div>
        )}

        {error && (
          <div className="pes-card p-4 border-red-500/30 bg-red-500/10">
            <p className="text-red-400 text-[13px]">✕ {error}</p>
          </div>
        )}

        {result && (
          <div className={`pes-card p-5 ${result.errors.length === 0 ? 'border-green-500/30 bg-green-500/5' : 'border-amber-500/30 bg-amber-500/5'}`}>
            <div className="flex items-center gap-3 mb-4">
              <span className="text-2xl">{result.errors.length === 0 ? '✅' : '⚠'}</span>
              <div>
                <div className={`font-bold text-[15px] ${result.errors.length === 0 ? 'text-green-400' : 'text-amber-400'}`}>
                  Bulk Update Complete
                </div>
                <div className="text-[12px] text-[var(--text-3)]">
                  {result.updated} updated · {result.skipped} skipped · {result.notFound} not found · {result.total} rows
                </div>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3 mb-3">
              {[
                { label: 'Updated',   value: result.updated,  color: '#10b981' },
                { label: 'Skipped',   value: result.skipped,  color: '#6b7280' },
                { label: 'Not Found', value: result.notFound, color: result.notFound > 0 ? '#ef4444' : '#10b981' },
                { label: 'Total',     value: result.total,    color: '#6b7280' },
              ].map(s => (
                <div key={s.label} className="pes-card p-3 text-center">
                  <div className="font-bold text-xl" style={{ color: s.color }}>{s.value}</div>
                  <div className="text-[10.5px] text-[var(--text-3)] uppercase tracking-wider mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
            {result.errors.length > 0 && (
              <div className="max-h-48 overflow-y-auto space-y-1 mt-2">
                {result.errors.slice(0, 20).map((e, i) => (
                  <div key={i} className="text-[11.5px] text-[var(--text-2)] bg-[var(--surface)] rounded px-3 py-1.5">
                    <span className="text-[var(--text-3)] mr-2">Row {e.row} ({e.code}):</span>
                    {e.messages.join(' · ')}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Info */}
      <div className="pes-card p-4 border-blue-500/20 bg-blue-500/5">
        <p className="text-[12.5px] text-blue-300 font-semibold mb-1">📋 Updatable fields:</p>
        <p className="text-[12px] text-[var(--text-2)]">
          status · priority · % complete · dueDate · ragOverride · ownerEmail · notes
        </p>
        <p className="text-[11.5px] text-[var(--text-3)] mt-1">
          All updates are audit-logged. Rows with unchanged values are automatically skipped.
          Maximum 500 rows per upload.
        </p>
      </div>
    </div>
  );
}

// ── Utility: trigger browser file download from fetch response ─
async function triggerDownload(res: Response, defaultName: string) {
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = disposition.match(/filename="([^"]+)"/);
  const name  = match?.[1] ?? defaultName;

  const blob = await res.blob();
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
