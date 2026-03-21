import React, { useState } from 'react';
import { useTutorial } from '../contexts/TutorialContext';

export default function TutorialBeacon({ id, title, description, position = 'right' }) {
  const { isBeaconActive, dismissBeacon } = useTutorial() || {};
  const [showTip, setShowTip] = useState(false);

  if (!isBeaconActive || !isBeaconActive(id)) return null;

  const positionClasses = {
    right: 'left-full ml-2 top-1/2 -translate-y-1/2',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2',
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
  };

  const arrowClasses = {
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[rgba(20,20,28,0.95)] border-y-transparent border-l-transparent border-[6px]',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[rgba(20,20,28,0.95)] border-y-transparent border-r-transparent border-[6px]',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[rgba(20,20,28,0.95)] border-x-transparent border-t-transparent border-[6px]',
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[rgba(20,20,28,0.95)] border-x-transparent border-b-transparent border-[6px]',
  };

  return (
    <span className="relative inline-flex items-center hidden lg:inline-flex">
      {/* Pulsing dot */}
      <button
        onClick={() => setShowTip(!showTip)}
        className="w-2.5 h-2.5 rounded-full bg-gold-400 tutorial-beacon cursor-pointer flex-shrink-0"
        aria-label={`Tutorial hint: ${title}`}
      />

      {/* Tooltip */}
      {showTip && (
        <div className={`absolute z-[105] ${positionClasses[position]} animate-fade-in`}>
          <div className="relative bg-[rgba(20,20,28,0.95)] backdrop-blur-xl border border-white/[0.08] rounded-xl p-3 shadow-lg w-56">
            {/* Arrow */}
            <span className={`absolute ${arrowClasses[position]}`} />

            <p className="text-xs font-semibold text-gold-300 mb-1">{title}</p>
            <p className="text-[11px] text-slate-400 leading-relaxed">{description}</p>
            <button
              onClick={(e) => {
                e.stopPropagation();
                dismissBeacon(id);
                setShowTip(false);
              }}
              className="text-[10px] font-semibold text-gold-400 hover:text-gold-300 uppercase tracking-wider mt-2 transition-colors"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </span>
  );
}
