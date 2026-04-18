"use client";

import { useState, useEffect } from "react";

export interface OrderFilters {
  unitCodes: string[];
  statuses: string[];
  priorities: string[];
  overdue: boolean | null;
  dueSoon: number | null; // 7, 14, 30
  progressMin: number;
  progressMax: number;
  owner: string;
  search: string;
}

export const DEFAULT_FILTERS: OrderFilters = {
  unitCodes: [],
  statuses: [],
  priorities: [],
  overdue: null,
  dueSoon: null,
  progressMin: 0,
  progressMax: 100,
  owner: "",
  search: "",
};

const STATUSES = [
  { value: "NOT_STARTED", label: "Not Started", color: "bg-gray-200" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-200" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-yellow-200" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-200" },
  { value: "DELAYED", label: "Delayed", color: "bg-red-200" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-gray-300" },
];

const PRIORITIES = [
  { value: "LOW", label: "Low", color: "bg-gray-200" },
  { value: "MEDIUM", label: "Medium", color: "bg-blue-200" },
  { value: "HIGH", label: "High", color: "bg-orange-200" },
  { value: "CRITICAL", label: "Critical", color: "bg-red-200" },
];

interface Props {
  filters: OrderFilters;
  onChange: (filters: OrderFilters) => void;
  onSaveView?: (name: string, filters: OrderFilters) => void;
  savedViews?: { id: string; name: string; filters: string }[];
  onLoadView?: (filters: OrderFilters) => void;
  onDeleteView?: (id: string) => void;
}

export default function AdvancedFilters({
  filters,
  onChange,
  onSaveView,
  savedViews = [],
  onLoadView,
  onDeleteView,
}: Props) {
  const [units, setUnits] = useState<any[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [viewName, setViewName] = useState("");
  const [showSaveDialog, setShowSaveDialog] = useState(false);

  useEffect(() => {
    fetch("/api/units")
      .then((r) => r.json())
      .then((d) => setUnits(d.data || d || []))
      .catch(() => {});
  }, []);

  const activeCount = [
    filters.unitCodes.length > 0,
    filters.statuses.length > 0,
    filters.priorities.length > 0,
    filters.overdue !== null,
    filters.dueSoon !== null,
    filters.progressMin > 0 || filters.progressMax < 100,
    filters.owner !== "",
    filters.search !== "",
  ].filter(Boolean).length;

  const toggleMulti = (key: "unitCodes" | "statuses" | "priorities", value: string) => {
    const current = filters[key];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange({ ...filters, [key]: next });
  };

  const handleClear = () => onChange({ ...DEFAULT_FILTERS });

  const handleSaveView = () => {
    if (!viewName.trim()) return;
    onSaveView?.(viewName.trim(), filters);
    setViewName("");
    setShowSaveDialog(false);
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4">
      {/* Top Bar: Search + Toggle */}
      <div className="px-4 py-3 flex items-center gap-3 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search orders by title, number, or owner..."
            value={filters.search}
            onChange={(e) => onChange({ ...filters, search: e.target.value })}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
        </div>

        {/* Saved Views Dropdown */}
        {savedViews.length > 0 && (
          <select
            onChange={(e) => {
              const view = savedViews.find((v) => v.id === e.target.value);
              if (view) {
                try {
                  const parsed = JSON.parse(view.filters);
                  onLoadView?.(parsed);
                } catch {}
              }
            }}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
            defaultValue=""
          >
            <option value="" disabled>📂 Saved Views</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>{v.name}</option>
            ))}
          </select>
        )}

        {/* Toggle Advanced */}
        <button
          onClick={() => setExpanded(!expanded)}
          className={`
            flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border transition
            ${expanded
              ? "bg-blue-50 border-blue-300 text-blue-700"
              : "bg-white border-gray-300 text-gray-600 hover:bg-gray-50"
            }
          `}
        >
          <svg className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
          </svg>
          Filters
          {activeCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-xs">
              {activeCount}
            </span>
          )}
        </button>

        {/* Clear */}
        {activeCount > 0 && (
          <button
            onClick={handleClear}
            className="px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition"
          >
            ✕ Clear All
          </button>
        )}

        {/* Save View */}
        {onSaveView && (
          <button
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            className="px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg border border-gray-300 transition"
          >
            💾 Save View
          </button>
        )}
      </div>

      {/* Save View Dialog */}
      {showSaveDialog && (
        <div className="px-4 py-3 border-t border-gray-100 bg-blue-50/50 flex items-center gap-3">
          <input
            type="text"
            placeholder="View name (e.g., My Overdue Critical)..."
            value={viewName}
            onChange={(e) => setViewName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSaveView()}
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
          />
          <button
            onClick={handleSaveView}
            disabled={!viewName.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition"
          >
            Save
          </button>
          <button
            onClick={() => setShowSaveDialog(false)}
            className="px-3 py-2 text-gray-500 hover:bg-gray-100 rounded-lg text-sm transition"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Expanded Filters */}
      {expanded && (
        <div className="px-4 py-4 border-t border-gray-100 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Units Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Unit</label>
            <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
              {units.map((u: any) => (
                <button
                  key={u.code}
                  onClick={() => toggleMulti("unitCodes", u.code)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium border transition
                    ${filters.unitCodes.includes(u.code)
                      ? "bg-blue-100 border-blue-300 text-blue-700"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  {u.nameAr || u.code}
                </button>
              ))}
            </div>
          </div>

          {/* Status Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Status</label>
            <div className="flex flex-wrap gap-1.5">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => toggleMulti("statuses", s.value)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium border transition
                    ${filters.statuses.includes(s.value)
                      ? `${s.color} border-current font-bold`
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Priority Multi-select */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Priority</label>
            <div className="flex flex-wrap gap-1.5">
              {PRIORITIES.map((p) => (
                <button
                  key={p.value}
                  onClick={() => toggleMulti("priorities", p.value)}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium border transition
                    ${filters.priorities.includes(p.value)
                      ? `${p.color} border-current font-bold`
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Quick Filters + Progress Range */}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Quick Filters</label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => onChange({ ...filters, overdue: filters.overdue === true ? null : true })}
                  className={`
                    px-2.5 py-1 rounded-full text-xs font-medium border transition
                    ${filters.overdue === true
                      ? "bg-red-100 border-red-300 text-red-700 font-bold"
                      : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                    }
                  `}
                >
                  ⚠️ Overdue
                </button>
                {[7, 14, 30].map((d) => (
                  <button
                    key={d}
                    onClick={() => onChange({ ...filters, dueSoon: filters.dueSoon === d ? null : d })}
                    className={`
                      px-2.5 py-1 rounded-full text-xs font-medium border transition
                      ${filters.dueSoon === d
                        ? "bg-amber-100 border-amber-300 text-amber-700 font-bold"
                        : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50"
                      }
                    `}
                  >
                    ⏰ {d}d
                  </button>
                ))}
              </div>
            </div>

            {/* Progress Range */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">
                Progress: {filters.progressMin}%–{filters.progressMax}%
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="range"
                  min="0" max="100" step="5"
                  value={filters.progressMin}
                  onChange={(e) => onChange({ ...filters, progressMin: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 accent-blue-500"
                />
                <input
                  type="range"
                  min="0" max="100" step="5"
                  value={filters.progressMax}
                  onChange={(e) => onChange({ ...filters, progressMax: parseInt(e.target.value) })}
                  className="flex-1 h-1.5 accent-blue-500"
                />
              </div>
            </div>

            {/* Owner */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Owner</label>
              <input
                type="text"
                placeholder="Filter by owner..."
                value={filters.owner}
                onChange={(e) => onChange({ ...filters, owner: e.target.value })}
                className="w-full px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-200 focus:border-blue-400 outline-none"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
