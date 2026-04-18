// src/lib/business-logic/orders.ts
// Server-side business rules — mirrors Excel formulas, improved

import type { RAGStatus, OrderStatus, Order, OrderWithComputed } from '@/types';

const NEAR_DUE_DAYS = 7;
const HEALTH_RED_THRESHOLD = 50;
const HEALTH_AMBER_THRESHOLD = 80;

/**
 * Compute RAG status from order data.
 * Priority: ragOverride > auto calculation
 */
export function computeRAG(order: {
  status: OrderStatus;
  percentComplete: number;
  dueDate?: string | null;
  ragOverride?: RAGStatus | null;
}): RAGStatus {
  if (order.ragOverride) return order.ragOverride;

  const { status, percentComplete, dueDate } = order;

  if (!status) return 'GREY';
  if (status === 'DONE' || status === 'CANCELLED') return 'GREY';
  if (status === 'ON_HOLD') return 'BLUE';
  if (status === 'BLOCKED') return 'RED';

  if (!dueDate) {
    if (percentComplete === 100) return 'GREY';
    return 'GREEN';
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffDays = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0 && percentComplete < 100) return 'RED';
  if (diffDays <= NEAR_DUE_DAYS) return 'AMBER';
  return 'GREEN';
}

/**
 * Compute planned % based on time elapsed between start and due date.
 * Returns null if dates are missing.
 */
export function computePlannedPercent(
  startDate?: string | null,
  dueDate?: string | null
): number | null {
  if (!startDate || !dueDate) return null;

  const start = new Date(startDate).getTime();
  const due = new Date(dueDate).getTime();
  const today = new Date().getTime();

  if (due <= start) return 100;

  const total = due - start;
  const elapsed = today - start;
  return Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
}

/**
 * Compute project-level rollup % from all non-cancelled tasks.
 * Method: simple average of percentComplete (leaf tasks only recommended).
 */
export function computeProjectRollup(tasks: Array<{ percentComplete: number; status: OrderStatus }>): number {
  const activeTasks = tasks.filter(t => t.status !== 'CANCELLED');
  if (!activeTasks.length) return 0;
  const sum = activeTasks.reduce((acc, t) => acc + t.percentComplete, 0);
  return Math.round(sum / activeTasks.length);
}

/**
 * Compute project health from rollup %.
 */
export function computeProjectHealth(rollupPct: number): 'RED' | 'AMBER' | 'GREEN' {
  if (rollupPct < HEALTH_RED_THRESHOLD) return 'RED';
  if (rollupPct < HEALTH_AMBER_THRESHOLD) return 'AMBER';
  return 'GREEN';
}

/**
 * Check if an order is overdue.
 */
export function isOverdue(order: { status: OrderStatus; percentComplete: number; dueDate?: string | null }): boolean {
  if (order.status === 'DONE' || order.status === 'CANCELLED') return false;
  if (!order.dueDate) return false;
  return new Date(order.dueDate) < new Date() && order.percentComplete < 100;
}

/**
 * Determine if due date change should increment rescheduleCount.
 * Only increments if the new due date is later than the old one.
 */
export function shouldIncrementReschedule(
  oldDueDate: string | null | undefined,
  newDueDate: string | null | undefined
): boolean {
  if (!oldDueDate || !newDueDate) return false;
  if (oldDueDate === newDueDate) return false;
  return new Date(newDueDate) > new Date(oldDueDate);
}

/**
 * Enrich an order with all computed fields.
 */
export function enrichOrder(order: Order): OrderWithComputed {
  const effectiveRAG = computeRAG(order);
  return {
    ...order,
    effectiveRAG,
    isOverdue: isOverdue(order),
    plannedPercent: computePlannedPercent(order.startDate, order.dueDate) ?? undefined,
  };
}
