import React from 'react';
import { isDemoMode, isCaptureMode } from '../lib/demoMode';

const GOLD = '#D4A843';

export default function DemoBanner(): React.ReactElement | null {
  if (!isDemoMode()) return null;
  // ?demo=1&capture=1 drops the bar for screen recording. See isCaptureMode
  // for why that is not the same as hiding that this is sample data.
  if (isCaptureMode()) return null;

  const exitDemo = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    window.location.href = url.pathname + (url.search || '');
  };

  // The gold CTA used to call exitDemo, doing exactly what the grey Exit
  // button beside it did: drop the demo and land back on the marketing page.
  // Someone who has just seen the product work and wants it should not be
  // dropped at the top of the funnel.
  const requestAccess = () => {
    const url = new URL(window.location.href);
    url.searchParams.delete('demo');
    url.searchParams.set('request', '1');
    window.location.href = url.pathname + url.search;
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
            onClick={requestAccess}
            className="px-3 py-1.5 rounded-md text-[12px] font-semibold text-white hover:opacity-90 transition-all"
            style={{ backgroundColor: GOLD }}
          >
            Request access
          </button>
        </div>
      </div>
    </div>
  );
}
