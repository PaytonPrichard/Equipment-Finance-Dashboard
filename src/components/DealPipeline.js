import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { useToast } from '../contexts/ToastContext';
import {
  fetchPipelineDeals,
  createPipelineDeal,
  updatePipelineStage,
  updatePipelineNotes,
  deletePipelineDeal,
} from '../lib/pipeline';
import { SkeletonPipeline } from './SkeletonCard';
import { exportPipelineCsv } from '../utils/csvExport';
import DealAttachments from './DealAttachments';

const STAGES = [
  { key: 'Screening', color: 'gold' },
  { key: 'Under Review', color: 'amber' },
  { key: 'Approved', color: 'emerald' },
  { key: 'Funded', color: 'teal' },
  { key: 'Declined', color: 'rose' },
];

const STAGE_STYLES = {
  Screening:      { bg: 'bg-gold-500/[0.08]',    border: 'border-gray-200',    text: 'text-gray-600',    dot: 'bg-gold-400' },
  'Under Review': { bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  Approved:       { bg: 'bg-emerald-500/[0.08]',  border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  Funded:         { bg: 'bg-teal-500/[0.08]',     border: 'border-teal-500/20',    text: 'text-teal-400',    dot: 'bg-teal-400' },
  Declined:       { bg: 'bg-rose-500/[0.08]',     border: 'border-rose-500/20',    text: 'text-rose-400',    dot: 'bg-rose-400' },
};

function scoreBg(s) {
  if (s >= 75) return 'bg-emerald-500/[0.08] border-emerald-500/15';
  if (s >= 55) return 'bg-lime-500/[0.08] border-lime-500/15';
  if (s >= 35) return 'bg-amber-500/[0.08] border-amber-500/15';
  return 'bg-rose-500/[0.08] border-rose-500/15';
}

function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400';
  if (s >= 55) return 'text-lime-400';
  if (s >= 35) return 'text-amber-400';
  return 'text-rose-400';
}

function fmtCost(v) {
  const n = Number(v);
  if (!v || isNaN(n)) return null;
  return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;
}

function getDealValue(inputs) {
  if (!inputs) return null;
  return fmtCost(inputs.equipmentCost || inputs.totalAROutstanding || inputs.totalInventory);
}


function daysInStage(updatedAt) {
  if (!updatedAt) return 0;
  const diff = Date.now() - new Date(updatedAt).getTime();
  return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
}

function getVerdict(score) {
  if (score == null) return null;
  if (score >= 75) return { label: 'PASS', cls: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' };
  if (score >= 35) return { label: 'FLAG', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' };
  return { label: 'FAIL', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' };
}

export default function DealPipeline({ onLoadDeal, currentInputs, currentScore, readOnly }) {
  const { user, profile } = useAuth();
  const { can } = useRole();
  const { addToast } = useToast();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [addingName, setAddingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const addInputRef = useRef();
  const noteInputRef = useRef();

  const orgId = profile?.org_id;
  const userId = user?.id;

  // Fetch pipeline deals from Supabase
  const loadDeals = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await fetchPipelineDeals(orgId);
    if (error) addToast('Failed to load pipeline', 'error');
    setDeals(data || []);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // Focus the add-deal input when it appears
  useEffect(() => {
    if (isAdding && addInputRef.current) addInputRef.current.focus();
  }, [isAdding]);

  // Focus note input when editing
  useEffect(() => {
    if (editingNoteId && noteInputRef.current) noteInputRef.current.focus();
  }, [editingNoteId]);

  /* --- Actions --- */

  const handleStartAdd = () => {
    if (readOnly) { addToast('Plan expired. Upgrade to add deals.', 'warning'); return; }
    setAddingName(currentInputs?.companyName || '');
    setIsAdding(true);
  };

  const handleConfirmAdd = async () => {
    const name = addingName.trim();
    if (!name) return;
    if (!userId || !orgId) {
      addToast('Your profile is still loading. Please try again shortly.', 'warning');
      return;
    }

    const now = new Date().toISOString();
    const tempId = `temp_${Date.now()}`;
    const optimistic = {
      id: tempId,
      name,
      stage: 'Screening',
      inputs: currentInputs ? { ...currentInputs } : {},
      score: currentScore ?? null,
      created_at: now,
      updated_at: now,
      notes: '',
    };
    setDeals((prev) => [optimistic, ...prev]);
    setIsAdding(false);
    setAddingName('');

    const { data, error } = await createPipelineDeal(userId, orgId, name, currentInputs || {}, currentScore ?? null);
    if (error) {
      addToast('Failed to add deal to pipeline', 'error');
      setDeals((prev) => prev.filter((d) => d.id !== tempId));
    } else if (data) {
      addToast('Deal added to pipeline', 'success');
      setDeals((prev) => prev.map((d) => (d.id === tempId ? data : d)));
    }
  };

  const handleDelete = async (id) => {
    if (!userId || !orgId) return;
    const removed = deals.find((d) => d.id === id);
    if (removed && !canDeleteDeal(removed)) return;
    setDeals((prev) => prev.filter((d) => d.id !== id));

    const { error } = await deletePipelineDeal(id, userId, orgId);
    if (error) {
      addToast('Failed to delete deal', 'error');
      if (removed) setDeals((prev) => [...prev, removed]);
    }
  };

  // Permission key for each target stage
  const STAGE_PERMISSION = {
    'Under Review': 'pipeline.move_review',
    Approved: 'pipeline.move_approved',
    Funded: 'pipeline.move_funded',
    Declined: 'pipeline.move_declined',
  };

  const canMoveToStage = (stageName) => {
    const perm = STAGE_PERMISSION[stageName];
    return !perm || can(perm); // Screening has no gate
  };

  const canDeleteDeal = (deal) => {
    if (can('pipeline.delete_any')) return true;
    if (can('pipeline.delete_own') && deal.user_id === userId) return true;
    return false;
  };

  const handleMove = async (id, direction) => {
    if (!userId || !orgId) return;
    const stageKeys = STAGES.map((s) => s.key);
    const deal = deals.find((d) => d.id === id);
    if (!deal) return;

    const idx = stageKeys.indexOf(deal.stage);
    const nextIdx = idx + direction;
    if (nextIdx < 0 || nextIdx >= stageKeys.length) return;

    const newStage = stageKeys[nextIdx];

    // Check permission for target stage
    if (!canMoveToStage(newStage)) return;

    // Optimistic update
    setDeals((prev) =>
      prev.map((d) =>
        d.id === id ? { ...d, stage: newStage, updated_at: new Date().toISOString() } : d
      )
    );

    const { error } = await updatePipelineStage(id, newStage, userId, orgId);
    if (error) {
      addToast('Failed to move deal', 'error');
      setDeals((prev) =>
        prev.map((d) =>
          d.id === id ? { ...d, stage: deal.stage, updated_at: deal.updated_at } : d
        )
      );
    }
  };

  const handleLoadDeal = (deal) => {
    if (onLoadDeal) onLoadDeal(deal.inputs, deal.id);
  };

  const handleStartNote = (deal) => {
    setEditingNoteId(deal.id);
    setNoteText(deal.notes || '');
  };

  const handleSaveNote = async () => {
    const trimmed = noteText.trim();
    const dealId = editingNoteId;
    const prevDeal = deals.find((d) => d.id === dealId);

    // Optimistic
    setDeals((prev) =>
      prev.map((d) =>
        d.id === dealId ? { ...d, notes: trimmed, updated_at: new Date().toISOString() } : d
      )
    );
    setEditingNoteId(null);
    setNoteText('');

    const { error } = await updatePipelineNotes(dealId, trimmed);
    if (error) {
      addToast('Failed to save note', 'error');
      if (prevDeal) {
        setDeals((prev) =>
          prev.map((d) =>
            d.id === dealId ? { ...d, notes: prevDeal.notes, updated_at: prevDeal.updated_at } : d
          )
        );
      }
    }
  };

  /* --- Search & Grouping --- */

  const [searchQuery, setSearchQuery] = useState('');
  const [expandedStages, setExpandedStages] = useState({});
  const DEALS_PER_STAGE = 20;

  const filteredDeals = searchQuery.trim()
    ? deals.filter(d => {
        const q = searchQuery.toLowerCase();
        return (d.name || '').toLowerCase().includes(q)
          || (d.inputs?.industrySector || '').toLowerCase().includes(q)
          || (d.inputs?.companyName || '').toLowerCase().includes(q)
          || (d.stage || '').toLowerCase().includes(q);
      })
    : deals;

  const grouped = {};
  STAGES.forEach((s) => { grouped[s.key] = []; });
  filteredDeals.forEach((d) => {
    if (grouped[d.stage]) grouped[d.stage].push(d);
  });

  const stageKeys = STAGES.map((s) => s.key);

  if (loading) {
    return <SkeletonPipeline />;
  }

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-800">Deal Pipeline</h3>
            <p className="text-[11px] text-gray-400 mt-0.5">
              {searchQuery ? `${filteredDeals.length} of ${deals.length}` : deals.length} deal{deals.length !== 1 ? 's' : ''} across {STAGES.length} stages
            </p>
          </div>
          {deals.length > 0 && (
            <div className="relative">
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search deals..."
                className="bg-gray-50 rounded-lg pl-8 pr-3 py-1.5 text-[11px] text-gray-800 outline-none placeholder-gray-400 border border-gray-200 focus:border-gray-300 transition-colors w-44"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-500"
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
            </div>
          )}
        </div>

        <div>
          {isAdding ? (
            <div className="flex gap-1.5 items-center">
              <input
                ref={addInputRef}
                className="bg-white/5 rounded-lg px-3 py-1.5 text-sm text-gray-800 outline-none placeholder-gray-400 border border-gray-200 focus:border-gray-300 transition-colors w-48"
                placeholder="Name this deal..."
                value={addingName}
                onChange={(e) => setAddingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmAdd();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-600"
                onClick={handleConfirmAdd}
              >
                Add
              </button>
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-400"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-600"
                onClick={handleStartAdd}
              >
                + Add to Pipeline
              </button>
              {deals.length > 0 && (
                <button
                  className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
                  onClick={() => exportPipelineCsv(deals)}
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                    <polyline points="7 10 12 15 17 10"/>
                    <line x1="12" y1="15" x2="12" y2="3"/>
                  </svg>
                  Export CSV
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 320 }}>
        {STAGES.map((stage) => {
          const ss = STAGE_STYLES[stage.key];
          const allColumnDeals = grouped[stage.key];
          const isExpanded = expandedStages[stage.key];
          const columnDeals = isExpanded ? allColumnDeals : allColumnDeals.slice(0, DEALS_PER_STAGE);
          const hasMore = allColumnDeals.length > DEALS_PER_STAGE && !isExpanded;

          return (
            <div
              key={stage.key}
              className="flex-1 min-w-[220px] flex flex-col"
            >
              {/* Column header */}
              <div className={`rounded-xl px-3 py-2.5 mb-2 border ${ss.bg} ${ss.border}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${ss.dot}`} />
                    <span className={`text-xs font-semibold ${ss.text}`}>{stage.key}</span>
                  </div>
                  <span className={`text-[10px] font-bold font-mono px-1.5 py-0.5 rounded-md ${ss.bg} ${ss.text}`}>
                    {columnDeals.length}
                  </span>
                </div>
              </div>

              {/* Cards */}
              <div className="flex-1 space-y-2 overflow-y-auto pr-0.5" style={{ maxHeight: 480 }}>
                {columnDeals.length === 0 && (
                  <div className="text-center text-gray-300 text-[10px] py-6">No deals</div>
                )}

                {columnDeals.map((deal) => {
                  const stageIdx = stageKeys.indexOf(deal.stage);
                  const canMoveBack = stageIdx > 0 && canMoveToStage(stageKeys[stageIdx - 1]);
                  const canMoveForward = stageIdx < stageKeys.length - 1 && canMoveToStage(stageKeys[stageIdx + 1]);
                  const showDelete = canDeleteDeal(deal);

                  return (
                    <div
                      key={deal.id}
                      className="glass-card rounded-xl p-3 group transition-all hover:ring-1 hover:ring-white/[0.06]"
                    >
                      {/* Company name + delete */}
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <button
                          className="text-sm font-semibold text-gray-800 truncate text-left hover:text-gray-600 transition-colors leading-tight"
                          title="Load deal into screening form"
                          onClick={() => handleLoadDeal(deal)}
                        >
                          {deal.name}
                        </button>
                        {showDelete && (
                          <button
                            className="text-gray-300 hover:text-rose-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                            title="Remove from pipeline"
                            onClick={() => handleDelete(deal.id)}
                          >
                            &times;
                          </button>
                        )}
                      </div>

                      {/* Score + verdict + industry */}
                      <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                        {deal.score != null && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-bold font-mono ${scoreBg(deal.score)} ${scoreColor(deal.score)}`}>
                            {Math.round(deal.score)}
                          </span>
                        )}
                        {(() => {
                          const v = getVerdict(deal.score);
                          return v ? (
                            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[9px] font-bold tracking-wider ${v.cls}`}>
                              {v.label}
                            </span>
                          ) : null;
                        })()}
                        <span className="text-[10px] text-gray-400 truncate">
                          {deal.inputs?.industrySector || deal.inputs?.industry || ''}
                        </span>
                      </div>

                      {/* Deal value + days in stage */}
                      <div className="flex items-center justify-between mb-1.5">
                        {getDealValue(deal.inputs) && (
                          <span className="text-[10px] text-gray-400">{getDealValue(deal.inputs)}</span>
                        )}
                        {(() => {
                          const days = daysInStage(deal.updated_at);
                          return (
                            <span className={`text-[9px] font-medium ${days > 14 ? 'text-amber-400' : days > 7 ? 'text-gray-500' : 'text-gray-400'}`}>
                              {days === 0 ? 'Today' : days === 1 ? '1 day' : `${days} days`}
                            </span>
                          );
                        })()}
                      </div>

                      {/* Notes */}
                      {editingNoteId === deal.id ? (
                        <div className="mb-2">
                          <textarea
                            ref={noteInputRef}
                            className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-[11px] text-gray-700 outline-none placeholder-gray-400 border border-gray-200 focus:border-gray-300 transition-colors resize-none"
                            rows={2}
                            placeholder="Add a note..."
                            value={noteText}
                            onChange={(e) => setNoteText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSaveNote(); }
                              if (e.key === 'Escape') { setEditingNoteId(null); setNoteText(''); }
                            }}
                          />
                          <div className="flex gap-1 mt-1">
                            <button
                              className="text-[10px] text-gray-600 hover:text-gray-700"
                              onClick={handleSaveNote}
                            >
                              Save
                            </button>
                            <button
                              className="text-[10px] text-gray-400 hover:text-gray-500"
                              onClick={() => { setEditingNoteId(null); setNoteText(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : deal.notes ? (
                        <button
                          className="text-[10px] text-gray-400 italic mb-2 text-left truncate w-full hover:text-gray-500 transition-colors"
                          title={deal.notes}
                          onClick={() => handleStartNote(deal)}
                        >
                          {deal.notes}
                        </button>
                      ) : (
                        <button
                          className="text-[10px] text-gray-300 mb-2 hover:text-gray-400 transition-colors opacity-0 group-hover:opacity-100"
                          onClick={() => handleStartNote(deal)}
                        >
                          + note
                        </button>
                      )}

                      {/* Document attachments */}
                      <DealAttachments dealId={deal.id} dealType="pipeline" />

                      {/* Move buttons */}
                      <div className="flex items-center justify-between border-t border-gray-200 pt-2 mt-2">
                        <button
                          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                            canMoveBack
                              ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                              : 'text-gray-200 cursor-default'
                          }`}
                          disabled={!canMoveBack}
                          title={canMoveBack ? `Move to ${stageKeys[stageIdx - 1]}` : ''}
                          onClick={() => canMoveBack && handleMove(deal.id, -1)}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline -mt-px">
                            <polyline points="15 18 9 12 15 6" />
                          </svg>
                          {canMoveBack && <span className="ml-0.5">{stageKeys[stageIdx - 1]}</span>}
                        </button>

                        <button
                          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                            canMoveForward
                              ? 'text-gray-400 hover:text-gray-700 hover:bg-gray-50'
                              : 'text-gray-200 cursor-default'
                          }`}
                          disabled={!canMoveForward}
                          title={canMoveForward ? `Move to ${stageKeys[stageIdx + 1]}` : ''}
                          onClick={() => canMoveForward && handleMove(deal.id, 1)}
                        >
                          {canMoveForward && <span className="mr-0.5">{stageKeys[stageIdx + 1]}</span>}
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="inline -mt-px">
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
                {hasMore && (
                  <button
                    onClick={() => setExpandedStages(prev => ({ ...prev, [stage.key]: true }))}
                    className="w-full py-2 text-[10px] text-gray-400 hover:text-gray-700 transition-colors text-center"
                  >
                    Show {allColumnDeals.length - DEALS_PER_STAGE} more...
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
