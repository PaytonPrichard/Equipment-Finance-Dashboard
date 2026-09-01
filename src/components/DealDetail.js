// ============================================================
// DealDetail — the deal, opened.
//
// Until this existed the kanban card was the entire detail surface, which
// is why notes were a truncated single line at 10px with the full text only
// in a title attribute, and why the attachment list rendered inside a column
// narrow enough to fit five of them across a screen. Clicking a deal did not
// open it; it hydrated the screening form and left the pipeline.
//
// This is a drawer rather than a route because the app has no router. Adding
// one is a real refactor and not what this is for.
//
// Metrics here are recomputed live from inputs, exactly as the screening view
// does. Nothing about a deal's results is stored, so this is the only way to
// show them. That also means they move when SOFR or the firm's criteria move;
// see the note in AUDIT.md about pinning rate and criteria at score time.
// ============================================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { getModule } from '../modules';
import { evaluateScreening, DEFAULT_CRITERIA } from '../lib/screeningCriteria';
import DealAttachments from './DealAttachments';
import { fetchAuditLog } from '../lib/audit';

const STAGES = ['Screening', 'Under Review', 'Approved', 'Funded', 'Declined'];

const ASSET_CLASS_LABELS = {
  equipment_finance: 'Equipment finance',
  accounts_receivable: 'Accounts receivable',
  inventory_finance: 'Inventory finance',
};

// Semantic category to classes, mapped here in the presentation layer rather
// than returned from scoring (CLAUDE.md, and AUDIT P1-3).
const VERDICT_STYLES = {
  pass: { chip: 'bg-emerald-50 text-emerald-800 border-emerald-200', dot: 'bg-emerald-600' },
  flag: { chip: 'bg-amber-50 text-amber-800 border-amber-200', dot: 'bg-amber-600' },
  fail: { chip: 'bg-rose-50 text-rose-800 border-rose-200', dot: 'bg-rose-600' },
  none: { chip: 'bg-gray-50 text-gray-600 border-gray-200', dot: 'bg-gray-400' },
};

function verdictFor(score) {
  if (score == null) return 'none';
  if (score >= 75) return 'pass';
  if (score >= 35) return 'flag';
  return 'fail';
}

function fmtDate(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function fmtDateTime(iso) {
  if (!iso) return null;
  return new Date(iso).toLocaleString('en-US', {
    month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit',
  });
}

function fmtUsd(v) {
  const n = Number(v);
  if (!v || isNaN(n)) return null;
  if (n >= 1e6) return `$${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// The handful of metrics worth showing without opening the full results
// view. Module-aware: an AR deal has no LTV, an equipment deal has no
// borrowing base.
function keyMetricsFor(moduleKey, metrics) {
  if (!metrics) return [];
  const rows = [
    { label: 'DSCR', value: metrics.dscr != null ? `${metrics.dscr.toFixed(2)}x` : null },
    { label: 'Leverage', value: metrics.leverage != null ? `${metrics.leverage.toFixed(1)}x` : null },
  ];
  if (moduleKey === 'equipment_finance') {
    rows.push({ label: 'LTV', value: metrics.ltv != null ? `${(metrics.ltv * 100).toFixed(0)}%` : null });
    rows.push({
      label: 'Term / life',
      value: metrics.termCoverage != null ? `${metrics.termCoverage.toFixed(0)}%` : null,
    });
  } else {
    rows.push({ label: 'Borrowing base', value: fmtUsd(metrics.borrowingBase) });
    rows.push({
      label: 'Advance rate',
      value: metrics.advanceRate != null ? `${(metrics.advanceRate * 100).toFixed(0)}%` : null,
    });
  }
  return rows.filter((r) => r.value !== null && r.value !== undefined);
}

export default function DealDetail({
  deal,
  onClose,
  onRename,
  onSaveNotes,
  onMoveStage,
  onDelete,
  onOpenInScreening,
  canDelete,
  canMoveToStage,
  criteria,
}) {
  const [name, setName] = useState('');
  const [notes, setNotes] = useState('');
  const [activity, setActivity] = useState([]);
  const [activityState, setActivityState] = useState('idle'); // idle | loading | done | error
  const notesDirty = useRef(false);
  const panelRef = useRef(null);

  // Reset local edit state whenever a different deal is opened, so a note
  // typed on one deal cannot be saved onto another.
  useEffect(() => {
    if (!deal) return;
    setName(deal.name || '');
    setNotes(deal.notes || '');
    notesDirty.current = false;
  }, [deal?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!deal?.id) return;
    let cancelled = false;
    setActivityState('loading');
    fetchAuditLog({ entityType: 'pipeline_deal', entityId: String(deal.id), limit: 20 })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) { setActivityState('error'); return; }
        setActivity(data || []);
        setActivityState('done');
      })
      .catch(() => { if (!cancelled) setActivityState('error'); });
    return () => { cancelled = true; };
  }, [deal?.id]);

  const close = useCallback(() => {
    // Don't drop an unsaved note on the way out.
    if (notesDirty.current) onSaveNotes(deal.id, notes);
    onClose();
  }, [deal, notes, onSaveNotes, onClose]);

  useEffect(() => {
    if (!deal) return;
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [deal, close]);

  if (!deal) return null;

  const moduleKey = deal.asset_class || 'equipment_finance';
  const mod = getModule(moduleKey);

  // Recomputed live, like the screening view. Guarded because a deal saved
  // with partial inputs still has to open.
  let metrics = null;
  let riskScore = null;
  let screening = null;
  try {
    metrics = mod.calculateMetrics(deal.inputs || {});
    riskScore = mod.calculateRiskScore(deal.inputs || {}, metrics);
    screening = evaluateScreening(
      criteria || DEFAULT_CRITERIA,
      metrics,
      riskScore,
      deal.inputs || {},
      moduleKey,
    );
  } catch {
    // Leave them null; the panel renders without the metric block.
  }

  const score = deal.score != null ? Math.round(deal.score) : null;
  const verdict = verdictFor(score);
  const style = VERDICT_STYLES[verdict];
  const stageIdx = STAGES.indexOf(deal.stage);
  const metricRows = keyMetricsFor(moduleKey, metrics);
  const reasons = screening?.reasons || [];

  const commitName = () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === deal.name) { setName(deal.name || ''); return; }
    onRename(deal.id, trimmed);
  };

  const commitNotes = () => {
    if (!notesDirty.current) return;
    notesDirty.current = false;
    onSaveNotes(deal.id, notes);
  };

  return (
    <>
      <div
        className="fixed inset-0 bg-black/20 z-40"
        onClick={close}
        aria-hidden="true"
      />
      <aside
        ref={panelRef}
        role="dialog"
        aria-label={`Deal detail: ${deal.name}`}
        className="fixed right-0 top-0 bottom-0 w-full max-w-[520px] bg-white border-l border-gray-200 z-50 overflow-y-auto shadow-xl"
      >
        {/* ---- Header ---- */}
        <div className="sticky top-0 bg-white border-b border-gray-200 px-5 py-4 z-10">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={commitName}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') { e.currentTarget.blur(); }
                  if (e.key === 'Escape') { setName(deal.name || ''); e.currentTarget.blur(); }
                }}
                className="w-full text-[17px] font-semibold text-gray-900 bg-transparent outline-none rounded px-1 -ml-1 hover:bg-gray-50 focus:bg-gray-50 focus:ring-1 focus:ring-gray-200"
                aria-label="Deal name"
              />
              <div className="flex items-center gap-2 mt-1 px-1 -ml-1">
                <span className="text-[11px] text-gray-500">{ASSET_CLASS_LABELS[moduleKey]}</span>
                <span className="text-gray-300">·</span>
                <span className="text-[11px] text-gray-500">{deal.stage}</span>
                {deal.inputs?.industrySector && (
                  <>
                    <span className="text-gray-300">·</span>
                    <span className="text-[11px] text-gray-500">{deal.inputs.industrySector}</span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={close}
              className="flex-shrink-0 text-gray-400 hover:text-gray-700 transition-colors p-1 -mr-1"
              aria-label="Close"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <div className="flex items-center gap-2 mt-3">
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold ${style.chip}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
              {score != null ? `${verdict.toUpperCase()} · ${score}/100` : 'Not scored'}
            </span>
            {deal.inputs && (
              <span className="text-[11px] text-gray-500">
                {fmtUsd(deal.inputs.equipmentCost || deal.inputs.totalAROutstanding || deal.inputs.totalInventory)}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-5">
          {/* ---- Key metrics ---- */}
          {metricRows.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Key metrics
              </h3>
              <div className="grid grid-cols-4 gap-2">
                {metricRows.map((m) => (
                  <div key={m.label} className="rounded-xl border border-gray-200 px-2.5 py-2">
                    <div className="text-[10px] text-gray-500 truncate">{m.label}</div>
                    <div className="text-[14px] font-semibold text-gray-900 mt-0.5">{m.value}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ---- Why it got that verdict ---- */}
          {reasons.length > 0 && (
            <section>
              <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Screening notes
              </h3>
              <ul className="space-y-1">
                {reasons.map((r, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px] leading-snug">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        r.level === 'fail' ? 'bg-rose-600' : 'bg-amber-600'
                      }`}
                    />
                    <span className="text-gray-700">{r.text}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* ---- Notes, with room to actually read them ---- */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Notes
            </h3>
            <textarea
              value={notes}
              onChange={(e) => { setNotes(e.target.value); notesDirty.current = true; }}
              onBlur={commitNotes}
              rows={4}
              placeholder="Why this deal is here. Referral source, open diligence items, what the committee asked for."
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-[12px] text-gray-800 leading-relaxed outline-none focus:border-gray-300 resize-y placeholder-gray-400"
            />
            <div className="text-[10px] text-gray-400 mt-1">
              Saves when you click away. Each save replaces the previous note.
            </div>
          </section>

          {/* ---- Documents ---- */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Documents
            </h3>
            <DealAttachments dealId={deal.id} dealType="pipeline" />
          </section>

          {/* ---- Stage ---- */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Stage
            </h3>
            <div className="flex flex-wrap gap-1.5">
              {STAGES.map((s, i) => {
                const isCurrent = s === deal.stage;
                const allowed = isCurrent || canMoveToStage(s);
                return (
                  <button
                    key={s}
                    disabled={!allowed || isCurrent}
                    onClick={() => onMoveStage(deal.id, i - stageIdx)}
                    title={allowed ? undefined : `You do not have permission to move deals to ${s}`}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-all ${
                      isCurrent
                        ? 'bg-gray-900 text-white border-gray-900'
                        : allowed
                          ? 'bg-white text-gray-600 border-gray-200 hover:border-gray-400 hover:text-gray-900'
                          : 'bg-gray-50 text-gray-300 border-gray-100 cursor-not-allowed'
                    }`}
                  >
                    {s}
                  </button>
                );
              })}
            </div>
          </section>

          {/* ---- Activity ---- */}
          <section>
            <h3 className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
              Activity
            </h3>
            <div className="text-[11px] text-gray-500 space-y-1">
              <div>Created {fmtDate(deal.created_at)}</div>
              {deal.stage_entered_at && (
                <div>In {deal.stage} since {fmtDate(deal.stage_entered_at)}</div>
              )}
              {activityState === 'loading' && <div className="text-gray-400">Loading history...</div>}
              {activityState === 'error' && (
                <div className="text-gray-400">History unavailable.</div>
              )}
              {activityState === 'done' && activity.length === 0 && (
                <div className="text-gray-400">No recorded changes yet.</div>
              )}
              {activity.map((entry) => (
                <div key={entry.id} className="flex gap-2">
                  <span className="text-gray-400 flex-shrink-0">{fmtDateTime(entry.created_at)}</span>
                  <span className="text-gray-600">{describeAudit(entry)}</span>
                </div>
              ))}
            </div>
          </section>
        </div>

        {/* ---- Actions ---- */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-5 py-3 flex items-center gap-2">
          <button
            onClick={() => { close(); onOpenInScreening(deal); }}
            className="px-3 py-2 rounded-xl text-[12px] font-semibold text-gray-900 hover:opacity-90 transition-all"
            style={{ backgroundColor: '#D4A843' }}
          >
            Open in screening
          </button>
          <div className="flex-1" />
          {canDelete && (
            <button
              onClick={() => { onDelete(deal.id); onClose(); }}
              className="px-3 py-2 rounded-xl text-[12px] font-medium text-gray-500 hover:text-rose-700 transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </aside>
    </>
  );
}

// Audit rows are structured, so the sentence is built here rather than
// stored. Keeps the log readable without a schema change.
function describeAudit(entry) {
  const oldV = entry.old_values || {};
  const newV = entry.new_values || {};
  switch (entry.action) {
    case 'create':
      return 'Deal created';
    case 'update_stage':
      return `Moved ${oldV.stage || '?'} to ${newV.stage || '?'}`;
    case 'update':
      if ('name' in newV) return `Renamed from "${oldV.name || 'untitled'}"`;
      if ('notes' in newV) return newV.notes ? 'Notes updated' : 'Notes cleared';
      if ('score' in newV) return `Rescored ${oldV.score ?? '?'} to ${newV.score ?? '?'}`;
      return 'Updated';
    case 'delete':
      return 'Deleted';
    default:
      return entry.action;
  }
}
