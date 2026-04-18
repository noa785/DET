// src/hooks/useOrders.ts — Batch 3 updated

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

// ── Generic fetcher ────────────────────────────────────────────
export function useFetch<T>(url: string, deps: any[] = []) {
  const [data, setData]       = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await fetch(url);
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const json = await r.json();
      setData(json.data ?? json);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [url]);

  useEffect(() => { fetch_(); }, deps);

  return { data, loading, error, refetch: fetch_ };
}

// ── Debounce hook ──────────────────────────────────────────────
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debouncedValue;
}

// ── Grid save queue ────────────────────────────────────────────
// Debounced + collapsing: rapid edits to same cell collapse to last value.
// Flushes after 700ms idle, or immediately when flush() is called (Ctrl+S).
export interface SaveItem { orderId: string; field: string; value: any; }

export function useGridSaveQueue(onFlush: (items: SaveItem[]) => Promise<void>) {
  const queueRef = useRef<Map<string, SaveItem>>(new Map());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);

  const doFlush = useCallback(async () => {
    if (queueRef.current.size === 0) return;
    const batch = Array.from(queueRef.current.values());
    queueRef.current.clear();
    setSaving(true);
    try { await onFlush(batch); }
    finally { setSaving(false); }
  }, [onFlush]);

  const enqueue = useCallback((item: SaveItem) => {
    // Same orderId+field collapses rapid edits (e.g. slider changes)
    queueRef.current.set(`${item.orderId}__${item.field}`, item);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doFlush, 700);
  }, [doFlush]);

  const flush = useCallback(async () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    await doFlush();
  }, [doFlush]);

  return { enqueue, flush, saving };
}

// ── Lookup data for form selects ───────────────────────────────
export interface SelectOption { id: string; label: string; code?: string; color?: string; }

export function useSelectData() {
  const [units,    setUnits]    = useState<SelectOption[]>([]);
  const [projects, setProjects] = useState<SelectOption[]>([]);
  const [users,    setUsers]    = useState<SelectOption[]>([]);
  const [loading,  setLoading]  = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [u, p, us] = await Promise.all([
          fetch('/api/units').then(r => r.json()),
          fetch('/api/projects').then(r => r.json()),
          fetch('/api/users').then(r => r.json()),
        ]);
        setUnits(   (u.data  ?? []).map((x: any) => ({ id: x.id, label: x.name, code: x.code, color: x.colorHex })));
        setProjects((p.data  ?? []).map((x: any) => ({ id: x.id, label: x.name, code: x.code })));
        setUsers(   (us.data ?? []).map((x: any) => ({ id: x.id, label: x.name })));
      } catch { /* silently fail */ }
      finally { setLoading(false); }
    }
    load();
  }, []);

  return { units, projects, users, loading };
}
