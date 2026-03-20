import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import OrgSetup from './components/OrgSetup';
import useSofrRate from './hooks/useSofrRate';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useOrgPlan } from './hooks/useOrgPlan';
import PlanBanner from './components/PlanBanner';
import Header from './components/Header';
import DealInputForm from './components/DealInputForm';
import RiskScoreGauge from './components/RiskScoreGauge';
import RiskRadarChart from './components/RiskRadarChart';
import MetricCard from './components/MetricCard';
import DealRecommendation from './components/DealRecommendation';
import SuggestedStructure from './components/SuggestedStructure';
import StressTestPanel from './components/StressTestPanel';
import ExportPanel from './components/ExportPanel';
import SavedDeals from './components/SavedDeals';
import HistoricalDealsTable from './components/HistoricalDealsTable';
import PortfolioAnalytics from './components/PortfolioAnalytics';
import CsvImport from './components/CsvImport';
import DealComparison from './components/DealComparison';
import DueDiligenceChecklist from './components/DueDiligenceChecklist';
import ComparableDeals from './components/ComparableDeals';
import WhatIfPanel from './components/WhatIfPanel';
import InfoGuide from './components/InfoGuide';
import ExecutiveSummary from './components/ExecutiveSummary';
import AmortizationSchedule from './components/AmortizationSchedule';
import IndustryBenchmarks from './components/IndustryBenchmarks';
import SensitivityChart from './components/SensitivityChart';
import ScoringWeights from './components/ScoringWeights';
import DealPipeline from './components/DealPipeline';
import BatchScreening from './components/BatchScreening';
import AuditLogViewer from './components/AuditLogViewer';
import TeamManagement from './components/TeamManagement';
import { fetchSavedDeals } from './lib/deals';
import { fetchPreferences, upsertPreferences } from './lib/preferences';
import exampleDeals from './data/exampleDeals';
import historicalDeals from './data/historicalDeals';
import {
  calculateMetrics,
  calculateRiskScore,
  getRecommendation,
  generateCommentary,
  getSuggestedStructure,
  generateExportSummary,
  runStressTest,
  isInputValid,
  formatRatio,
  formatPercent,
  formatCurrencyFull,
  formatCurrency,
  FINANCING_TYPES,
  INITIAL_INPUTS,
} from './utils/calculations';

function getDscrStatus(d) {
  if (d > 2.0) return 'excellent';
  if (d >= 1.5) return 'good';
  if (d >= 1.25) return 'adequate';
  return 'weak';
}
function getLeverageStatus(l) {
  if (l < 2.0) return 'excellent';
  if (l <= 3.5) return 'good';
  if (l <= 5.0) return 'adequate';
  return 'weak';
}
function getLtvStatus(v) {
  if (v <= 0.75) return 'excellent';
  if (v <= 0.85) return 'good';
  if (v <= 1.0) return 'adequate';
  return 'weak';
}
function getTermStatus(p) {
  if (p < 60) return 'excellent';
  if (p <= 80) return 'good';
  return 'weak';
}
function getRevConcStatus(p) {
  if (p < 15) return 'excellent';
  if (p <= 25) return 'good';
  return 'weak';
}
function getScoreGlow(score) {
  if (score >= 75) return 'glow-score-strong';
  if (score >= 55) return 'glow-score-moderate';
  if (score >= 35) return 'glow-score-borderline';
  return 'glow-score-weak';
}

export default function App() {
  const { session, user, profile, loading: authLoading, refreshProfile, passwordRecovery, emailVerified, signOut } = useAuth();

  // Auto sign-out after 30 minutes of inactivity
  useIdleTimeout(() => {
    if (session) signOut();
  });

  // Show login page if not authenticated
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-slate-500 text-sm">Loading...</div>
      </div>
    );
  }

  // Password recovery flow — show update password form
  if (passwordRecovery) {
    return <LoginPage passwordRecovery />;
  }

  if (!session) {
    return <LoginPage />;
  }

  // Block unverified email users
  if (session && !emailVerified) {
    return (
      <div className="min-h-screen bg-[#0a0f1a] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Verify your email</h2>
          <p className="text-sm text-slate-400 mb-6">
            We sent a verification link to <span className="text-white font-medium">{user?.email}</span>.
            Please check your inbox and click the link to continue.
          </p>
          <button
            onClick={signOut}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  // Show org onboarding if user has no organization
  if (profile && !profile.org_id) {
    return <OrgSetup profile={profile} onComplete={refreshProfile} />;
  }

  return <AuthenticatedApp profile={profile} user={user} />;
}

function AuthenticatedApp({ profile, user }) {
  const userId = user?.id;
  const draftSaveTimer = useRef(null);
  const { plan, isExpired, isExpiringSoon, daysRemaining } = useOrgPlan();

  const [savedDealsList, setSavedDealsList] = useState([]);

  // Fetch saved deals from Supabase for DealComparison and other consumers
  useEffect(() => {
    if (profile?.org_id) {
      fetchSavedDeals(profile.org_id).then(({ data }) => {
        if (data) setSavedDealsList(data);
      });
    }
  }, [profile?.org_id]);

  const [inputs, setInputs] = useState(INITIAL_INPUTS);
  const [activeDeal, setActiveDeal] = useState(null);
  const [activeTab, setActiveTab] = useState('screening');
  const [importedDeals, setImportedDeals] = useState([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [recentDeals, setRecentDeals] = useState([]);
  const [sofrAlert, setSofrAlert] = useState(false);
  const [lastAcknowledgedSofr, setLastAcknowledgedSofr] = useState(null);

  const { sofr, sofrDate, sofrSource } = useSofrRate();

  // Load draft state from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    fetchPreferences(userId).then(({ data }) => {
      if (data?.draft_inputs) {
        const draft = data.draft_inputs;
        if (draft.inputs) setInputs((prev) => ({ ...INITIAL_INPUTS, ...draft.inputs }));
        if (draft.activeDeal !== undefined) setActiveDeal(draft.activeDeal);
        if (Array.isArray(draft.recentDeals)) setRecentDeals(draft.recentDeals);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Debounced save draft state to Supabase (2s delay)
  useEffect(() => {
    if (!userId) return;
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      upsertPreferences(userId, {
        draft_inputs: { inputs, activeDeal, recentDeals },
      });
    }, 2000);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [inputs, activeDeal, recentDeals, userId]);

  // SOFR change notification — compare current rate against last acknowledged rate
  useEffect(() => {
    if (!sofr) return;
    try {
      const stored = localStorage.getItem('efd_last_sofr');
      if (stored !== null) {
        const lastSofr = parseFloat(stored);
        if (!isNaN(lastSofr) && Math.abs(sofr - lastSofr) > 0.0025) {
          setLastAcknowledgedSofr(lastSofr);
          setSofrAlert(true);
        }
      } else {
        // First visit — seed localStorage so future sessions can compare
        localStorage.setItem('efd_last_sofr', String(sofr));
      }
    } catch { /* ignore localStorage errors */ }
  }, [sofr]);

  const dismissSofrAlert = () => {
    setSofrAlert(false);
    try {
      localStorage.setItem('efd_last_sofr', String(sofr));
    } catch { /* ignore */ }
  };

  const valid = isInputValid(inputs);

  const metrics = useMemo(() => calculateMetrics(inputs, sofr), [inputs, sofr]);
  const riskScore = useMemo(() => calculateRiskScore(inputs, metrics), [inputs, metrics]);
  const recommendation = useMemo(() => getRecommendation(riskScore.composite), [riskScore.composite]);
  const commentary = useMemo(() => generateCommentary(inputs, metrics, riskScore), [inputs, metrics, riskScore]);
  const structure = useMemo(() => getSuggestedStructure(inputs, metrics, riskScore.composite, sofr), [inputs, metrics, riskScore.composite, sofr]);
  const stressResults = useMemo(() => valid ? runStressTest(inputs, sofr) : [], [inputs, valid, sofr]);
  const summaryText = useMemo(
    () => valid ? generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, sofr) : '',
    [inputs, metrics, riskScore, recommendation, commentary, structure, valid, sofr]
  );

  // Track recently screened deals
  useEffect(() => {
    if (valid && inputs.companyName) {
      const entry = {
        id: inputs.companyName + '_' + Date.now(),
        name: inputs.companyName,
        score: riskScore.composite,
        industry: inputs.industrySector,
        timestamp: Date.now(),
        inputs: { ...inputs },
      };
      setRecentDeals((prev) => {
        const deduped = prev.filter(
          (d) => d.name.toLowerCase() !== inputs.companyName.toLowerCase()
        );
        return [entry, ...deduped].slice(0, 5);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valid, inputs.companyName, riskScore.composite]);

  // Score historical + imported deals for the analytics
  const allHistorical = useMemo(() => {
    const base = historicalDeals.map((d) => {
      const m = calculateMetrics(d.inputs, sofr);
      const rs = calculateRiskScore(d.inputs, m);
      const rec = getRecommendation(rs.composite);
      return { ...d, m, rs, rec };
    });
    return base;
  }, [sofr]);

  // Precompute scores for example deal buttons
  const exampleScores = useMemo(() => {
    const map = {};
    exampleDeals.forEach((deal) => {
      const m = calculateMetrics(deal.inputs, sofr);
      const rs = calculateRiskScore(deal.inputs, m);
      map[deal.id] = rs.composite;
    });
    return map;
  }, [sofr]);

  const loadExample = (deal) => {
    setInputs(deal.inputs);
    setActiveDeal(deal.id);
    setActiveTab('screening');
  };

  const clearForm = () => {
    setInputs(INITIAL_INPUTS);
    setActiveDeal(null);
  };

  const loadRecentDeal = (deal) => {
    setInputs(deal.inputs);
    setActiveDeal(null);
    setActiveTab('screening');
  };

  const handleCsvImport = (deals) => {
    setImportedDeals(deals);
    setActiveTab('historical');
  };

  const ft = inputs.financingType || 'EFA';
  const ftLabel = FINANCING_TYPES[ft]?.label || 'EFA';

  return (
    <div className="min-h-screen">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onOpenGuide={() => setGuideOpen(true)} />
      <InfoGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      <PlanBanner
        plan={plan}
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
        daysRemaining={daysRemaining}
        onManagePlan={() => setActiveTab('team')}
      />

      {/* SOFR Rate Indicator */}
      <div className="bg-[#0b1120]/80 border-b border-white/[0.04]">
        <div className="max-w-[1600px] mx-auto px-6 py-1.5 flex items-center gap-3">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">SOFR</span>
          <span className="font-mono text-[11px] text-blue-400 font-semibold">{(sofr * 100).toFixed(2)}%</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            sofrSource.includes('live') ? 'bg-emerald-500/10 text-emerald-400' :
            sofrSource.includes('cached') ? 'bg-blue-500/10 text-blue-400' :
            'bg-amber-500/10 text-amber-400'
          }`}>
            {sofrSource}
          </span>
          {sofrDate && (
            <span className="text-[10px] text-slate-600">as of {sofrDate}</span>
          )}
        </div>
      </div>

      {/* SOFR Change Alert Banner */}
      {sofrAlert && lastAcknowledgedSofr !== null && (
        <div className="bg-amber-500/10 border-b border-amber-500/20">
          <div className="max-w-[1600px] mx-auto px-6 py-2 flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-amber-400 flex-shrink-0">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </span>
              <span className="text-[11px] text-amber-200/90">
                SOFR has moved from{' '}
                <span className="font-mono font-semibold">{(lastAcknowledgedSofr * 100).toFixed(2)}%</span>
                {' '}to{' '}
                <span className="font-mono font-semibold">{(sofr * 100).toFixed(2)}%</span>
                {' '}
                <span className="font-mono">
                  ({sofr >= lastAcknowledgedSofr ? '+' : ''}{((sofr - lastAcknowledgedSofr) * 10000).toFixed(0)} bps)
                </span>
                {' '}since your last session. Saved deal scores may have changed.
              </span>
            </div>
            <button
              onClick={dismissSofrAlert}
              className="flex-shrink-0 text-amber-400/70 hover:text-amber-300 transition-colors p-1 rounded hover:bg-amber-500/10"
              aria-label="Dismiss SOFR alert"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </div>
      )}

      {/* Toolbar bar */}
      <div className="border-b border-white/[0.04] bg-[#0b1120]/60 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'screening' && (
              <>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mr-1">
                  Previous Deals:
                </span>
                {exampleDeals.map((deal) => {
                  const score = exampleScores[deal.id] ?? 0;
                  const scoreColor = score >= 75 ? 'bg-emerald-500 text-white' : score >= 55 ? 'bg-teal-500 text-white' : score >= 35 ? 'bg-amber-500 text-white' : 'bg-rose-500 text-white';
                  return (
                    <button
                      key={deal.id}
                      onClick={() => loadExample(deal)}
                      className={`pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 ${
                        activeDeal === deal.id ? 'pill-btn-active' : 'text-slate-500'
                      }`}
                    >
                      <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[9px] font-bold leading-none ${scoreColor}`}>
                        {score}
                      </span>
                      {deal.label}
                    </button>
                  );
                })}
                <button
                  onClick={() => setActiveTab('historical')}
                  className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-blue-400 hover:text-blue-300 border border-blue-500/20 hover:border-blue-500/40 transition-colors"
                >
                  View History &rarr;
                </button>
                <div className="ml-auto flex items-center gap-2">
                  {valid && <ExportPanel summaryText={summaryText} inputs={inputs} />}
                  <SavedDeals
                    currentInputs={valid ? inputs : null}
                    currentScore={valid ? riskScore.composite : null}
                    onLoadDeal={(dealInputs) => { setInputs(dealInputs); setActiveDeal(null); }}
                    onDealsChange={setSavedDealsList}
                    readOnly={isExpired}
                  />
                  <button
                    onClick={clearForm}
                    className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-slate-600 hover:text-slate-400"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
            {activeTab === 'historical' && (
              <>
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mr-1">
                  Portfolio:
                </span>
                <span className="text-[11px] text-slate-500">
                  {historicalDeals.length + importedDeals.length} deals scored against screening model
                </span>
                <div className="ml-auto">
                  <CsvImport onImport={handleCsvImport} />
                </div>
              </>
            )}
            {activeTab === 'compare' && (
              <span className="text-[11px] text-slate-500">
                Select two deals to compare side by side
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Main */}
      <div className="max-w-[1600px] mx-auto px-6 py-8">
        {activeTab === 'screening' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left: Form */}
            <div className="lg:col-span-5 xl:col-span-4">
              <div className="sticky top-16">
                <DealInputForm inputs={inputs} onChange={setInputs} />
              </div>
            </div>

            {/* Right: Results */}
            <div className="lg:col-span-7 xl:col-span-8">
              {!valid ? (
                <div className="flex flex-col items-center justify-center min-h-[520px] text-center">
                  <div className="w-16 h-16 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="1.5">
                      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-slate-300 mb-2">Enter Deal Parameters</h3>
                  <p className="text-sm text-slate-500 max-w-md mb-8">
                    Fill in borrower and equipment details, or load an example deal above.
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
                    {[
                      { n: '1', t: 'Borrower Financials', d: 'Revenue, EBITDA, debt' },
                      { n: '2', t: 'Equipment Details', d: 'Cost, type, term, structure' },
                      { n: '3', t: 'Review Assessment', d: 'Score, metrics, stress test' },
                    ].map((s) => (
                      <div key={s.n} className="glass-card rounded-xl p-4 text-center">
                        <div className="w-7 h-7 rounded-lg bg-blue-500/10 flex items-center justify-center mx-auto mb-2.5">
                          <span className="text-xs font-bold text-blue-400">{s.n}</span>
                        </div>
                        <p className="text-xs text-slate-300 font-semibold mb-0.5">{s.t}</p>
                        <p className="text-[10px] text-slate-600">{s.d}</p>
                      </div>
                    ))}
                  </div>
                  {/* Recently Screened Deals */}
                  {recentDeals.length > 0 && (
                    <div className="mt-8 max-w-lg w-full">
                      <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest">
                        Recently Screened
                      </span>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {recentDeals.map((deal) => {
                          const s = deal.score ?? 0;
                          const chipColor = s >= 75
                            ? 'bg-emerald-500'
                            : s >= 55
                            ? 'bg-teal-500'
                            : s >= 35
                            ? 'bg-amber-500'
                            : 'bg-rose-500';
                          return (
                            <button
                              key={deal.id}
                              onClick={() => loadRecentDeal(deal)}
                              className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
                              title={`${deal.industry} — Score ${s} — ${new Date(deal.timestamp).toLocaleDateString()}`}
                            >
                              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold leading-none text-white ${chipColor}`}>
                                {s}
                              </span>
                              {deal.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in-up">
                  {/* Section Nav */}
                  <nav className="flex flex-wrap gap-1.5 pb-1">
                    {[
                      { id: 'sec-summary', label: 'Summary' },
                      { id: 'sec-score', label: 'Score' },
                      { id: 'sec-metrics', label: 'Metrics' },
                      { id: 'sec-debt', label: 'Debt Service' },
                      { id: 'sec-stress', label: 'Stress Test' },
                      { id: 'sec-recommendation', label: 'Recommendation' },
                      { id: 'sec-structure', label: 'Structure' },
                      { id: 'sec-whatif', label: 'What-If' },
                      { id: 'sec-comps', label: 'Comps' },
                      { id: 'sec-benchmarks', label: 'Benchmarks' },
                      { id: 'sec-sensitivity', label: 'Sensitivity' },
                      { id: 'sec-weights', label: 'Weights' },
                      { id: 'sec-checklist', label: 'Checklist' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-slate-500 hover:text-slate-300 bg-white/[0.02] border border-white/[0.04] hover:border-white/[0.08] transition-all"
                      >
                        {s.label}
                      </button>
                    ))}
                  </nav>

                  {/* Company header */}
                  <div id="sec-summary" className="flex items-center justify-between flex-wrap gap-3 scroll-mt-20">
                    <div>
                      {inputs.companyName && (
                        <h2 className="text-xl font-bold text-white">{inputs.companyName}</h2>
                      )}
                      <p className="text-sm text-slate-500 mt-0.5">
                        {inputs.industrySector} &middot; {inputs.equipmentType} &middot; {inputs.equipmentCondition} &middot; {ftLabel}
                      </p>
                      {/* Financial context badges */}
                      <div className="flex items-center gap-3 mt-2">
                        <span className="text-[11px] text-slate-500">
                          EBITDA Margin <span className="font-mono font-semibold text-slate-300">{formatPercent(metrics.ebitdaMargin)}</span>
                        </span>
                        <span className="text-slate-700">&middot;</span>
                        <span className="text-[11px] text-slate-500">
                          Debt Yield <span className="font-mono font-semibold text-slate-300">{formatPercent(metrics.debtYield)}</span>
                        </span>
                        {inputs.yearsInBusiness > 0 && (
                          <>
                            <span className="text-slate-700">&middot;</span>
                            <span className="text-[11px] text-slate-500">
                              Est. <span className="font-mono font-semibold text-slate-300">{inputs.yearsInBusiness}</span> yrs
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                    <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${recommendation.bgClass} ${recommendation.textClass}`}>
                      Score: {riskScore.composite}/100
                    </div>
                  </div>

                  {/* Executive Summary */}
                  <ExecutiveSummary inputs={inputs} metrics={metrics} riskScore={riskScore} recommendation={recommendation} />

                  {/* Gauge + Radar */}
                  <div id="sec-score" className="grid grid-cols-1 md:grid-cols-2 gap-6 scroll-mt-20">
                    <div className={`glass-card rounded-2xl p-5 flex flex-col items-center justify-center ${getScoreGlow(riskScore.composite)}`}>
                      <RiskScoreGauge score={riskScore.composite} />
                    </div>
                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Risk Factor Breakdown</h3>
                      <RiskRadarChart factors={riskScore.factors} />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div id="sec-metrics" className="grid grid-cols-2 xl:grid-cols-5 gap-3 scroll-mt-20">
                    <MetricCard
                      title="DSCR" value={formatRatio(metrics.dscr)}
                      subtitle={`${formatCurrency(inputs.ebitda)} / ${formatCurrency(metrics.existingDebtService + metrics.newAnnualDebtService)} DS`}
                      status={getDscrStatus(metrics.dscr)}
                      threshold="Min 1.25x · Target 1.50x+"
                      flag={metrics.dscr < 1.25 ? 'Below threshold' : null}
                    />
                    <MetricCard
                      title="Leverage" value={formatRatio(metrics.leverage)}
                      subtitle="Total Debt / EBITDA"
                      status={getLeverageStatus(metrics.leverage)}
                      threshold="Target < 3.5x · Max 5.0x"
                      flag={metrics.leverage > 5.0 ? 'Elevated' : null}
                    />
                    <MetricCard
                      title="LTV" value={formatPercent(metrics.ltv * 100)}
                      subtitle={(inputs.downPayment || 0) > 0 ? `${formatCurrency(inputs.downPayment)} equity` : 'Financed / value'}
                      status={getLtvStatus(metrics.ltv)}
                      threshold="Target < 85% · Max 100%"
                      flag={metrics.ltv > 1.0 ? 'Over 100%' : null}
                    />
                    <MetricCard
                      title="Term / Life" value={formatPercent(metrics.termCoverage)}
                      subtitle={`${(inputs.loanTerm / 12).toFixed(1)}yr / ${inputs.usefulLife}yr`}
                      status={getTermStatus(metrics.termCoverage)}
                      threshold="Target < 60% · Max 80%"
                      flag={metrics.termCoverage > 80 ? 'Exceeds 80%' : null}
                    />
                    <MetricCard
                      title="Rev. Conc." value={formatPercent(metrics.revenueConcentration)}
                      subtitle="Equip Cost / Revenue"
                      status={getRevConcStatus(metrics.revenueConcentration)}
                      threshold="Target < 15% · Watch > 25%"
                      flag={metrics.revenueConcentration > 25 ? 'High' : null}
                    />
                  </div>

                  {/* Debt Service */}
                  <div id="sec-debt" className="glass-card rounded-2xl p-5 scroll-mt-20">
                    <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                      Debt Service Summary
                      {ft !== 'EFA' && (
                        <span className="ml-2 text-blue-400 normal-case font-medium text-[11px]">
                          {ftLabel} &middot; {formatCurrency(metrics.residualValue)} residual
                        </span>
                      )}
                      {!metrics.debtServiceEstimated && (
                        <span className="ml-2 text-emerald-400 normal-case font-medium text-[11px]">
                          Actual DS provided
                        </span>
                      )}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      {[
                        { label: 'Screening Rate', value: `${(metrics.rate * 100).toFixed(2)}%` },
                        { label: 'Net Financed', value: formatCurrencyFull(metrics.netFinanced) },
                        { label: 'Monthly Payment', value: formatCurrencyFull(metrics.monthlyPayment) },
                        { label: 'Annual DS (New)', value: formatCurrencyFull(metrics.newAnnualDebtService) },
                        { label: `Annual DS (Existing)${!metrics.debtServiceEstimated ? '' : ' est.'}`, value: formatCurrencyFull(metrics.existingDebtService) },
                      ].map((item) => (
                        <div key={item.label}>
                          <span className="text-[10px] text-slate-600">{item.label}</span>
                          <p className="text-sm text-slate-200 font-mono font-semibold mt-0.5">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Amortization Schedule */}
                  <AmortizationSchedule
                    principal={metrics.financedPrincipal}
                    annualRate={metrics.rate}
                    termMonths={inputs.loanTerm}
                  />

                  {/* Stress Test */}
                  <div id="sec-stress" className="scroll-mt-20">
                    <StressTestPanel stressResults={stressResults} />
                  </div>

                  <div id="sec-recommendation" className="scroll-mt-20">
                    <DealRecommendation recommendation={recommendation} commentary={commentary} />
                  </div>
                  <div id="sec-structure" className="scroll-mt-20">
                    <SuggestedStructure structure={structure} sofr={sofr} sofrDate={sofrDate} sofrSource={sofrSource} />
                  </div>

                  {/* Interactive Tools */}
                  <div id="sec-whatif" className="scroll-mt-20">
                    <WhatIfPanel inputs={inputs} metrics={metrics} riskScore={riskScore} sofr={sofr} />
                  </div>
                  <div id="sec-comps" className="scroll-mt-20">
                    <ComparableDeals inputs={inputs} metrics={metrics} riskScore={riskScore} sofr={sofr} />
                  </div>
                  <div id="sec-benchmarks" className="scroll-mt-20">
                    <IndustryBenchmarks inputs={inputs} metrics={metrics} riskScore={riskScore} sofr={sofr} />
                  </div>
                  <div id="sec-sensitivity" className="scroll-mt-20">
                    <SensitivityChart inputs={inputs} sofr={sofr} />
                  </div>
                  <div id="sec-weights" className="scroll-mt-20">
                    <ScoringWeights inputs={inputs} metrics={metrics} riskScore={riskScore} />
                  </div>
                  <div id="sec-checklist" className="scroll-mt-20">
                    <DueDiligenceChecklist inputs={inputs} metrics={metrics} riskScore={riskScore} />
                  </div>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'historical' ? (
          <div className="space-y-8">
            <PortfolioAnalytics scoredDeals={allHistorical} />
            <HistoricalDealsTable deals={[...historicalDeals, ...importedDeals]} sofr={sofr} />
          </div>
        ) : activeTab === 'pipeline' ? (
          <DealPipeline
            currentInputs={valid ? inputs : null}
            currentScore={valid ? riskScore.composite : null}
            onLoadDeal={(dealInputs) => { setInputs(dealInputs); setActiveDeal(null); setActiveTab('screening'); }}
            readOnly={isExpired}
          />
        ) : activeTab === 'batch' ? (
          <BatchScreening
            sofr={sofr}
            onLoadDeal={(dealInputs) => { setInputs(dealInputs); setActiveDeal(null); setActiveTab('screening'); }}
          />
        ) : activeTab === 'audit' ? (
          <AuditLogViewer />
        ) : activeTab === 'team' ? (
          <TeamManagement />
        ) : (
          /* Compare tab */
          <DealComparison
            exampleDeals={exampleDeals}
            savedDeals={savedDealsList}
            historicalDeals={historicalDeals}
            sofr={sofr}
          />
        )}
      </div>
    </div>
  );
}
