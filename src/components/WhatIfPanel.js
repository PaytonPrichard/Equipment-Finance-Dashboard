import React, { useState, useMemo, useCallback } from 'react';
import { calculateMetrics, calculateRiskScore, formatCurrency, formatRatio, formatPercent, DEFAULT_SOFR } from '../utils/calculations';

function ScoreBadge({ score, baseScore }) {
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

function SliderRow({ label, value, min, max, step, formatFn, onChange, originalValue }) {
  const changed = value !== originalValue;
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-mono font-semibold ${changed ? 'text-blue-400' : 'text-slate-300'}`}>
            {formatFn(value)}
          </span>
          {changed && (
            <button
              onClick={() => onChange(originalValue)}
              className="text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
              title="Reset to original"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          )}
        </div>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-1.5 rounded-full appearance-none cursor-pointer what-if-slider"
        style={{
          background: `linear-gradient(to right, rgba(59,130,246,0.5) 0%, rgba(59,130,246,0.5) ${((value - min) / (max - min)) * 100}%, rgba(148,163,184,0.1) ${((value - min) / (max - min)) * 100}%, rgba(148,163,184,0.1) 100%)`,
        }}
      />
      <div className="flex justify-between text-[9px] text-slate-700">
        <span>{formatFn(min)}</span>
        <span>{formatFn(max)}</span>
      </div>
    </div>
  );
}

export default function WhatIfPanel({ inputs, metrics: baseMetrics, riskScore: baseRiskScore, sofr = DEFAULT_SOFR }) {
  const [isOpen, setIsOpen] = useState(false);

  // Slider state — initialize from inputs
  const [adjDownPayment, setAdjDownPayment] = useState(inputs.downPayment || 0);
  const [adjTerm, setAdjTerm] = useState(inputs.loanTerm || 60);
  const [adjEbitda, setAdjEbitda] = useState(inputs.ebitda || 0);

  // Reset sliders when inputs change
  const inputKey = `${inputs.ebitda}-${inputs.loanTerm}-${inputs.downPayment}-${inputs.equipmentCost}`;
  const [lastInputKey, setLastInputKey] = useState(inputKey);
  if (inputKey !== lastInputKey) {
    setAdjDownPayment(inputs.downPayment || 0);
    setAdjTerm(inputs.loanTerm || 60);
    setAdjEbitda(inputs.ebitda || 0);
    setLastInputKey(inputKey);
  }

  const hasChanges =
    adjDownPayment !== (inputs.downPayment || 0) ||
    adjTerm !== (inputs.loanTerm || 60) ||
    adjEbitda !== (inputs.ebitda || 0);

  // Calculate adjusted metrics
  const adjInputs = useMemo(() => ({
    ...inputs,
    downPayment: adjDownPayment,
    loanTerm: adjTerm,
    ebitda: adjEbitda,
  }), [inputs, adjDownPayment, adjTerm, adjEbitda]);

  const adjMetrics = useMemo(() => calculateMetrics(adjInputs, sofr), [adjInputs, sofr]);
  const adjRiskScore = useMemo(() => calculateRiskScore(adjInputs, adjMetrics), [adjInputs, adjMetrics]);

  const resetAll = useCallback(() => {
    setAdjDownPayment(inputs.downPayment || 0);
    setAdjTerm(inputs.loanTerm || 60);
    setAdjEbitda(inputs.ebitda || 0);
  }, [inputs]);

  // Compute slider ranges based on deal
  const maxDown = Math.round((inputs.equipmentCost || 0) * 0.5);
  const maxEbitda = Math.round((inputs.ebitda || 0) * 2);
  const minEbitda = Math.round((inputs.ebitda || 0) * 0.5);

  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      {/* Collapsed header / toggle */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-violet-400" strokeWidth="2">
              <path d="M12 3v18M3 12h18" />
            </svg>
          </div>
          <div className="text-left">
            <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
              What-If Scenarios
            </h3>
            <p className="text-[11px] text-slate-500">
              Adjust key parameters and see how the score changes
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {hasChanges && !isOpen && (
            <span className={`text-sm font-bold font-mono ${adjRiskScore.composite >= baseRiskScore.composite ? 'text-emerald-400' : 'text-rose-400'}`}>
              {adjRiskScore.composite > baseRiskScore.composite ? '+' : ''}{adjRiskScore.composite - baseRiskScore.composite} pts
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
          <div className="grid grid-cols-3 gap-4 items-center">
            <div className="text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Current</p>
              <ScoreBadge score={baseRiskScore.composite} baseScore={baseRiskScore.composite} />
            </div>
            <div className="flex justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="1.5">
                <path d="M5 12h14M12 5l7 7-7 7" />
              </svg>
            </div>
            <div className="text-center">
              <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Adjusted</p>
              <ScoreBadge score={adjRiskScore.composite} baseScore={baseRiskScore.composite} />
            </div>
          </div>

          {/* Sliders */}
          <div className="space-y-5">
            <SliderRow
              label="Down Payment"
              value={adjDownPayment}
              min={0}
              max={maxDown || 1000000}
              step={Math.max(Math.round((maxDown || 1000000) / 50), 1000)}
              formatFn={(v) => formatCurrency(v)}
              onChange={setAdjDownPayment}
              originalValue={inputs.downPayment || 0}
            />
            <SliderRow
              label="Loan Term"
              value={adjTerm}
              min={12}
              max={120}
              step={6}
              formatFn={(v) => `${v} mo (${(v / 12).toFixed(1)} yr)`}
              onChange={setAdjTerm}
              originalValue={inputs.loanTerm || 60}
            />
            <SliderRow
              label="EBITDA"
              value={adjEbitda}
              min={minEbitda || 100000}
              max={maxEbitda || 10000000}
              step={Math.max(Math.round((maxEbitda - minEbitda) / 50), 10000)}
              formatFn={(v) => formatCurrency(v)}
              onChange={setAdjEbitda}
              originalValue={inputs.ebitda || 0}
            />
          </div>

          {/* Metric deltas */}
          {hasChanges && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fade-in">
              {[
                {
                  label: 'DSCR',
                  base: baseMetrics.dscr,
                  adj: adjMetrics.dscr,
                  format: (v) => formatRatio(v),
                  better: (a, b) => a > b,
                },
                {
                  label: 'Leverage',
                  base: baseMetrics.leverage,
                  adj: adjMetrics.leverage,
                  format: (v) => formatRatio(v),
                  better: (a, b) => a < b,
                },
                {
                  label: 'LTV',
                  base: baseMetrics.ltv * 100,
                  adj: adjMetrics.ltv * 100,
                  format: (v) => formatPercent(v),
                  better: (a, b) => a < b,
                },
                {
                  label: 'Monthly Pmt',
                  base: baseMetrics.monthlyPayment,
                  adj: adjMetrics.monthlyPayment,
                  format: (v) => formatCurrency(v),
                  better: (a, b) => a < b,
                },
              ].map((m) => {
                const improved = m.better(m.adj, m.base);
                const changed = Math.abs(m.adj - m.base) > 0.005;
                return (
                  <div key={m.label} className="bg-white/[0.02] rounded-xl px-3 py-2.5">
                    <span className="text-[10px] text-slate-600">{m.label}</span>
                    <p className={`font-mono text-sm font-semibold ${
                      !changed ? 'text-slate-300' : improved ? 'text-emerald-400' : 'text-rose-400'
                    }`}>
                      {m.format(m.adj)}
                    </p>
                    {changed && (
                      <p className="text-[10px] text-slate-600 font-mono">
                        was {m.format(m.base)}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Reset */}
          {hasChanges && (
            <div className="flex justify-end">
              <button
                onClick={resetAll}
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-500 hover:text-slate-300 flex items-center gap-1.5"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
                Reset All
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
