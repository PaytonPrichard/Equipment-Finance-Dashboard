import React from 'react';

const VERDICT_CONFIG = {
  pass: {
    label: 'PASS',
    description: 'Meets screening criteria',
    bgClass: 'bg-emerald-500/10 border-emerald-500/30',
    textClass: 'text-emerald-400',
    iconBg: 'bg-emerald-500/20',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
  },
  flag: {
    label: 'FLAG',
    description: 'Requires additional review',
    bgClass: 'bg-amber-500/10 border-amber-500/30',
    textClass: 'text-amber-400',
    iconBg: 'bg-amber-500/20',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
        <line x1="4" y1="22" x2="4" y2="15" />
      </svg>
    ),
  },
  fail: {
    label: 'FAIL',
    description: 'Does not meet screening criteria',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
    textClass: 'text-rose-400',
    iconBg: 'bg-rose-500/20',
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
  },
};

export default function ScreeningVerdict({ verdict, reasons }) {
  if (!verdict) return null;

  const config = VERDICT_CONFIG[verdict] || VERDICT_CONFIG.flag;
  const failReasons = reasons.filter(r => r.level === 'fail');
  const flagReasons = reasons.filter(r => r.level === 'flag');

  return (
    <div className={`rounded-2xl border p-5 ${config.bgClass}`}>
      <div className="flex items-center gap-4 mb-3">
        <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center ${config.textClass}`}>
          {config.icon}
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold tracking-wider ${config.textClass}`}>
              {config.label}
            </span>
          </div>
          <p className="text-[11px] text-gray-500">{config.description}</p>
        </div>
      </div>

      <div className="space-y-2 mt-3">
        {failReasons.map((r, i) => (
          <div key={`f-${i}`} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400 mt-0.5 flex-shrink-0" strokeWidth="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
            <span className="text-[11px] text-rose-600 leading-relaxed">{r.text}</span>
          </div>
        ))}
        {flagReasons.map((r, i) => (
          <div key={`w-${i}`} className="flex items-start gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400 mt-0.5 flex-shrink-0" strokeWidth="2">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <span className="text-[11px] text-amber-700 leading-relaxed">{r.text}</span>
          </div>
        ))}
        {reasons.length === 0 && verdict === 'pass' && (
          <p className="text-[11px] text-emerald-600">All screening criteria met</p>
        )}
      </div>
    </div>
  );
}
