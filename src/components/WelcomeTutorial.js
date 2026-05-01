import React, { useState, useEffect } from 'react';

const SLIDES = [
  {
    title: 'Welcome to Tranche',
    body: 'Enter borrower details and get an instant risk assessment in under 2 minutes.',
    visual: (
      <div className="flex items-center justify-center gap-4 py-6">
        <div className="w-14 h-14 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500" strokeWidth="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
        </div>
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-300" strokeWidth="1.5">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-emerald-400" strokeWidth="1.5">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
            <polyline points="22 4 12 14.01 9 11.01" />
          </svg>
        </div>
      </div>
    ),
  },
  {
    title: 'Input Left, Results Right',
    body: 'Fill in the left panel. Scores, metrics, and recommendations appear on the right.',
    visual: (
      <div className="flex items-center justify-center gap-3 py-6">
        <div className="w-24 rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <div className="w-full h-2 bg-gray-200 rounded mb-2" />
          <div className="w-3/4 h-2 bg-gray-200 rounded mb-2" />
          <div className="w-full h-2 bg-gray-200 rounded mb-2" />
          <div className="w-1/2 h-2 bg-gray-200 rounded" />
          <p className="text-[8px] text-gray-400 mt-2">FORM</p>
        </div>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400 flex-shrink-0" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
        <div className="w-24 rounded-xl bg-gray-50 border border-gray-200 p-3 text-center">
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 mx-auto mb-2 flex items-center justify-center">
            <span className="text-[8px] font-bold text-emerald-400">82</span>
          </div>
          <div className="w-full h-1.5 bg-emerald-500/20 rounded mb-1.5" />
          <div className="w-3/4 h-1.5 bg-lime-500/20 rounded" />
          <p className="text-[8px] text-gray-400 mt-2">RESULTS</p>
        </div>
      </div>
    ),
  },
  {
    title: 'Track, Compare, Export',
    body: 'Save deals to your pipeline. Compare side by side. Export branded screening memos.',
    visual: (
      <div className="flex items-center justify-center gap-6 py-6">
        {[
          { label: 'Pipeline', icon: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></> },
          { label: 'Compare', icon: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></> },
          { label: 'Export', icon: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="12" y1="18" x2="12" y2="12" /><polyline points="9 15 12 18 15 15" /></> },
        ].map((item) => (
          <div key={item.label} className="text-center">
            <div className="w-12 h-12 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center mx-auto mb-2">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-500" strokeWidth="1.5">
                {item.icon}
              </svg>
            </div>
            <p className="text-[10px] text-gray-500 font-medium">{item.label}</p>
          </div>
        ))}
      </div>
    ),
  },
];

export default function WelcomeTutorial({ onComplete, onSkip }) {
  const [step, setStep] = useState(0);

  // Escape to skip
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onSkip(); };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onSkip]);

  // Prevent body scroll
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);

  const slide = SLIDES[step];
  const isLast = step === SLIDES.length - 1;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center px-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onSkip} />

      {/* Modal */}
      <div className="relative w-full max-w-md bg-white border border-gray-200 rounded-2xl shadow-2xl animate-fade-in-up">
        <div className="p-8 text-center">
          {/* Visual */}
          {slide.visual}

          {/* Content */}
          <h2 className="text-lg font-bold text-gray-900 mb-2">{slide.title}</h2>
          <p className="text-sm text-gray-500 leading-relaxed max-w-sm mx-auto">{slide.body}</p>
        </div>

        {/* Bottom bar */}
        <div className="px-8 pb-6 flex items-center justify-between">
          {/* Dots */}
          <div className="flex items-center gap-2">
            {SLIDES.map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full transition-colors ${
                  i === step ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={onSkip}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Skip tour
            </button>
            {step > 0 && (
              <button
                onClick={() => setStep(s => s - 1)}
                className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50 transition-all"
              >
                Back
              </button>
            )}
            <button
              onClick={() => {
                if (isLast) {
                  onComplete();
                } else {
                  setStep(s => s + 1);
                }
              }}
              className="px-5 py-2 rounded-xl bg-gradient-to-r from-gray-800 to-gray-900 text-white text-sm font-semibold shadow-lg shadow-gray-300/20 hover:shadow-gray-300/30 hover:from-gray-700 hover:to-gray-800 transition-all"
            >
              {isLast ? 'Get Started' : 'Next'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
