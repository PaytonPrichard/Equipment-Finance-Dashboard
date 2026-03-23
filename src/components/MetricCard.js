import React from 'react';

function getMetricColor(status) {
  switch (status) {
    case 'excellent':
      return {
        label: 'Excellent',
        text: 'text-emerald-400',
        bg: 'bg-emerald-500/[0.06]',
        border: 'border-emerald-500/15',
        dot: 'bg-emerald-400',
        glow: 'shadow-emerald-500/5',
        labelBg: 'bg-emerald-500/10 text-emerald-400',
      };
    case 'good':
      return {
        label: 'Good',
        text: 'text-teal-400',
        bg: 'bg-teal-500/[0.06]',
        border: 'border-teal-500/15',
        dot: 'bg-teal-400',
        glow: 'shadow-teal-500/5',
        labelBg: 'bg-teal-500/10 text-teal-400',
      };
    case 'adequate':
      return {
        label: 'Adequate',
        text: 'text-amber-400',
        bg: 'bg-amber-500/[0.06]',
        border: 'border-amber-500/15',
        dot: 'bg-amber-400',
        glow: 'shadow-amber-500/5',
        labelBg: 'bg-amber-500/10 text-amber-400',
      };
    case 'weak':
      return {
        label: 'Weak',
        text: 'text-rose-400',
        bg: 'bg-rose-500/[0.06]',
        border: 'border-rose-500/15',
        dot: 'bg-rose-400',
        glow: 'shadow-rose-500/5',
        labelBg: 'bg-rose-500/10 text-rose-400',
      };
    default:
      return {
        label: '',
        text: 'text-gray-500',
        bg: 'bg-slate-500/[0.06]',
        border: 'border-slate-500/15',
        dot: 'bg-slate-400',
        glow: '',
        labelBg: '',
      };
  }
}

export default function MetricCard({ title, value, subtitle, status, flag, threshold }) {
  const c = getMetricColor(status);

  return (
    <div className={`metric-card rounded-2xl p-5 border ${c.bg} ${c.border}`}>
      <div className="flex items-start justify-between mb-1.5">
        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
          {title}
        </span>
        {c.label && (
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wide ${c.labelBg}`}>
            {c.label}
          </span>
        )}
      </div>
      <p className={`text-2xl font-bold font-mono ${c.text} leading-none mb-1`}>
        {value}
      </p>
      {threshold && (
        <p className="text-[10px] text-gray-400 font-mono mb-1">
          {threshold}
        </p>
      )}
      {subtitle && (
        <p className="text-[11px] text-gray-400 leading-snug">{subtitle}</p>
      )}
      {flag && (
        <div className="mt-2.5 flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/[0.06]">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400 flex-shrink-0" strokeWidth="2.5">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>
          <span className="text-[10px] text-amber-400 font-medium">{flag}</span>
        </div>
      )}
    </div>
  );
}
