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

  // Fetch on mount + every 60 seconds
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 60000);
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
        className="relative p-2 rounded-lg hover:bg-slate-700/50 transition text-slate-300 hover:text-white"
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
          <span className="absolute -top-0.5 -right-0.5 w-5 h-5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute right-0 top-12 w-[400px] bg-slate-800 border border-slate-700 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-700/30">
            <div>
              <span className="text-sm font-semibold text-white">Notifications</span>
              {unreadCount > 0 && (
                <span className="ml-2 px-1.5 py-0.5 bg-red-500/20 text-red-400 rounded-full text-[10px] font-bold">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-xs text-blue-400 hover:text-blue-300 transition"
                >
                  Mark all read
                </button>
              )}
              <button
                onClick={runRules}
                disabled={loading}
                className="text-xs text-slate-400 hover:text-white px-2 py-1 rounded border border-slate-600 hover:bg-slate-700 transition disabled:opacity-50"
                title="Run business rules now"
              >
                {loading ? "⏳" : "⚡"} Scan
              </button>
            </div>
          </div>

          {/* Notifications List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-8 text-center text-slate-500">
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
                      px-4 py-3 border-b border-slate-700/50 border-l-4 cursor-pointer
                      transition hover:bg-slate-700/30
                      ${getSeverityColor(n.severity)}
                      ${!n.isRead ? "bg-slate-700/20" : ""}
                    `}
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-lg mt-0.5">{getIcon(n.type)}</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-sm font-medium truncate ${!n.isRead ? "text-white" : "text-slate-400"}`}>
                            {n.title}
                          </span>
                          {!n.isRead && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">{n.message}</p>
                        <div className="flex items-center gap-3 mt-1.5">
                          <span className="text-[10px] text-slate-500">{timeAgo(n.createdAt)}</span>
                          {n.entityCode && (
                            <span className="text-[10px] font-mono text-blue-400/70">{n.entityCode}</span>
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
