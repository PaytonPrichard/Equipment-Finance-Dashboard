import React from 'react';
import { isDemoMode } from '../lib/demoMode';

const GOLD = '#D4A843';

export default function DemoBanner() {
  if (!isDemoMode()) return null;

  const exitDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.href = url.pathname + (url.search || '');
  };

  return (
    <div className="border-b border-amber-100" style={{ backgroundColor: '#FFF7E0' }}>
      <div className="max-w-[1600px] mx-auto px-4 md:px-6 py-2 flex items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span
            className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold tracking-wide text-white flex-shrink-0"
            style={{ backgroundColor: GOLD }}
          >
            DEMO
          </span>
          <span className="text-[12px] text-gray-700 truncate">
            You're exploring Tranche with sample data. Changes won't be saved.
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exitDemo}
            className="text-[12px] text-gray-500 hover:text-gray-700 transition-colors px-2 py-1"
          >
            Exit
          </button>
          <button
            onClick={exitDemo}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: GOLD }}
          >
            Sign up to save
          </button>
        </div>
      </div>
    </div>
  );
}
