// src/components/NotificationBell.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  severity: string;
  isRead: boolean;
  entityType: string | null;
  entityId: string | null;
  entityCode: string | null;
  createdAt: string;
}

export default function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications?limit=15");
      const json = await res.json();
      setNotifications(json.data || []);
      setUnreadCount(json.unreadCount || 0);
    } catch {}
  }, []);

  // Fetch on mount + every 30 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000);
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markAsRead = async (id: string) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAll: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
  };

  const runRules = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { method: "POST" });
      const json = await res.json();
      if (json.success) {
        await fetchNotifications();
      }
    } catch {}
    setLoading(false);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "AUTO_DELAYED": return "🔴";
      case "ORDER_DUE_SOON": return "⏰";
      case "GOV_REVIEW_OVERDUE": return "🛡️";
      case "GOV_REVIEW_SOON": return "📋";
      case "GOV_REVIEW_REQUESTED": return "🛡️";
      default: return "🔔";
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case "critical": return "border-l-red-500";
      case "warning": return "border-l-amber-500";
      default: return "border-l-blue-500";
    }
  };

  const getEntityLink = (n: Notification) => {
    // Governance review notifications: take user to the order so they can review and add policy
    if (n.type === "GOV_REVIEW_REQUESTED" && n.entityId) return `/orders/${n.entityId}`;
    if (n.entityType === "order" && n.entityId) return `/orders/${n.entityId}`;
    if (n.entityType === "governance" && n.entityId) return `/governance`;
    return null;
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  };

  return (
    <div ref={ref} className="relative">
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg transition"
        style={{
          background: 'transparent',
          color: 'var(--text-2)',
          border: '1px solid transparent',
        }}
        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; }}
        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; }}
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
          />
        </svg>
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse" style={{ background: '#DC2626' }}>
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[400px] rounded-xl shadow-2xl z-50 overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {/* Header */}
          <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
            <div>
              <span className="text-sm font-semibold" style={{ color: 'var(--text)' }}>Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold" style={{ background: 'rgba(220,38,38,0.12)', color: 'var(--red)' }}>
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs transition"
                  style={{ color: 'var(--accent)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent-2)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = 'var(--accent)'}
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={runRules}
                disabled={loading}
                className="text-xs px-2 py-1 rounded transition disabled:opacity-50"
                style={{ color: 'var(--text-2)', border: '1px solid var(--border-2)', background: 'var(--surface)' }}
                onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = 'var(--surface-3)'; (e.currentTarget as HTMLElement).style.color = 'var(--text)'; } }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'var(--surface)'; (e.currentTarget as HTMLElement).style.color = 'var(--text-2)'; }}
                title="Run business rules now"
              >
                {loading ? "⏳" : "⚡"} Scan
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center" style={{ color: 'var(--text-3)' }}>
                <div className="text-3xl mb-2">🔔</div>
                <p className="text-sm">No notifications yet</p>
                <p className="text-xs mt-1">Click ⚡ Scan to check for alerts</p>
              </div>
            ) : (
              notifications.map((n) => {
                const link = getEntityLink(n);
                const Content = (
                  <div
                    key={n.id}
                    onClick={() => !n.isRead && markAsRead(n.id)}
                    className={`
                      px-4 py-3 border-l-4 cursor-pointer transition
                      ${getSeverityColor(n.severity)}
                    `}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      background: !n.isRead ? 'rgba(123,183,232,0.06)' : 'transparent',
                    }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--surface-2)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = !n.isRead ? 'rgba(123,183,232,0.06)' : 'transparent'}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{getIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-medium truncate" style={{ color: !n.isRead ? 'var(--text)' : 'var(--text-2)' }}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: 'var(--accent)' }} />
                          )}
                        </div>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-2)' }}>{n.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px]" style={{ color: 'var(--text-3)' }}>{timeAgo(n.createdAt)}</span>
                          {n.entityCode && (
                            <span className="text-[10px] font-mono" style={{ color: 'var(--accent-2)' }}>{n.entityCode}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );

                return link ? (
                  <Link key={n.id} href={link}>{Content}</Link>
                ) : (
                  <div key={n.id}>{Content}</div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
