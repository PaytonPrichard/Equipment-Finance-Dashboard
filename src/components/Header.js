import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import TutorialBeacon from './TutorialBeacon';
import { useTutorial } from '../contexts/TutorialContext';
import TrancheLogo from './TrancheLogo';

export default function Header({ activeTab, onTabChange, onOpenGuide, onOpenSettings }) {
  const { profile } = useAuth();
  const tutorial = useTutorial();

  // Map sub-views to their parent tab for highlight state
  const parentTab = {
    screening: 'screening', batch: 'screening',
    pipeline: 'pipeline',
    dashboard: 'dashboard', compare: 'dashboard', historical: 'dashboard', audit: 'dashboard',
    team: 'dashboard',
  };
  const activeParent = parentTab[activeTab] || activeTab;

  return (
    <header className="border-b border-gray-200 bg-white/90 backdrop-blur-md sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-2 md:py-3 flex items-center justify-between gap-2">
        {/* Logo */}
        <h1 className="text-base md:text-lg font-extrabold tracking-tight text-gray-900 flex-shrink-0 flex items-center gap-2">
          <TrancheLogo size={24} className="md:hidden" />
          <TrancheLogo size={28} className="hidden md:block" />
          <span>Tranche</span>
        </h1>

        {/* Tabs */}
        <nav className="flex items-center gap-1 bg-gray-100 rounded-xl p-0.5 md:p-1 border border-gray-200" aria-label="Main navigation">
          {[
            { id: 'screening', label: 'New Deal', shortLabel: 'Deal' },
            { id: 'pipeline', label: 'Pipeline', shortLabel: 'Pipeline' },
            { id: 'dashboard', label: 'Dashboard', shortLabel: 'Dash' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange(tab.id)}
              aria-current={activeParent === tab.id ? 'page' : undefined}
              className={`px-2.5 md:px-4 py-1.5 md:py-2 rounded-lg text-[11px] md:text-xs font-semibold transition-all ${
                activeParent === tab.id
                  ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                  : 'text-gray-500 hover:text-gray-900'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.shortLabel}</span>
            </button>
          ))}
          <TutorialBeacon id="pipeline" title="Pipeline" description="Save deals here to track through your workflow." position="bottom" />
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-1 md:gap-1.5 flex-shrink-0">
          {tutorial?.resetTutorial && (
            <button
              onClick={tutorial.resetTutorial}
              className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
              title="Replay tutorial"
              aria-label="Replay tutorial"
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
          )}
          <button
            onClick={onOpenGuide}
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
            title="Help"
            aria-label="Help guide"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="4" />
              <line x1="4.93" y1="4.93" x2="9.17" y2="9.17" />
              <line x1="14.83" y1="14.83" x2="19.07" y2="19.07" />
              <line x1="14.83" y1="9.17" x2="19.07" y2="4.93" />
              <line x1="4.93" y1="19.07" x2="9.17" y2="14.83" />
            </svg>
          </button>
          <a
            href="mailto:team@gettranche.app"
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg hidden sm:flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
            title="Contact us"
            aria-label="Contact us by email"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </a>
          <TutorialBeacon id="guide" title="Full Guide" description="Tap here anytime for help on every feature." position="bottom" />
          <button
            onClick={onOpenSettings}
            className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-gray-500 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
            title="Settings"
            aria-label="Open settings"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
          {profile && (
            <span className="text-[11px] text-gray-500 hidden lg:inline">{profile.full_name || profile.email}</span>
          )}
        </div>
      </div>
    </header>
  );
}
