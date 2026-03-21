import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useRole } from '../hooks/useRole';
import { ROLE_LABELS } from '../lib/permissions';
import TutorialBeacon from './TutorialBeacon';
import { useTutorial } from '../contexts/TutorialContext';

export default function Header({ activeTab, onTabChange, onOpenGuide }) {
  const { profile, signOut } = useAuth();
  const { can } = useRole();
  const tutorial = useTutorial();
  const [moreOpen, setMoreOpen] = useState(false);
  return (
    <header className="border-b border-white/[0.06] bg-[#141210]/80 backdrop-blur-xl sticky top-0 z-50">
      <div className="max-w-[1600px] mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-500 to-gold-600 flex items-center justify-center shadow-lg shadow-gold-500/20">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
              <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
            </svg>
          </div>
          <div>
            <h1 className="text-[15px] font-bold text-white tracking-tight">
              Equipment Finance
            </h1>
            <p className="text-[10px] text-slate-500 font-medium tracking-widest uppercase">
              Deal Screening Tool
            </p>
          </div>
        </div>

        {/* Tabs + Info */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-white/[0.03] rounded-xl p-1 border border-white/[0.06]">
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
                    ? 'bg-gold-500/15 text-gold-300 shadow-sm'
                    : 'text-slate-500 hover:text-slate-300'
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
                    : 'text-slate-500 hover:text-slate-300'
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
                  <div className="absolute top-full left-0 mt-2 py-2 w-44 bg-[rgba(20,20,28,0.95)] backdrop-blur-xl border border-white/[0.08] rounded-xl shadow-xl z-50 animate-fade-in">
                    {[
                      { id: 'batch', label: 'Batch Screening' },
                      { id: 'compare', label: 'Compare Deals' },
                      { id: 'historical', label: 'Model Performance' },
                      ...(can('audit.view') ? [{ id: 'audit', label: 'Audit Log' }] : []),
                      ...(can('org.manage_users') ? [{ id: 'team', label: 'My Team' }] : []),
                      ...(can('org.manage_users') ? [{ id: 'billing', label: 'Billing' }] : []),
                    ].map((tab) => (
                      <button
                        key={tab.id}
                        onClick={() => { onTabChange(tab.id); setMoreOpen(false); }}
                        className={`w-full text-left px-4 py-2 text-xs font-medium transition-colors ${
                          activeTab === tab.id
                            ? 'text-gold-300 bg-gold-500/10'
                            : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
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
                className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-600 hover:text-gold-400 hover:bg-gold-500/10 border border-white/[0.06] hover:border-gold-500/20 transition-all"
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
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-slate-500 hover:text-gold-400 hover:bg-gold-500/10 border border-white/[0.06] hover:border-gold-500/20 transition-all"
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

        {/* User info */}
        <div className="flex items-center gap-3 text-[11px] text-slate-500">
          {profile && (
            <>
              <div className="text-right hidden lg:block">
                <span className="text-slate-300 font-medium block">{profile.full_name || profile.email}</span>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">{ROLE_LABELS[profile.role] || profile.role}</span>
              </div>
              <button
                onClick={signOut}
                className="px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-400 bg-white/[0.04] border border-white/[0.06] hover:border-rose-500/20 transition-all"
              >
                Sign Out
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
