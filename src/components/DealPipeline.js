import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'efd_pipeline_deals';

const STAGES = [
  { key: 'Screening', color: 'blue' },
  { key: 'Under Review', color: 'amber' },
  { key: 'Approved', color: 'emerald' },
  { key: 'Funded', color: 'teal' },
  { key: 'Declined', color: 'rose' },
];

const STAGE_STYLES = {
  Screening:      { bg: 'bg-blue-500/[0.08]',    border: 'border-blue-500/20',    text: 'text-blue-400',    dot: 'bg-blue-400' },
  'Under Review': { bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/20',   text: 'text-amber-400',   dot: 'bg-amber-400' },
  Approved:       { bg: 'bg-emerald-500/[0.08]',  border: 'border-emerald-500/20', text: 'text-emerald-400', dot: 'bg-emerald-400' },
  Funded:         { bg: 'bg-teal-500/[0.08]',     border: 'border-teal-500/20',    text: 'text-teal-400',    dot: 'bg-teal-400' },
  Declined:       { bg: 'bg-rose-500/[0.08]',     border: 'border-rose-500/20',    text: 'text-rose-400',    dot: 'bg-rose-400' },
};

function getDeals() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function persistDeals(deals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

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

function fmtDate(iso) {
  try { return new Date(iso).toLocaleDateString(); }
  catch { return ''; }
}

export default function DealPipeline({ onLoadDeal, currentInputs, currentScore }) {
  const [deals, setDealsState] = useState(getDeals);
  const [addingName, setAddingName] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [noteText, setNoteText] = useState('');
  const addInputRef = useRef();
  const noteInputRef = useRef();

  const sync = (next) => { setDealsState(next); persistDeals(next); };

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
    setAddingName(currentInputs?.companyName || '');
    setIsAdding(true);
  };

  const handleConfirmAdd = () => {
    const name = addingName.trim();
    if (!name) return;
    const now = new Date().toISOString();
    const entry = {
      id: Date.now(),
      name,
      stage: 'Screening',
      inputs: currentInputs ? { ...currentInputs } : {},
      score: currentScore ?? null,
      dateAdded: now,
      dateUpdated: now,
      notes: '',
    };
    sync([entry, ...deals]);
    setIsAdding(false);
    setAddingName('');
  };

  const handleDelete = (id) => {
    sync(deals.filter((d) => d.id !== id));
  };

  const handleMove = (id, direction) => {
    const stageKeys = STAGES.map((s) => s.key);
    sync(deals.map((d) => {
      if (d.id !== id) return d;
      const idx = stageKeys.indexOf(d.stage);
      const nextIdx = idx + direction;
      if (nextIdx < 0 || nextIdx >= stageKeys.length) return d;
      return { ...d, stage: stageKeys[nextIdx], dateUpdated: new Date().toISOString() };
    }));
  };

  const handleLoadDeal = (deal) => {
    if (onLoadDeal) onLoadDeal(deal.inputs);
  };

  const handleStartNote = (deal) => {
    setEditingNoteId(deal.id);
    setNoteText(deal.notes || '');
  };

  const handleSaveNote = () => {
    sync(deals.map((d) =>
      d.id === editingNoteId
        ? { ...d, notes: noteText.trim(), dateUpdated: new Date().toISOString() }
        : d
    ));
    setEditingNoteId(null);
    setNoteText('');
  };

  /* --- Grouping --- */

  const grouped = {};
  STAGES.forEach((s) => { grouped[s.key] = []; });
  deals.forEach((d) => {
    if (grouped[d.stage]) grouped[d.stage].push(d);
  });

  const stageKeys = STAGES.map((s) => s.key);

  return (
    <div className="space-y-5 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Deal Pipeline</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {deals.length} deal{deals.length !== 1 ? 's' : ''} across {STAGES.length} stages
          </p>
        </div>

        <div>
          {isAdding ? (
            <div className="flex gap-1.5 items-center">
              <input
                ref={addInputRef}
                className="bg-white/5 rounded-lg px-3 py-1.5 text-sm text-slate-200 outline-none placeholder-slate-600 border border-white/[0.06] focus:border-blue-500/30 transition-colors w-48"
                placeholder="Deal name..."
                value={addingName}
                onChange={(e) => setAddingName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmAdd();
                  if (e.key === 'Escape') setIsAdding(false);
                }}
              />
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-blue-400"
                onClick={handleConfirmAdd}
              >
                Add
              </button>
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500"
                onClick={() => setIsAdding(false)}
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-blue-400"
              onClick={handleStartAdd}
            >
              + Add Current Deal
            </button>
          )}
        </div>
      </div>

      {/* Pipeline columns */}
      <div className="flex gap-3 overflow-x-auto pb-2" style={{ minHeight: 320 }}>
        {STAGES.map((stage) => {
          const ss = STAGE_STYLES[stage.key];
          const columnDeals = grouped[stage.key];

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
                  <div className="text-center text-slate-700 text-[10px] py-6">No deals</div>
                )}

                {columnDeals.map((deal) => {
                  const stageIdx = stageKeys.indexOf(deal.stage);
                  const canMoveBack = stageIdx > 0;
                  const canMoveForward = stageIdx < stageKeys.length - 1;

                  return (
                    <div
                      key={deal.id}
                      className="glass-card rounded-xl p-3 group transition-all hover:ring-1 hover:ring-white/[0.06]"
                    >
                      {/* Company name + delete */}
                      <div className="flex items-start justify-between gap-1 mb-1.5">
                        <button
                          className="text-sm font-semibold text-slate-200 truncate text-left hover:text-blue-400 transition-colors leading-tight"
                          title="Load deal into screening form"
                          onClick={() => handleLoadDeal(deal)}
                        >
                          {deal.name}
                        </button>
                        <button
                          className="text-slate-700 hover:text-rose-400 text-sm leading-none opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5"
                          title="Remove from pipeline"
                          onClick={() => handleDelete(deal.id)}
                        >
                          &times;
                        </button>
                      </div>

                      {/* Score + industry + cost */}
                      <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                        {deal.score != null && (
                          <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md border text-[11px] font-bold font-mono ${scoreBg(deal.score)} ${scoreColor(deal.score)}`}>
                            {Math.round(deal.score)}
                          </span>
                        )}
                        {deal.inputs?.industry && (
                          <span className="text-[10px] text-slate-500 truncate">{deal.inputs.industry}</span>
                        )}
                        {deal.inputs?.industrySector && !deal.inputs?.industry && (
                          <span className="text-[10px] text-slate-500 truncate">{deal.inputs.industrySector}</span>
                        )}
                      </div>

                      {fmtCost(deal.inputs?.equipmentCost) && (
                        <div className="text-[10px] text-slate-500 mb-1.5">
                          {fmtCost(deal.inputs.equipmentCost)}
                        </div>
                      )}

                      {/* Date added */}
                      <div className="text-[10px] text-slate-600 mb-2">
                        Added {fmtDate(deal.dateAdded)}
                      </div>

                      {/* Notes */}
                      {editingNoteId === deal.id ? (
                        <div className="mb-2">
                          <textarea
                            ref={noteInputRef}
                            className="w-full bg-white/5 rounded-lg px-2 py-1.5 text-[11px] text-slate-300 outline-none placeholder-slate-600 border border-white/[0.06] focus:border-blue-500/30 transition-colors resize-none"
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
                              className="text-[10px] text-blue-400 hover:text-blue-300"
                              onClick={handleSaveNote}
                            >
                              Save
                            </button>
                            <button
                              className="text-[10px] text-slate-600 hover:text-slate-400"
                              onClick={() => { setEditingNoteId(null); setNoteText(''); }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : deal.notes ? (
                        <button
                          className="text-[10px] text-slate-500 italic mb-2 text-left truncate w-full hover:text-slate-400 transition-colors"
                          title={deal.notes}
                          onClick={() => handleStartNote(deal)}
                        >
                          {deal.notes}
                        </button>
                      ) : (
                        <button
                          className="text-[10px] text-slate-700 mb-2 hover:text-slate-500 transition-colors opacity-0 group-hover:opacity-100"
                          onClick={() => handleStartNote(deal)}
                        >
                          + note
                        </button>
                      )}

                      {/* Move buttons */}
                      <div className="flex items-center justify-between border-t border-white/[0.04] pt-2">
                        <button
                          className={`text-[10px] px-2 py-1 rounded-md transition-colors ${
                            canMoveBack
                              ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                              : 'text-slate-800 cursor-default'
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
                              ? 'text-slate-500 hover:text-slate-300 hover:bg-white/[0.04]'
                              : 'text-slate-800 cursor-default'
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
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
