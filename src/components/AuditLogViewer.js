import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { supabase } from '../lib/supabase';

const PAGE_SIZE = 50;

const ACTION_TYPES = [
  { value: '', label: 'All Actions' },
  { value: 'deal.save', label: 'deal.save' },
  { value: 'deal.delete', label: 'deal.delete' },
  { value: 'pipeline.create', label: 'pipeline.create' },
  { value: 'pipeline.stage_change', label: 'pipeline.stage_change' },
  { value: 'pipeline.delete', label: 'pipeline.delete' },
];

const ENTITY_TYPES = [
  { value: '', label: 'All Entities' },
  { value: 'saved_deal', label: 'saved_deal' },
  { value: 'pipeline_deal', label: 'pipeline_deal' },
];

const DATE_RANGES = [
  { value: '', label: 'All Time' },
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
];

function getDateThreshold(rangeValue) {
  if (!rangeValue) return null;
  const now = new Date();
  switch (rangeValue) {
    case '24h':
      return new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    case '7d':
      return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case '30d':
      return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
    default:
      return null;
  }
}

function formatTimestamp(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }) + ' ' + date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function actionCategory(action) {
  if (!action) return 'unknown';
  if (action.includes('create') || action.includes('save')) return 'create';
  if (action.includes('stage_change') || action.includes('update')) return 'update';
  if (action.includes('delete')) return 'delete';
  return 'other';
}

const ACTION_BADGE_STYLES = {
  create: {
    bg: 'bg-emerald-500/[0.08]',
    border: 'border-emerald-500/15',
    text: 'text-emerald-400',
  },
  update: {
    bg: 'bg-blue-500/[0.08]',
    border: 'border-blue-500/15',
    text: 'text-blue-400',
  },
  delete: {
    bg: 'bg-rose-500/[0.08]',
    border: 'border-rose-500/15',
    text: 'text-rose-400',
  },
  other: {
    bg: 'bg-slate-500/[0.08]',
    border: 'border-slate-500/15',
    text: 'text-slate-400',
  },
};

function formatDetails(details) {
  if (!details || typeof details !== 'object') return null;
  const entries = Object.entries(details);
  if (entries.length === 0) return null;

  // If it has old_values / new_values structure, show a diff-like format
  if (details.old_values || details.new_values) {
    const oldVals = details.old_values || {};
    const newVals = details.new_values || {};
    const allKeys = [...new Set([...Object.keys(oldVals), ...Object.keys(newVals)])];
    return (
      <div className="space-y-1">
        {allKeys.map((key) => (
          <div key={key} className="text-[11px] font-mono">
            <span className="text-slate-500">{key}: </span>
            {oldVals[key] !== undefined && (
              <span className="text-rose-400/70 line-through mr-2">
                {JSON.stringify(oldVals[key])}
              </span>
            )}
            {newVals[key] !== undefined && (
              <span className="text-emerald-400/70">
                {JSON.stringify(newVals[key])}
              </span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Generic key-value display
  return (
    <div className="space-y-1">
      {entries.map(([key, val]) => (
        <div key={key} className="text-[11px] font-mono">
          <span className="text-slate-500">{key}: </span>
          <span className="text-slate-300">
            {typeof val === 'object' ? JSON.stringify(val) : String(val)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default function AuditLogViewer() {
  const { profile } = useAuth();
  const { can } = useRole();

  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const [hasMore, setHasMore] = useState(true);
  const [expandedId, setExpandedId] = useState(null);

  // Filters
  const [actionFilter, setActionFilter] = useState('');
  const [entityFilter, setEntityFilter] = useState('');
  const [dateRange, setDateRange] = useState('');

  const fetchLogs = useCallback(async (offset = 0, append = false) => {
    if (!supabase) {
      setError('Supabase is not configured. Running in offline mode.');
      setLoading(false);
      return;
    }

    if (!append) setLoading(true);
    else setLoadingMore(true);

    setError(null);

    try {
      let query = supabase
        .from('audit_log')
        .select('*, profiles(full_name, email)')
        .order('created_at', { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);

      if (actionFilter) {
        query = query.eq('action', actionFilter);
      }
      if (entityFilter) {
        query = query.eq('entity_type', entityFilter);
      }

      const dateThreshold = getDateThreshold(dateRange);
      if (dateThreshold) {
        query = query.gte('created_at', dateThreshold);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        setError(fetchError.message);
        return;
      }

      const records = data || [];
      setHasMore(records.length === PAGE_SIZE);

      if (append) {
        setLogs((prev) => [...prev, ...records]);
      } else {
        setLogs(records);
      }
    } catch (err) {
      setError(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [actionFilter, entityFilter, dateRange]);

  // Fetch on mount and when filters change
  useEffect(() => {
    fetchLogs(0, false);
  }, [fetchLogs]);

  const handleLoadMore = () => {
    fetchLogs(logs.length, true);
  };

  // Select / dropdown component styled consistently
  const FilterSelect = ({ value, onChange, options, label }) => (
    <div className="flex flex-col gap-1">
      <label className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
        {label}
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white/[0.03] border border-white/[0.06] rounded-lg px-3 py-2 text-[12px] text-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500/30 focus:border-blue-500/20 appearance-none cursor-pointer"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23475569' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E")`,
          backgroundRepeat: 'no-repeat',
          backgroundPosition: 'right 10px center',
          paddingRight: '32px',
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );

  // Guard: only accessible to users with audit.view permission
  if (!can('audit.view')) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-slate-500 text-sm">You don't have permission to view the audit log.</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-100">Audit Log</h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Track all changes across deals and pipelines
            {profile?.full_name && (
              <span className="text-slate-600"> — Viewing as {profile.full_name}</span>
            )}
          </p>
        </div>
        <div className="text-[11px] text-slate-600 font-mono">
          {logs.length} record{logs.length !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Filters */}
      <div className="glass-card rounded-2xl p-4">
        <div className="flex items-end gap-4 flex-wrap">
          <FilterSelect
            label="Action"
            value={actionFilter}
            onChange={setActionFilter}
            options={ACTION_TYPES}
          />
          <FilterSelect
            label="Entity"
            value={entityFilter}
            onChange={setEntityFilter}
            options={ENTITY_TYPES}
          />
          <FilterSelect
            label="Date Range"
            value={dateRange}
            onChange={setDateRange}
            options={DATE_RANGES}
          />
          {(actionFilter || entityFilter || dateRange) && (
            <button
              onClick={() => {
                setActionFilter('');
                setEntityFilter('');
                setDateRange('');
              }}
              className="text-[11px] text-slate-500 hover:text-slate-300 transition-colors pb-2"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Error state */}
      {error && (
        <div className="glass-card rounded-2xl p-5 border border-rose-500/15 bg-rose-500/[0.04]">
          <p className="text-[12px] text-rose-400">{error}</p>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="glass-card rounded-2xl p-12 flex items-center justify-center">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
            <span className="text-[12px] text-slate-500">Loading audit logs...</span>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!loading && !error && logs.length === 0 && (
        <div className="glass-card rounded-2xl p-12 text-center">
          <svg
            width="40"
            height="40"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            className="text-slate-700 mx-auto mb-3"
            strokeWidth="1.5"
          >
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
            <polyline points="10 9 9 9 8 9" />
          </svg>
          <p className="text-sm text-slate-500 font-medium">No audit records found</p>
          <p className="text-[11px] text-slate-600 mt-1">
            {actionFilter || entityFilter || dateRange
              ? 'Try adjusting your filters.'
              : 'Activity will appear here once changes are made.'}
          </p>
        </div>
      )}

      {/* Table */}
      {!loading && logs.length > 0 && (
        <div className="glass-card rounded-2xl overflow-hidden">
          {/* Table header */}
          <div className="grid grid-cols-[160px_140px_140px_140px_1fr] gap-2 px-5 py-3 border-b border-white/[0.04] bg-white/[0.01]">
            {['Timestamp', 'User', 'Action', 'Entity', 'Details'].map((h) => (
              <div
                key={h}
                className="text-[10px] font-bold text-slate-600 uppercase tracking-widest"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Table rows */}
          <div className="divide-y divide-white/[0.03]">
            {logs.map((log) => {
              const category = actionCategory(log.action);
              const badge = ACTION_BADGE_STYLES[category] || ACTION_BADGE_STYLES.other;
              const isExpanded = expandedId === log.id;
              const userName =
                log.profiles?.full_name || log.profiles?.email || 'Unknown';
              const hasDetails =
                log.details && typeof log.details === 'object' && Object.keys(log.details).length > 0;

              return (
                <div key={log.id}>
                  <div
                    className={`grid grid-cols-[160px_140px_140px_140px_1fr] gap-2 px-5 py-3 items-center transition-colors ${
                      hasDetails
                        ? 'hover:bg-white/[0.02] cursor-pointer'
                        : ''
                    } ${isExpanded ? 'bg-white/[0.02]' : ''}`}
                    onClick={() => {
                      if (hasDetails) setExpandedId(isExpanded ? null : log.id);
                    }}
                  >
                    {/* Timestamp */}
                    <div className="text-[11px] text-slate-400 font-mono">
                      {formatTimestamp(log.created_at)}
                    </div>

                    {/* User */}
                    <div className="text-[12px] text-slate-300 truncate" title={userName}>
                      {userName}
                    </div>

                    {/* Action badge */}
                    <div>
                      <span
                        className={`inline-block px-2.5 py-1 rounded-md text-[10px] font-bold border ${badge.bg} ${badge.border} ${badge.text}`}
                      >
                        {log.action}
                      </span>
                    </div>

                    {/* Entity */}
                    <div className="text-[11px] font-mono">
                      <span className="text-slate-500">{log.entity_type}</span>
                      {log.entity_id && (
                        <span className="text-slate-600 ml-1" title={log.entity_id}>
                          #{String(log.entity_id).slice(0, 8)}
                        </span>
                      )}
                    </div>

                    {/* Details indicator */}
                    <div className="flex items-center justify-between">
                      {hasDetails ? (
                        <span className="text-[11px] text-slate-600">
                          {Object.keys(log.details).length} field{Object.keys(log.details).length !== 1 ? 's' : ''}
                        </span>
                      ) : (
                        <span className="text-[11px] text-slate-700">--</span>
                      )}
                      {hasDetails && (
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          className={`text-slate-600 transition-transform flex-shrink-0 ${
                            isExpanded ? 'rotate-180' : ''
                          }`}
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      )}
                    </div>
                  </div>

                  {/* Expanded details */}
                  {isExpanded && hasDetails && (
                    <div className="px-5 pb-4 border-t border-white/[0.03] animate-slide-down">
                      <div className="mt-3 bg-white/[0.02] rounded-xl p-4">
                        <h4 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">
                          Change Details
                        </h4>
                        {formatDetails(log.details)}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Load More */}
          {hasMore && (
            <div className="px-5 py-4 border-t border-white/[0.04] text-center">
              <button
                onClick={handleLoadMore}
                disabled={loadingMore}
                className="px-5 py-2 rounded-lg text-[12px] font-medium text-slate-400 bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.06] hover:text-slate-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loadingMore ? (
                  <span className="flex items-center gap-2">
                    <span className="w-3 h-3 border-2 border-blue-500/30 border-t-blue-400 rounded-full animate-spin" />
                    Loading...
                  </span>
                ) : (
                  'Load More'
                )}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center gap-6 text-[10px] text-slate-600 pt-2">
        {[
          { label: 'Create / Save', style: ACTION_BADGE_STYLES.create },
          { label: 'Update / Change', style: ACTION_BADGE_STYLES.update },
          { label: 'Delete', style: ACTION_BADGE_STYLES.delete },
        ].map((item) => (
          <span key={item.label} className="flex items-center gap-1.5">
            <span
              className={`inline-block w-2.5 h-2.5 rounded-sm border ${item.style.bg} ${item.style.border}`}
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
