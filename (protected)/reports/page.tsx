"use client";

import { useState, useEffect, useCallback } from "react";

// ── Types ──
interface ReportType {
  id: string;
  label: string;
  labelAr: string;
  description: string;
  icon: string;
  color: string;
}

const REPORT_TYPES: ReportType[] = [
  {
    id: "executive",
    label: "Executive Summary",
    labelAr: "تقرير تنفيذي عام",
    description: "All orders with status, progress, due dates, owner, and unit",
    icon: "📊",
    color: "bg-blue-50 border-blue-200 text-blue-800",
  },
  {
    id: "unit",
    label: "Unit Report",
    labelAr: "تقرير الوحدة",
    description: "Orders for a specific unit with milestones breakdown",
    icon: "🏢",
    color: "bg-emerald-50 border-emerald-200 text-emerald-800",
  },
  {
    id: "governance",
    label: "Governance Report",
    labelAr: "تقرير الحوكمة",
    description: "Governance items with status, evidence, and review dates",
    icon: "🛡️",
    color: "bg-purple-50 border-purple-200 text-purple-800",
  },
  {
    id: "overdue",
    label: "Overdue Orders",
    labelAr: "تقرير المتأخرات",
    description: "All overdue orders with days overdue and owner",
    icon: "⚠️",
    color: "bg-red-50 border-red-200 text-red-800",
  },
  {
    id: "critical",
    label: "Critical Orders",
    labelAr: "تقرير المشاريع الحرجة",
    description: "Critical priority orders with risk/issue counts",
    icon: "🔴",
    color: "bg-orange-50 border-orange-200 text-orange-800",
  },
  {
    id: "due-soon",
    label: "Due Soon",
    labelAr: "تقرير قريب التسليم",
    description: "Orders due within 7/14/30 days",
    icon: "⏰",
    color: "bg-amber-50 border-amber-200 text-amber-800",
  },
];

const STATUSES = [
  "NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED", "DELAYED",
];

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"];

export default function ReportsPage() {
  const [selectedReport, setSelectedReport] = useState<string>("executive");
  const [units, setUnits] = useState<any[]>([]);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState<any[]>([]);
  const [previewCount, setPreviewCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Fetch units for filter dropdown
  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((d) => setUnits(d.data || d || []))
      .catch(() => {});
  }, []);

  // Fetch preview
  const fetchPreview = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ type: selectedReport, ...filters });
      const res = await fetch(`/api/reports?${params}`);
      const json = await res.json();
      setPreview(json.data || []);
      setPreviewCount(json.count || 0);
    } catch {
      setPreview([]);
    }
    setLoading(false);
  }, [selectedReport, filters]);

  useEffect(() => {
    fetchPreview();
  }, [fetchPreview]);

  // Download Excel
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: selectedReport, filters }),
      });
      if (!res.ok) throw new Error("Download failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_${selectedReport}_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (e) {
      alert("Error downloading report");
    }
    setDownloading(false);
  };

  const updateFilter = (key: string, value: string) => {
    setFilters((prev) => {
      if (!value) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return { ...prev, [key]: value };
    });
  };

  const currentReport = REPORT_TYPES.find((r) => r.id === selectedReport)!;

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">📋 Reports Center</h1>
        <p className="text-gray-500 text-sm">Generate and download detailed reports</p>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-8">
        {REPORT_TYPES.map((rt) => (
          <button
            key={rt.id}
            onClick={() => setSelectedReport(rt.id)}
            className={`
              p-4 rounded-xl border-2 text-left transition-all duration-200 hover:shadow-md
              ${selectedReport === rt.id
                ? "border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200"
                : "border-gray-200 bg-white hover:border-gray-300"
              }
            `}
          >
            <div className="text-2xl mb-2">{rt.icon}</div>
            <div className="font-semibold text-sm text-gray-900">{rt.label}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{rt.labelAr}</div>
          </button>
        ))}
      </div>

      {/* Selected Report Info + Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
        <div className={`px-6 py-4 rounded-t-xl border-b ${currentReport.color}`}>
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold">
                {currentReport.icon} {currentReport.label}
              </h2>
              <p className="text-sm opacity-80 mt-0.5">{currentReport.description}</p>
            </div>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="
                flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg
                hover:bg-green-700 transition font-medium text-sm shadow-sm
                disabled:opacity-50 disabled:cursor-not-allowed
              "
            >
              {downloading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
                  </svg>
                  Generating...
                </>
              ) : (
                <>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" />
                  </svg>
                  Download Excel
                </>
              )}
            </button>
          </div>
        </div>

        {/* Filters Row */}
        <div className="px-6 py-4 flex flex-wrap gap-3 border-b border-gray-100 bg-gray-50/50">
          {/* Unit Filter */}
          <select
            value={filters.unitCode || ""}
            onChange={(e) => updateFilter("unitCode", e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          >
            <option value="">All Units</option>
            {units.map((u: any) => (
              <option key={u.code} value={u.code}>
                {u.nameAr || u.nameEn || u.code}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          {selectedReport !== "governance" && (
            <select
              value={filters.status || ""}
              onChange={(e) => updateFilter("status", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            >
              <option value="">All Statuses</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          )}

          {/* Priority Filter */}
          {selectedReport !== "governance" && selectedReport !== "critical" && (
            <select
              value={filters.priority || ""}
              onChange={(e) => updateFilter("priority", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            >
              <option value="">All Priorities</option>
              {PRIORITIES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}

          {/* Due Days Filter (for due-soon) */}
          {selectedReport === "due-soon" && (
            <select
              value={filters.dueDays || "14"}
              onChange={(e) => updateFilter("dueDays", e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            >
              <option value="7">Due within 7 days</option>
              <option value="14">Due within 14 days</option>
              <option value="30">Due within 30 days</option>
            </select>
          )}

          {/* Date Range */}
          <input
            type="date"
            value={filters.fromDate || ""}
            onChange={(e) => updateFilter("fromDate", e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            placeholder="From Date"
          />
          <input
            type="date"
            value={filters.toDate || ""}
            onChange={(e) => updateFilter("toDate", e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
            placeholder="To Date"
          />

          {/* Clear Filters */}
          {Object.keys(filters).length > 0 && (
            <button
              onClick={() => setFilters({})}
              className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition"
            >
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <span className="text-sm font-medium text-gray-700">
            Preview ({previewCount} records{previewCount >= 50 ? ", showing first 50" : ""})
          </span>
          {loading && (
            <svg className="animate-spin h-4 w-4 text-blue-500" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
            </svg>
          )}
        </div>

        <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
          {preview.length === 0 ? (
            <div className="p-12 text-center text-gray-400">
              <div className="text-4xl mb-3">📭</div>
              <p>No data found for the selected filters</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  {selectedReport === "governance" ? (
                    <>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Title</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Type</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Review Date</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Order #</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Title</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Unit</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Priority</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Progress</th>
                      <th className="px-4 py-3 text-left font-semibold text-gray-600">Due Date</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.map((item: any, idx: number) => (
                  <tr key={item.id || idx} className="hover:bg-blue-50/30 transition">
                    {selectedReport === "governance" ? (
                      <>
                        <td className="px-4 py-3 font-medium text-gray-900">{item.title}</td>
                        <td className="px-4 py-3 text-gray-600">{item.unit?.nameAr || item.unitCode}</td>
                        <td className="px-4 py-3 text-gray-600">{item.type || "—"}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={item.status} />
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {item.reviewDate ? new Date(item.reviewDate).toLocaleDateString() : "—"}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-3 font-mono text-xs text-gray-500">{item.orderNumber || item.id?.slice(0, 8)}</td>
                        <td className="px-4 py-3 font-medium text-gray-900 max-w-[250px] truncate">{item.title}</td>
                        <td className="px-4 py-3 text-gray-600">{item.unit?.nameAr || item.unitCode}</td>
                        <td className="px-4 py-3"><StatusBadge status={item.status} /></td>
                        <td className="px-4 py-3"><PriorityBadge priority={item.priority} /></td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-blue-500 rounded-full"
                                style={{ width: `${item.progress || 0}%` }}
                              />
                            </div>
                            <span className="text-xs text-gray-500">{item.progress || 0}%</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Badges ──
function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    NOT_STARTED: "bg-gray-100 text-gray-700",
    IN_PROGRESS: "bg-blue-100 text-blue-700",
    ON_HOLD: "bg-yellow-100 text-yellow-700",
    COMPLETED: "bg-green-100 text-green-700",
    CANCELLED: "bg-gray-100 text-gray-400",
    DELAYED: "bg-red-100 text-red-700",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>
      {status?.replace(/_/g, " ")}
    </span>
  );
}

function PriorityBadge({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    LOW: "bg-gray-100 text-gray-600",
    MEDIUM: "bg-blue-100 text-blue-600",
    HIGH: "bg-orange-100 text-orange-600",
    CRITICAL: "bg-red-100 text-red-700 font-bold",
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[priority] || "bg-gray-100"}`}>
      {priority}
    </span>
  );
}
