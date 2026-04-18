// src/components/ui/badges.tsx
'use client';

import type { OrderStatus, Priority, RAGStatus } from '@/types';

// ── Status Badge ────────────────────────────────────────────────
const STATUS_STYLES: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  NOT_STARTED:  { bg: 'rgba(100,116,139,0.10)', text: '#64748b', label: 'Not Started'  },
  IN_PROGRESS:  { bg: 'rgba(59,130,246,0.12)',  text: '#3b82f6', label: 'In Progress'  },
  UNDER_REVIEW: { bg: 'rgba(245,158,11,0.12)',  text: '#d97706', label: 'Under Review' },
  BLOCKED:      { bg: 'rgba(239,68,68,0.12)',   text: '#ef4444', label: 'Blocked'      },
  ON_HOLD:      { bg: 'rgba(107,114,128,0.10)', text: '#9ca3af', label: 'On Hold'      },
  DONE:         { bg: 'rgba(16,185,129,0.12)',  text: '#10b981', label: 'Done'         },
  CANCELLED:    { bg: 'rgba(107,114,128,0.08)', text: '#6b7280', label: 'Cancelled'    },
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  const s = STATUS_STYLES[status] ?? STATUS_STYLES.NOT_STARTED;
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center',
      padding: '2px 8px', borderRadius: 99,
      fontSize: 10.5, fontWeight: 600, whiteSpace: 'nowrap',
      letterSpacing: '0.01em',
      background: s.bg, color: s.text,
    }}>
      {s.label}
    </span>
  );
}

// ── Priority Badge ──────────────────────────────────────────────
const PRIORITY_STYLES: Record<Priority, { dot: string; text: string }> = {
  LOW:      { dot: '#94a3b8', text: '#94a3b8' },
  MEDIUM:   { dot: '#f59e0b', text: '#d97706' },
  HIGH:     { dot: '#f87171', text: '#ef4444' },
  CRITICAL: { dot: '#ef4444', text: '#dc2626' },
};

export function PriorityBadge({ priority }: { priority: Priority }) {
  const s = PRIORITY_STYLES[priority] ?? PRIORITY_STYLES.LOW;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11, fontWeight: 600, color: s.text }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.dot, flexShrink: 0 }} />
      {priority.charAt(0) + priority.slice(1).toLowerCase()}
    </span>
  );
}

// ── RAG Dot ─────────────────────────────────────────────────────
const RAG_COLORS: Record<RAGStatus, { color: string; label: string }> = {
  RED:   { color: '#ef4444', label: 'Red'   },
  AMBER: { color: '#f59e0b', label: 'Amber' },
  GREEN: { color: '#10b981', label: 'Green' },
  BLUE:  { color: '#3b82f6', label: 'Blue'  },
  GREY:  { color: '#6b7280', label: 'Grey'  },
};

export function RAGDot({ rag, showLabel = false }: { rag: RAGStatus; showLabel?: boolean }) {
  const { color, label } = RAG_COLORS[rag] ?? RAG_COLORS.GREY;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
        background: color, boxShadow: `0 0 6px ${color}80`,
      }} />
      {showLabel && <span style={{ fontSize: 11, color, fontWeight: 600 }}>{label}</span>}
    </span>
  );
}

// ── Progress Bar ────────────────────────────────────────────────
export function ProgressBar({ value, size = 'md' }: { value: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 4 : 6;
  const color =
    value === 100 ? '#10b981' :
    value >= 70   ? '#3b82f6' :
    value >= 40   ? '#f59e0b' :
                    '#6b7280';
  return (
    <div style={{ width: '100%', height: h, background: 'var(--surface-3)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{
        height: h, borderRadius: 99, background: color,
        width: `${Math.min(100, value)}%`,
        transition: 'width 0.3s ease',
      }} />
    </div>
  );
}

// ── Spinner ─────────────────────────────────────────────────────
export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite', color: 'var(--accent)' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeOpacity="0.2" />
      <path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

// ── Empty State ─────────────────────────────────────────────────
export function EmptyState({ icon, title, sub, action }: {
  icon: string; title: string; sub?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '64px 16px', textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12, opacity: 0.4 }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{title}</div>
      {sub && <div style={{ fontSize: 13, color: 'var(--text-2)', maxWidth: 360 }}>{sub}</div>}
      {action && (
        <button onClick={action.onClick} className="pes-btn pes-btn-primary" style={{ marginTop: 16, fontSize: 13 }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
