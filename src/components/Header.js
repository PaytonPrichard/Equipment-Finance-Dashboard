import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
// import { ROLE_LABELS } from '../lib/permissions';
import TutorialBeacon from './TutorialBeacon';
import { useTutorial } from '../contexts/TutorialContext';

export default function Header({ activeTab, onTabChange, onOpenGuide, onOpenSettings }) {
  const { profile } = useAuth();
  const { can } = useRole();
  const tutorial = useTutorial();
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <header className="border-b border-gray-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <h1 className="text-lg font-extrabold tracking-tight">
            <span className="text-gray-900">Tranche</span>
          </h1>
        </div>

        {/* Tabs + Info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200">
            {/* Primary tabs: always visible */}
            {[
              { id: 'screening', label: 'New Deal' },
              { id: 'pipeline', label: 'Pipeline' },
              { id: 'dashboard', label: 'Dashboard' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <TutorialBeacon id="pipeline" title="Pipeline" description="Save deals here to track through your workflow." position="bottom" />

            {/* More menu */}
            <div className="relative">
              <button
                onClick={() => setMoreOpen(!moreOpen)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                  ['batch', 'compare', 'historical', 'audit', 'team', 'billing'].includes(activeTab)
                    ? 'bg-gold-500/15 text-gold-300'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                More
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="inline ml-1 -mt-0.5" strokeWidth="2.5">
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </button>
              {moreOpen && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setMoreOpen(false)} />
                  <div className="absolute top-full left-0 mt-2 py-2 w-44 bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-fade-in">
                    {[
                      { id: 'batch', label: 'Batch Screening' },
                      { id: 'compare', label: 'Compare Deals' },
                      { id: 'historical', label: 'Model Performance' },
                      ...(can('audit.view') ? [{ id: 'audit', label: 'Audit Log' }] : []),
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { onTabChange(tab.id); setMoreOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          activeTab === tab.id
                            ? 'text-gray-900 bg-gray-100'
                            : 'text-gray-500 hover:text-gray-900 hover:bg-gray-50'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {tutorial?.resetTutorial && (
              <button
                onClick={tutorial.resetTutorial}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
                title="Replay tutorial"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="1 4 1 10 7 10" />
                  <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                </svg>
              </button>
            )}
            <span className="relative">
              <button
                onClick={onOpenGuide}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
                title="Guide & Reference"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10" />
                  <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <span className="text-[10px] font-semibold hidden lg:inline">Help</span>
              </button>
              <span className="absolute -top-1 -right-1">
                <TutorialBeacon id="guide" title="Full Guide" description="Tap here anytime for help on every feature." position="bottom" />
              </span>
            </span>
          </div>
        </div>

        {/* Settings + User */}
        <div className="flex items-center gap-2">
          {profile && (
            <>
              <button
                onClick={onOpenSettings}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
                title="Settings"
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </button>
              <span className="text-[11px] text-gray-500 hidden lg:inline">{profile.full_name || profile.email}</span>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
