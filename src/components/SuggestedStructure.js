import React from 'react';
import { EXISTING_DEBT_SERVICE_RATE } from '../utils/calculations';

export default function SuggestedStructure({ structure, sofr, sofrDate, sofrSource }) {
  if (!structure) return null;
  const ri = structure.rateInfo;

  return (
    <div className="glass-card rounded-2xl p-6 space-y-5">
      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
        Suggested Deal Structure
      </h3>

      {/* Rate */}
      <div>
        <span className="text-[11px] text-slate-500 font-medium">Screening Rate</span>
        <div className="flex items-baseline gap-3 mt-1">
          <span className="text-2xl font-bold font-mono text-gold-400">
            {(structure.screeningRate * 100).toFixed(2)}%
          </span>
          <span className="text-xs text-slate-500">all-in</span>
        </div>
        {ri && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {[
              { label: 'SOFR', value: `${((sofr || ri.sofr) * 100).toFixed(2)}%`, color: 'text-slate-300' },
              { label: 'Base Spread', value: `+${ri.baseSpread} bps`, color: 'text-slate-300' },
              { label: 'Credit Adj.', value: `${ri.creditAdj >= 0 ? '+' : ''}${ri.creditAdj} bps`, color: ri.creditAdj <= 0 ? 'text-emerald-400' : 'text-amber-400' },
              { label: 'Industry Adj.', value: `${ri.industryAdj >= 0 ? '+' : ''}${ri.industryAdj} bps`, color: ri.industryAdj <= 0 ? 'text-emerald-400' : 'text-amber-400' },
            ].map((item) => (
              <div key={item.label} className="bg-white/[0.02] rounded-xl px-3 py-2">
                <span className="text-[10px] text-slate-600">{item.label}</span>
                <p className={`font-mono text-sm font-medium ${item.color}`}>{item.value}</p>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-slate-500 mt-2">
          Indicative range:{' '}
          <span className="font-mono text-slate-400">
            {(structure.rateRange[0] * 100).toFixed(2)}% – {(structure.rateRange[1] * 100).toFixed(2)}%
          </span>
        </p>
      </div>

      {/* Structure Type */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[11px] text-slate-500 font-medium">Structure</span>
          {structure.structureType && (
            <span className="px-2 py-0.5 rounded-md bg-gold-500/10 border border-gold-500/15 text-[10px] font-bold text-gold-400 uppercase tracking-wider">
              {structure.structureType}
            </span>
          )}
        </div>
        <p className="text-[13px] text-slate-300 leading-relaxed">
          {structure.structure}
        </p>
      </div>

      {/* Enhancements */}
      {structure.enhancements?.length > 0 && (
        <div>
          <span className="text-[11px] text-slate-500 font-medium">Recommended Enhancements</span>
          <ul className="mt-2 space-y-2">
            {structure.enhancements.map((enh, i) => (
              <li key={i} className="flex items-start gap-2.5 text-[13px] text-slate-300">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400 mt-0.5 flex-shrink-0" strokeWidth="2.5">
                  <polyline points="9 11 12 14 22 4" />
                  <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                </svg>
                {enh}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Sizing flag */}
      {structure.sizingFlag && (
        <div className="rounded-xl bg-amber-500/[0.06] border border-amber-500/15 p-4 flex items-start gap-3">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400 mt-0.5 flex-shrink-0" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <div>
            <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest">Deal Sizing Alert</span>
            <p className="text-[13px] text-amber-200/70 mt-1">{structure.sizingFlag}</p>
          </div>
        </div>
      )}

      {/* Footnote */}
      <div className="text-[10px] text-slate-600 pt-3 border-t border-white/[0.04] space-y-1">
        <p className="italic">
          Preliminary screening only. Final terms subject to full underwriting, credit committee approval, and documentation.
        </p>
        <p>
          SOFR at {((sofr || ri.sofr) * 100).toFixed(2)}%{sofrDate ? ` (${sofrSource}, ${sofrDate})` : ''}. Existing debt service estimated at {(EXISTING_DEBT_SERVICE_RATE * 100).toFixed(0)}% blended. Same rate used for DSCR above.
        </p>
      </div>
    </div>
  );
}
