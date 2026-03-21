import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPreferences, upsertPreferences } from '../lib/preferences';
import { DEFAULT_CRITERIA, validateCriteria } from '../lib/screeningCriteria';

function CriteriaInput({ label, value, onChange, suffix, min, max, step, tip }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        {tip && (
          <span className="relative group">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-700/60 text-slate-500 text-[9px] font-bold inline-flex items-center justify-center cursor-help hover:text-gold-400 transition-colors">?</span>
            <span className="absolute bottom-full right-0 mb-2 px-2.5 py-2 rounded-lg bg-slate-800 border border-slate-700/50 text-[10px] text-slate-300 w-48 leading-relaxed shadow-xl opacity-0 pointer-events-none group-hover:opacity-100 transition-opacity z-50">
              {tip}
            </span>
          </span>
        )}
      </div>
      <div className="relative">
        <input
          type="number"
          value={value || ''}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="form-input text-sm py-2"
          min={min || 0}
          max={max}
          step={step || 1}
          style={suffix ? { paddingRight: '2.5rem' } : undefined}
        />
        {suffix && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs font-medium">{suffix}</span>
        )}
      </div>
    </div>
  );
}

export default function ScreeningCriteria({ activeModule, onCriteriaChange }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [isOpen, setIsOpen] = useState(false);
  const [criteria, setCriteria] = useState({ ...DEFAULT_CRITERIA });
  const saveTimerRef = useRef(null);
  const isEquipment = activeModule === 'equipment_finance';
  const isAR = activeModule === 'accounts_receivable';
  const isInventory = activeModule === 'inventory_finance';

  // Load criteria from preferences on mount
  useEffect(() => {
    if (!userId) return;
    fetchPreferences(userId).then(({ data }) => {
      const saved = validateCriteria(data?.screening_criteria);
      if (saved) {
        setCriteria(saved);
        if (onCriteriaChange) onCriteriaChange(saved);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Debounced save
  useEffect(() => {
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertPreferences(userId, { screening_criteria: criteria }).catch(console.error);
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [criteria, userId]);

  const updateField = useCallback((key, value) => {
    setCriteria(prev => {
      const next = { ...prev, [key]: value };
      if (onCriteriaChange) onCriteriaChange(next);
      return next;
    });
  }, [onCriteriaChange]);

  const resetDefaults = useCallback(() => {
    setCriteria({ ...DEFAULT_CRITERIA });
    if (onCriteriaChange) onCriteriaChange({ ...DEFAULT_CRITERIA });
  }, [onCriteriaChange]);

  const hasCustom = Object.keys(DEFAULT_CRITERIA).some(k => criteria[k] !== DEFAULT_CRITERIA[k]);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
              <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
              <polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Screening Policy
            </h3>
            <p className="text-[11px] text-slate-500">
              Configure pass/flag/fail thresholds for deal screening
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasCustom && !isOpen && (
            <span className="text-[10px] font-semibold text-gold-400 bg-gold-500/10 px-2 py-0.5 rounded-full">
              Custom
            </span>
          )}
          <svg
            width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-500"
            strokeWidth="2"
            style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s ease' }}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </div>
      </button>

      {isOpen && (
        <div className="px-6 pb-6 space-y-5 animate-fade-in">
          {/* Score Thresholds */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Score Thresholds
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <CriteriaInput
                label="Pass (min score)"
                value={criteria.passScore}
                onChange={(v) => updateField('passScore', v)}
                min={0} max={100}
                tip="Deals scoring at or above this threshold receive a PASS verdict."
              />
              <CriteriaInput
                label="Flag (min score)"
                value={criteria.flagScore}
                onChange={(v) => updateField('flagScore', v)}
                min={0} max={100}
                tip="Deals scoring between this and the pass threshold receive a FLAG for review. Below this = FAIL."
              />
            </div>
            {/* Visual threshold bar */}
            <div className="mt-3 h-2 rounded-full bg-slate-800 relative overflow-hidden">
              <div
                className="absolute left-0 top-0 h-full bg-rose-500/40 rounded-l-full"
                style={{ width: `${criteria.flagScore}%` }}
              />
              <div
                className="absolute top-0 h-full bg-amber-500/40"
                style={{ left: `${criteria.flagScore}%`, width: `${criteria.passScore - criteria.flagScore}%` }}
              />
              <div
                className="absolute top-0 h-full bg-emerald-500/40 rounded-r-full"
                style={{ left: `${criteria.passScore}%`, width: `${100 - criteria.passScore}%` }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px] text-rose-400/70">Fail &lt;{criteria.flagScore}</span>
              <span className="text-[9px] text-amber-400/70">Flag {criteria.flagScore}–{criteria.passScore - 1}</span>
              <span className="text-[9px] text-emerald-400/70">Pass {criteria.passScore}+</span>
            </div>
          </div>

          {/* Shared Metric Limits */}
          <div>
            <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
              Credit Policy Limits
            </h4>
            <div className="grid grid-cols-2 gap-4">
              <CriteriaInput
                label="Min DSCR"
                value={criteria.minDscr}
                onChange={(v) => updateField('minDscr', v)}
                suffix="x" step={0.05}
                tip="Minimum debt service coverage ratio. Below 1.0x auto-fails."
              />
              <CriteriaInput
                label="Max Leverage"
                value={criteria.maxLeverage}
                onChange={(v) => updateField('maxLeverage', v)}
                suffix="x" step={0.5}
                tip="Maximum total debt / EBITDA. Exceeding by 50%+ auto-fails."
              />
              <CriteriaInput
                label="Min Revenue"
                value={criteria.minRevenue}
                onChange={(v) => updateField('minRevenue', v)}
                suffix="$"
                tip="Minimum annual revenue. Set to 0 to disable."
              />
              <CriteriaInput
                label="Min Years in Business"
                value={criteria.minYearsInBusiness}
                onChange={(v) => updateField('minYearsInBusiness', v)}
                suffix="yrs"
                tip="Minimum operating history. Set to 0 to disable."
              />
            </div>
          </div>

          {/* Module-specific limits */}
          {isEquipment && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Equipment Limits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <CriteriaInput
                  label="Max LTV"
                  value={criteria.maxLtv}
                  onChange={(v) => updateField('maxLtv', v)}
                  suffix="%" max={150}
                  tip="Maximum loan-to-value ratio. Set to 100 to disable."
                />
                <CriteriaInput
                  label="Max Term Coverage"
                  value={criteria.maxTermCoverage}
                  onChange={(v) => updateField('maxTermCoverage', v)}
                  suffix="%" max={100}
                  tip="Maximum term as % of useful life."
                />
              </div>
            </div>
          )}

          {isAR && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Receivables Limits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <CriteriaInput
                  label="Max Concentration"
                  value={criteria.maxConcentration}
                  onChange={(v) => updateField('maxConcentration', v)}
                  suffix="%" max={100}
                  tip="Maximum top-customer concentration."
                />
                <CriteriaInput
                  label="Max Dilution"
                  value={criteria.maxDilution}
                  onChange={(v) => updateField('maxDilution', v)}
                  suffix="%" max={50}
                  tip="Maximum dilution rate (credits/returns as % of billings)."
                />
              </div>
            </div>
          )}

          {isInventory && (
            <div>
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                Inventory Limits
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <CriteriaInput
                  label="Min Turnover"
                  value={criteria.minTurnover}
                  onChange={(v) => updateField('minTurnover', v)}
                  suffix="x" step={0.5}
                  tip="Minimum inventory turnover ratio."
                />
                <CriteriaInput
                  label="Max Obsolescence"
                  value={criteria.maxObsolescence}
                  onChange={(v) => updateField('maxObsolescence', v)}
                  suffix="%" max={50}
                  tip="Maximum obsolete inventory as % of total."
                />
              </div>
            </div>
          )}

          {/* Reset */}
          {hasCustom && (
            <div className="flex justify-end">
              <button
                onClick={resetDefaults}
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-300 flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Reset to Defaults
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
