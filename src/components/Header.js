import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import TutorialBeacon from './TutorialBeacon';
import { useTutorial } from '../contexts/TutorialContext';

export default function Header({ activeTab, onTabChange, onOpenGuide, onOpenSettings }) {
  const { profile } = useAuth();
  const tutorial = useTutorial();

  // Map sub-views to their parent tab for highlight state
  const parentTab = {
    screening: 'screening', batch: 'screening',
    pipeline: 'pipeline',
    dashboard: 'dashboard', compare: 'dashboard', historical: 'dashboard', audit: 'dashboard',
    team: 'dashboard', billing: 'dashboard',
  };
  const activeParent = parentTab[activeTab] || activeTab;

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
            {[
              { id: 'screening', label: 'New Deal' },
              { id: 'pipeline', label: 'Pipeline' },
              { id: 'dashboard', label: 'Dashboard' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
                  activeParent === tab.id
                    ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                    : 'text-gray-500 hover:text-gray-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <TutorialBeacon id="pipeline" title="Pipeline" description="Save deals here to track through your workflow." position="bottom" />
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
            <button
              onClick={onOpenGuide}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
              title="Help"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </button>
            <a
              href="mailto:team@usetranche.com"
              className="w-8 h-8 rounded-lg flex items-center justify-center text-gray-400 hover:text-gray-900 hover:bg-gray-100 border border-gray-200 hover:border-gray-300 transition-all"
              title="Contact us"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                <polyline points="22,6 12,13 2,6" />
              </svg>
            </a>
            <TutorialBeacon id="guide" title="Full Guide" description="Tap here anytime for help on every feature." position="bottom" />
          </div>
        </div>

        {/* Settings + User */}
        <div className="flex items-center gap-2">
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
          {profile && (
            <span className="text-[11px] text-gray-500 hidden lg:inline">{profile.full_name || profile.email}</span>
          )}
        </div>
      </div>
    </header>
  );
}
