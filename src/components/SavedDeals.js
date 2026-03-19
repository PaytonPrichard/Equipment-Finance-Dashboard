import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'efd_saved_deals';

function getDeals() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || []; }
  catch { return []; }
}

function setDeals(deals) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(deals));
}

export default function SavedDeals({ currentInputs, onLoadDeal }) {
  const [deals, setDealsState] = useState(getDeals);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const ref = useRef();
  const inputRef = useRef();

  const sync = (next) => { setDealsState(next); setDeals(next); };

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSaving(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (saving && inputRef.current) inputRef.current.focus();
  }, [saving]);

  const handleSaveClick = () => {
    if (!saving) {
      setSaveName(currentInputs?.companyName || '');
      setSaving(true);
      setOpen(true);
    }
  };

  const handleConfirmSave = () => {
    const name = saveName.trim();
    if (!name) return;
    const entry = { id: Date.now(), name, date: new Date().toISOString(), inputs: { ...currentInputs } };
    sync([entry, ...deals]);
    setSaving(false);
    setSaveName('');
  };

  const handleDelete = (e, id) => {
    e.stopPropagation();
    sync(deals.filter((d) => d.id !== id));
  };

  const handleLoad = (inputs) => {
    onLoadDeal(inputs);
    setOpen(false);
  };

  const fmt = (iso) => {
    try { return new Date(iso).toLocaleDateString(); }
    catch { return ''; }
  };

  const fmtCost = (v) => {
    const n = Number(v);
    if (!v || isNaN(n)) return null;
    return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${(n / 1e3).toFixed(0)}K`;
  };

  return (
    <div className="relative" ref={ref}>
      <button
        className={`pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400${open ? ' pill-btn-active' : ''}`}
        onClick={() => { setOpen(!open); if (open) setSaving(false); }}
      >
        Saved{deals.length > 0 && ` (${deals.length})`}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 company-dropdown rounded-xl z-50 py-1 w-72 max-h-80 overflow-y-auto animate-fade-in">
          {/* Save row */}
          <div className="px-3 py-2 border-b border-white/5">
            {saving ? (
              <div className="flex gap-1.5">
                <input
                  ref={inputRef}
                  className="flex-1 bg-white/5 rounded px-2 py-1 text-sm text-slate-200 outline-none placeholder-slate-600"
                  placeholder="Deal name..."
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleConfirmSave()}
                />
                <button
                  className="pill-btn px-2 py-1 rounded text-[11px] font-medium text-slate-400"
                  onClick={handleConfirmSave}
                >
                  OK
                </button>
              </div>
            ) : (
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 w-full"
                onClick={handleSaveClick}
              >
                Save Current
              </button>
            )}
          </div>

          {/* Deal list */}
          {deals.length === 0 ? (
            <div className="px-3 py-4 text-center text-slate-600 text-[11px]">No saved deals yet</div>
          ) : (
            deals.map((deal) => (
              <div
                key={deal.id}
                className="px-3 py-2 cursor-pointer hover:bg-white/[0.02] flex items-start justify-between group"
                onClick={() => handleLoad(deal.inputs)}
              >
                <div className="min-w-0">
                  <div className="text-sm text-slate-200 truncate">{deal.name}</div>
                  <div className="text-[11px] text-slate-500">
                    {fmt(deal.date)}
                    {deal.inputs?.industry && <span> &middot; {deal.inputs.industry}</span>}
                    {fmtCost(deal.inputs?.equipmentCost) && <span> &middot; {fmtCost(deal.inputs.equipmentCost)}</span>}
                  </div>
                </div>
                <button
                  className="text-slate-600 hover:text-rose-400 ml-2 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity text-sm leading-none"
                  onClick={(e) => handleDelete(e, deal.id)}
                >
                  &times;
                </button>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
