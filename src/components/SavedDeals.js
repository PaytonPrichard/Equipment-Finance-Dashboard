import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { fetchSavedDeals, createSavedDeal, deleteSavedDeal } from '../lib/deals';

export default function SavedDeals({ currentInputs, currentScore, onLoadDeal, onDealsChange, readOnly }) {
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [deals, setDeals] = useState([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [loading, setLoading] = useState(true);
  const ref = useRef();
  const inputRef = useRef();

  const orgId = profile?.org_id;
  const userId = user?.id;

  // Update parent whenever deals change
  const updateDeals = useCallback((next) => {
    const list = typeof next === 'function' ? next(deals) : next;
    setDeals(next);
    if (onDealsChange) onDealsChange(list);
  }, [onDealsChange, deals]);

  // Fetch deals from Supabase on mount
  const loadDeals = useCallback(async () => {
    if (!orgId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await fetchSavedDeals(orgId);
    if (error) addToast('Failed to load saved deals', 'error');
    const list = data || [];
    setDeals(list);
    if (onDealsChange) onDealsChange(list);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgId, onDealsChange]);

  useEffect(() => { loadDeals(); }, [loadDeals]);

  // Click outside to close
  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setSaving(false); } };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    if (saving && inputRef.current) inputRef.current.focus();
  }, [saving]);

  const handleSaveClick = () => {
    if (readOnly) { addToast('Plan expired — upgrade to save deals', 'warning'); return; }
    if (!saving) {
      setSaveName(currentInputs?.companyName || '');
      setSaving(true);
      setOpen(true);
    }
  };

  const handleConfirmSave = async () => {
    const name = saveName.trim();
    if (!name || !userId || !orgId) return;

    // Optimistic add
    const tempId = `temp_${Date.now()}`;
    const optimistic = { id: tempId, name, created_at: new Date().toISOString(), inputs: { ...currentInputs }, score: currentScore ?? null };
    updateDeals((prev) => [optimistic, ...prev]);
    setSaving(false);
    setSaveName('');

    const { data, error } = await createSavedDeal(userId, orgId, name, currentInputs, currentScore ?? null);
    if (error) {
      addToast('Failed to save deal', 'error');
      updateDeals((prev) => prev.filter((d) => d.id !== tempId));
    } else if (data) {
      updateDeals((prev) => prev.map((d) => (d.id === tempId ? data : d)));
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation();
    if (!userId || !orgId) return;

    const removed = deals.find((d) => d.id === id);
    updateDeals((prev) => prev.filter((d) => d.id !== id));

    const { error } = await deleteSavedDeal(id, userId, orgId);
    if (error) {
      addToast('Failed to delete deal', 'error');
      if (removed) updateDeals((prev) => [removed, ...prev]);
    }
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
          {loading ? (
            <div className="px-3 py-4 text-center text-slate-600 text-[11px]">Loading...</div>
          ) : deals.length === 0 ? (
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
                    {fmt(deal.created_at)}
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
