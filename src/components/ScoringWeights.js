import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPreferences, upsertPreferences } from '../lib/preferences';

const DEFAULT_WEIGHTS = {
  dscr: 25,
  leverage: 20,
  industry: 15,
  essentiality: 10,
  equipmentLtv: 10,
  yearsInBusiness: 10,
  termCoverage: 10,
};

const FACTOR_LABELS = {
  dscr: 'Debt Service Coverage',
  leverage: 'Leverage',
  industry: 'Industry Risk',
  essentiality: 'Essential Use',
  equipmentLtv: 'Equipment LTV',
  yearsInBusiness: 'Years in Business',
  termCoverage: 'Term Coverage',
};

function validateWeights(obj) {
  if (!obj) return null;
  const valid = Object.keys(DEFAULT_WEIGHTS).every(
    (k) => typeof obj[k] === 'number' && obj[k] >= 0 && obj[k] <= 40
  );
  return valid ? obj : null;
}

function WeightSlider({ factorKey, label, value, onChange }) {
  const pct = ((value - 0) / (40 - 0)) * 100;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
          {label}
        </span>
        <span className="text-sm font-mono font-semibold text-slate-300">
          {value}%
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={40}
        step={5}
        value={value}
        onChange={(e) => onChange(factorKey, parseInt(e.target.value, 10))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer scoring-weight-slider"
        style={{
          background: `linear-gradient(to right, rgba(212,168,67,0.5) 0%, rgba(212,168,67,0.5) ${pct}%, rgba(148,163,184,0.1) ${pct}%, rgba(148,163,184,0.1) 100%)`,
        }}
      />
      <div className="flex justify-between text-[9px] text-slate-700">
        <span>0%</span>
        <span>40%</span>
      </div>
    </div>
  );
}

function ScorePreview({ score, baseScore }) {
  const delta = score - baseScore;
  const color =
    score >= 75 ? 'text-emerald-400' :
    score >= 55 ? 'text-lime-400' :
    score >= 35 ? 'text-amber-400' :
    'text-rose-400';

  return (
    <div className="text-center">
      <span className={`text-3xl font-bold font-mono ${color}`}>{score}</span>
      <span className="text-sm text-slate-500 font-mono">/100</span>
      {delta !== 0 && (
        <div className={`text-sm font-mono font-semibold mt-0.5 ${delta > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
          {delta > 0 ? '+' : ''}{delta} pts
        </div>
      )}
    </div>
  );
}

export default function ScoringWeights({ inputs, metrics, riskScore, onWeightsChange }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [isOpen, setIsOpen] = useState(false);
  const [weights, setWeights] = useState({ ...DEFAULT_WEIGHTS });
  const saveTimerRef = useRef(null);

  // Load weights from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    fetchPreferences(userId).then(({ data }) => {
      const saved = validateWeights(data?.scoring_weights);
      if (saved) {
        setWeights(saved);
        if (onWeightsChange) onWeightsChange(saved);
      }
    });
    // Only run on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Debounced save to Supabase whenever weights change
  useEffect(() => {
    if (!userId) return;
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      upsertPreferences(userId, { scoring_weights: weights }).catch((err) =>
        console.error('Error saving weights:', err)
      );
    }, 1000);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [weights, userId]);

  const total = useMemo(
    () => Object.values(weights).reduce((sum, v) => sum + v, 0),
    [weights]
  );

  const isBalanced = total === 100;

  // Compute a preview score using the current custom weights
  const previewScore = useMemo(() => {
    if (!riskScore || !riskScore.factors) return null;

    const { factors } = riskScore;
    const weightFractions = {};

    // If total is zero, avoid division by zero
    if (total === 0) return { composite: 0, factors };

    // Normalize weights so they sum to 1.0
    Object.keys(DEFAULT_WEIGHTS).forEach((key) => {
      weightFractions[key] = weights[key] / total;
    });

    const composite = Math.round(
      (factors.dscr || 0) * weightFractions.dscr +
      (factors.leverage || 0) * weightFractions.leverage +
      (factors.industry || 0) * weightFractions.industry +
      (factors.essentiality || 0) * weightFractions.essentiality +
      (factors.equipmentLtv || 0) * weightFractions.equipmentLtv +
      (factors.yearsInBusiness || 0) * weightFractions.yearsInBusiness +
      (factors.termCoverage || 0) * weightFractions.termCoverage
    );

    return { composite, factors };
  }, [riskScore, weights, total]);

  const handleWeightChange = useCallback(
    (key, value) => {
      setWeights((prev) => {
        const next = { ...prev, [key]: value };
        if (onWeightsChange) onWeightsChange(next);
        return next;
      });
    },
    [onWeightsChange]
  );

  const resetDefaults = useCallback(() => {
    setWeights({ ...DEFAULT_WEIGHTS });
    if (onWeightsChange) onWeightsChange({ ...DEFAULT_WEIGHTS });
  }, [onWeightsChange]);

  const hasCustom = useMemo(
    () => Object.keys(DEFAULT_WEIGHTS).some((k) => weights[k] !== DEFAULT_WEIGHTS[k]),
    [weights]
  );

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Collapsed header / toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              Scoring Weights
            </h3>
            <p className="text-[11px] text-slate-500">
              Customize how risk factors contribute to the composite score
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

      {/* Expanded content */}
      {isOpen && (
        <div className="px-6 pb-6 space-y-6 animate-fade-in">
          {/* Score comparison */}
          {riskScore && previewScore && (
            <div className="grid grid-cols-3 gap-4 items-center">
              <div className="text-center">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Default</p>
                <ScorePreview score={riskScore.composite} baseScore={riskScore.composite} />
              </div>
              <div className="flex justify-center">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="1.5">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Weighted</p>
                <ScorePreview score={previewScore.composite} baseScore={riskScore.composite} />
              </div>
            </div>
          )}

          {/* Total indicator */}
          <div className={`flex items-center justify-between px-4 py-2.5 rounded-xl ${
            isBalanced
              ? 'bg-emerald-500/5 border border-emerald-500/20'
              : 'bg-amber-500/5 border border-amber-500/20'
          }`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
              Total Weight
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-mono font-bold ${
                isBalanced ? 'text-emerald-400' : 'text-amber-400'
              }`}>
                {total}%
              </span>
              {!isBalanced && (
                <span className="text-[10px] text-amber-400/80">
                  {total < 100 ? `${100 - total}% under` : `${total - 100}% over`} — score will be normalized
                </span>
              )}
              {isBalanced && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
            </div>
          </div>

          {/* Weight sliders */}
          <div className="space-y-4">
            {Object.keys(DEFAULT_WEIGHTS).map((key) => (
              <WeightSlider
                key={key}
                factorKey={key}
                label={FACTOR_LABELS[key]}
                value={weights[key]}
                onChange={handleWeightChange}
              />
            ))}
          </div>

          {/* Factor sub-scores for context */}
          {riskScore && riskScore.factors && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {Object.keys(DEFAULT_WEIGHTS).map((key) => {
                const factorScore = riskScore.factors[key];
                if (factorScore == null) return null;
                const color =
                  factorScore >= 75 ? 'text-emerald-400' :
                  factorScore >= 55 ? 'text-lime-400' :
                  factorScore >= 35 ? 'text-amber-400' :
                  'text-rose-400';
                return (
                  <div key={key} className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                    <span className="text-[10px] text-slate-600">{FACTOR_LABELS[key]}</span>
                    <p className={`font-mono text-sm font-semibold ${color}`}>
                      {factorScore}
                    </p>
                    <p className="text-[10px] text-slate-600 font-mono">
                      {weights[key]}% weight
                    </p>
                  </div>
                );
              })}
            </div>
          )}

          {/* Reset button */}
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
