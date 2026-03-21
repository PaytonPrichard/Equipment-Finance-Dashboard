import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import OrgSetup from './components/OrgSetup';
import useSofrRate from './hooks/useSofrRate';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { useSessionGuard } from './hooks/useSessionGuard';
import { useOrgPlan } from './hooks/useOrgPlan';
import PlanBanner from './components/PlanBanner';
import Header from './components/Header';
import DealInputForm from './components/DealInputForm';
import RiskScoreGauge from './components/RiskScoreGauge';
import RiskRadarChart from './components/RiskRadarChart';
import MetricCard from './components/MetricCard';
import DealRecommendation from './components/DealRecommendation';
import SuggestedStructure from './components/SuggestedStructure';
import ScreeningVerdict from './components/ScreeningVerdict';
import ScreeningCriteria from './components/ScreeningCriteria';
import { DEFAULT_CRITERIA, evaluateScreening } from './lib/screeningCriteria';
import StressTestPanel from './components/StressTestPanel';
import ExportPanel from './components/ExportPanel';
// import SavedDeals from './components/SavedDeals'; // Hidden — pipeline replaces save library
import CsvImport from './components/CsvImport';
import ExecutiveSummary from './components/ExecutiveSummary';
import { fetchSavedDeals } from './lib/deals';
import { updatePipelineDeal } from './lib/pipeline';
import { fetchPreferences, upsertPreferences } from './lib/preferences';
import exampleDeals from './data/exampleDeals';
import historicalDeals from './data/historicalDeals';
import {
  formatRatio,
  formatPercent,
  formatCurrencyFull,
  formatCurrency,
} from './utils/format';
import { getModule, getAvailableModules, DEFAULT_MODULE } from './modules';
import { FINANCING_TYPES } from './modules/equipment-finance/constants';
import {
  calculateMetrics as eqCalculateMetrics,
  calculateRiskScore as eqCalculateRiskScore,
  getRecommendation as eqGetRecommendation,
} from './modules/equipment-finance/scoring';
import { INITIAL_INPUTS as EQ_INITIAL_INPUTS_CONST } from './modules/equipment-finance/constants';

// Lazy-loaded components — only fetched when their tab/section is active
const HistoricalDealsTable = lazy(() => import('./components/HistoricalDealsTable'));
const PortfolioAnalytics = lazy(() => import('./components/PortfolioAnalytics'));
const DealComparison = lazy(() => import('./components/DealComparison'));
const DealPipeline = lazy(() => import('./components/DealPipeline'));
const BatchScreening = lazy(() => import('./components/BatchScreening'));
const AuditLogViewer = lazy(() => import('./components/AuditLogViewer'));
const TeamManagement = lazy(() => import('./components/TeamManagement'));
const PipelineDashboard = lazy(() => import('./components/PipelineDashboard'));
const InfoGuide = lazy(() => import('./components/InfoGuide'));
const BillingPage = lazy(() => import('./components/BillingPage'));
const DueDiligenceChecklist = lazy(() => import('./components/DueDiligenceChecklist'));
const ComparableDeals = lazy(() => import('./components/ComparableDeals'));
const WhatIfPanel = lazy(() => import('./components/WhatIfPanel'));
const AmortizationSchedule = lazy(() => import('./components/AmortizationSchedule'));
const IndustryBenchmarks = lazy(() => import('./components/IndustryBenchmarks'));
const SensitivityChart = lazy(() => import('./components/SensitivityChart'));
const ScoringWeights = lazy(() => import('./components/ScoringWeights'));

// Fallback for lazy-loaded components
function LazyFallback() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex items-center gap-3">
        <div className="w-5 h-5 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
        <span className="text-sm text-slate-500">Loading...</span>
      </div>
    </div>
  );
}

// Error boundary for lazy-loaded components
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('Component error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mb-4">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="2">
              <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <p className="text-sm text-slate-300 mb-1">Something went wrong</p>
          <p className="text-[11px] text-slate-500 mb-4">This section failed to load.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white hover:bg-white/[0.08] transition-all"
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

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
  const [showLogin, setShowLogin] = useState(false);

  // Auto sign-out after 30 minutes of inactivity
  useIdleTimeout(() => {
    if (session) signOut();
  });

  // Show loading screen while auth initializes
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#141210] flex flex-col items-center justify-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-gold-500 to-gold-600 shadow-lg shadow-gold-500/20 mb-6">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
            <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
          </svg>
        </div>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
          <span className="text-sm text-slate-400 font-medium">Connecting...</span>
        </div>
      </div>
    );
  }

  // Password recovery flow — show update password form
  if (passwordRecovery) {
    return <LoginPage passwordRecovery />;
  }

  if (!session) {
    if (showLogin) {
      return <LoginPage onBackToLanding={() => setShowLogin(false)} />;
    }
    return <LandingPage onGetStarted={() => setShowLogin(true)} onSignIn={() => setShowLogin(true)} />;
  }

  // Block unverified email users
  if (session && !emailVerified) {
    return (
      <div className="min-h-screen bg-[#141210] flex items-center justify-center px-4">
        <div className="w-full max-w-md text-center">
          {/* Progress */}
          <div className="flex items-center justify-center gap-2 mb-8">
            <div className="w-2 h-2 rounded-full bg-gold-500" />
            <div className="w-8 h-0.5 bg-gold-500" />
            <div className="w-2 h-2 rounded-full bg-gold-500 animate-pulse" />
            <div className="w-8 h-0.5 bg-slate-700" />
            <div className="w-2 h-2 rounded-full bg-slate-700" />
            <span className="text-[10px] text-slate-600 ml-2">Step 2 of 3</span>
          </div>
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500/10 border border-amber-500/20 mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-400" strokeWidth="2">
              <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
              <polyline points="22,6 12,13 2,6" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white mb-2">Check your inbox</h2>
          <p className="text-sm text-slate-400 mb-2">
            We sent a verification link to <span className="text-white font-medium">{user?.email}</span>.
          </p>
          <p className="text-[11px] text-slate-500 mb-6">
            Check your spam folder if you don't see it. Usually arrives within 1–2 minutes.
          </p>
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={async () => {
                if (supabase) {
                  await supabase.auth.resend({ type: 'signup', email: user?.email });
                  const btn = document.getElementById('resend-btn');
                  if (btn) { btn.textContent = 'Sent!'; btn.disabled = true; setTimeout(() => { btn.textContent = 'Resend email'; btn.disabled = false; }, 60000); }
                }
              }}
              id="resend-btn"
              className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-white font-medium hover:bg-white/[0.08] transition-all"
            >
              Resend email
            </button>
            <button
              onClick={signOut}
              className="text-sm text-slate-500 hover:text-slate-300 font-medium transition-colors"
            >
              Sign out
            </button>
          </div>
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
  const { signOut: authSignOut } = useAuth();
  const draftSaveTimer = useRef(null);
  const { plan, isExpired, isExpiringSoon, daysRemaining } = useOrgPlan();

  // Enforce single session for Analyst tier (1 user plans)
  useSessionGuard(userId, plan === 'analyst', () => {
    alert('Your session was ended because another login was detected.');
    authSignOut();
  });

  const [savedDealsList, setSavedDealsList] = useState([]);
  const [pipelineDealsList, setPipelineDealsList] = useState([]);

  // Fetch saved deals and pipeline deals from Supabase
  useEffect(() => {
    if (profile?.org_id) {
      fetchSavedDeals(profile.org_id).then(({ data }) => {
        if (data) setSavedDealsList(data);
      });
      import('./lib/pipeline').then(({ fetchPipelineDeals }) => {
        fetchPipelineDeals(profile.org_id).then(({ data }) => {
          if (data) setPipelineDealsList(data);
        });
      });
    }
  }, [profile?.org_id]);

  // ---- Module system ----
  const [activeModule, setActiveModule] = useState(DEFAULT_MODULE);
  const mod = useMemo(() => getModule(activeModule), [activeModule]);
  const modules = useMemo(() => getAvailableModules(), []);
  const isEquipment = activeModule === 'equipment_finance';

  const handleModuleChange = (newModuleKey) => {
    if (newModuleKey === activeModule) return;
    const newMod = getModule(newModuleKey);
    // Preserve shared borrower fields across asset class switches
    const sharedFields = ['companyName', 'yearsInBusiness', 'annualRevenue', 'ebitda',
      'totalExistingDebt', 'actualAnnualDebtService', 'industrySector', 'creditRating'];
    const preserved = {};
    sharedFields.forEach(f => { if (inputs[f] !== undefined && inputs[f] !== 0 && inputs[f] !== '') preserved[f] = inputs[f]; });
    setInputs({ ...newMod.INITIAL_INPUTS, ...preserved });
    setActiveModule(newModuleKey);
    setActiveDeal(null);
  };

  const [inputs, setInputs] = useState(EQ_INITIAL_INPUTS_CONST);
  const [activeDeal, setActiveDeal] = useState(null);
  const [activePipelineDealId, setActivePipelineDealId] = useState(null);
  const [activeTab, setActiveTab] = useState('screening');
  const [importedDeals, setImportedDeals] = useState([]);
  const [guideOpen, setGuideOpen] = useState(false);
  const [recentDeals, setRecentDeals] = useState([]);
  const [sofrAlert, setSofrAlert] = useState(false);
  const [lastAcknowledgedSofr, setLastAcknowledgedSofr] = useState(null);
  const [customWeights, setCustomWeights] = useState(null);

  const { sofr, sofrDate, sofrSource } = useSofrRate();

  // Load draft state from Supabase on mount
  useEffect(() => {
    if (!userId) return;
    fetchPreferences(userId).then(({ data }) => {
      if (data?.draft_inputs) {
        const draft = data.draft_inputs;
        if (draft.activeModule) {
          setActiveModule(draft.activeModule);
        }
        const loadMod = getModule(draft.activeModule || DEFAULT_MODULE);
        if (draft.inputs) setInputs((prev) => ({ ...loadMod.INITIAL_INPUTS, ...draft.inputs }));
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
        draft_inputs: { inputs, activeDeal, recentDeals, activeModule },
      });
    }, 2000);
    return () => { if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current); };
  }, [inputs, activeDeal, recentDeals, activeModule, userId]);

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

  const valid = mod.isInputValid(inputs);

  // Dynamic module calculations
  const metrics = useMemo(() => mod.calculateMetrics(inputs, sofr), [inputs, sofr, mod]);
  const baseRiskScore = useMemo(() => mod.calculateRiskScore(inputs, metrics), [inputs, metrics, mod]);

  // Apply custom weights if set (re-weight the factor scores)
  const riskScore = useMemo(() => {
    if (!customWeights || !baseRiskScore?.factors) return baseRiskScore;
    const { factors } = baseRiskScore;
    const total = Object.values(customWeights).reduce((a, b) => a + b, 0);
    if (total === 0) return baseRiskScore;
    const composite = Math.round(
      Object.keys(customWeights).reduce((sum, key) => {
        const factorScore = factors[key] || 0;
        return sum + factorScore * (customWeights[key] / total);
      }, 0)
    );
    return { ...baseRiskScore, composite };
  }, [baseRiskScore, customWeights]);

  const recommendation = useMemo(() => mod.getRecommendation(riskScore.composite), [riskScore.composite, mod]);
  const commentary = useMemo(() => mod.generateCommentary(inputs, metrics, riskScore), [inputs, metrics, riskScore, mod]);
  const structure = useMemo(() => mod.getSuggestedStructure(inputs, metrics, riskScore.composite, sofr), [inputs, metrics, riskScore.composite, sofr, mod]);
  const stressResults = useMemo(() => valid ? mod.runStressTest(inputs, sofr) : [], [inputs, valid, sofr, mod]);
  const summaryText = useMemo(
    () => valid ? mod.generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, sofr) : '',
    [inputs, metrics, riskScore, recommendation, commentary, structure, valid, sofr, mod]
  );

  // Screening criteria (pass/flag/fail)
  const [screeningCriteria, setScreeningCriteria] = useState({ ...DEFAULT_CRITERIA });
  const screeningResult = useMemo(
    () => valid ? evaluateScreening(screeningCriteria, metrics, riskScore, inputs, activeModule) : null,
    [screeningCriteria, metrics, riskScore, inputs, activeModule, valid]
  );

  // Track recently screened deals
  useEffect(() => {
    if (valid && inputs.companyName) {
      const entry = {
        id: inputs.companyName + '_' + Date.now(),
        name: inputs.companyName,
        score: riskScore.composite,
        industry: inputs.industrySector,
        module: activeModule,
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

  // Score historical + imported deals for analytics (always equipment-finance)
  const allHistorical = useMemo(() => {
    const base = historicalDeals.map((d) => {
      const m = eqCalculateMetrics(d.inputs, sofr);
      const rs = eqCalculateRiskScore(d.inputs, m);
      const rec = eqGetRecommendation(rs.composite);
      return { ...d, m, rs, rec };
    });
    return base;
  }, [sofr]);

  // Precompute scores for example deal buttons (equipment-finance)
  const exampleScores = useMemo(() => {
    const map = {};
    exampleDeals.forEach((deal) => {
      const m = eqCalculateMetrics(deal.inputs, sofr);
      const rs = eqCalculateRiskScore(deal.inputs, m);
      map[deal.id] = rs.composite;
    });
    return map;
  }, [sofr]);

  const loadExample = (deal) => {
    // Example deals are equipment-finance, ensure module matches
    if (activeModule !== 'equipment_finance') {
      setActiveModule('equipment_finance');
    }
    setInputs(deal.inputs);
    setActiveDeal(deal.id);
    setActiveTab('screening');
  };

  const clearForm = () => {
    setInputs(mod.INITIAL_INPUTS);
    setActiveDeal(null);
    setActivePipelineDealId(null);
  };

  const loadRecentDeal = (deal) => {
    if (deal.module && deal.module !== activeModule) {
      setActiveModule(deal.module);
    }
    setInputs(deal.inputs);
    setActiveDeal(null);
    setActivePipelineDealId(null);
    setActiveTab('screening');
  };

  const handleCsvImport = (deals) => {
    setImportedDeals(deals);
    setActiveTab('historical');
  };

  const ft = inputs.financingType || 'EFA';
  const ftLabel = FINANCING_TYPES[ft]?.label || 'EFA';
  const moduleLabel = mod.META?.name || 'Equipment Finance';

  return (
    <div className="min-h-screen">
      <Header activeTab={activeTab} onTabChange={setActiveTab} onOpenGuide={() => setGuideOpen(true)} />
      <Suspense fallback={null}>
        <InfoGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
      </Suspense>
      <PlanBanner
        plan={plan}
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
        daysRemaining={daysRemaining}
        onManagePlan={() => setActiveTab('team')}
      />

      {/* SOFR Rate Indicator */}
      <div className="bg-[#141210]/80 border-b border-white/[0.04]">
        <div className="max-w-[1600px] mx-auto px-6 py-1.5 flex items-center gap-3">
          <span className="text-[10px] text-slate-600 uppercase tracking-wider font-semibold">SOFR</span>
          <span className="font-mono text-[11px] text-gold-400 font-semibold">{(sofr * 100).toFixed(2)}%</span>
          <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${
            sofrSource.includes('live') ? 'bg-emerald-500/10 text-emerald-400' :
            sofrSource.includes('cached') ? 'bg-gold-500/10 text-gold-400' :
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
      <div className="border-b border-white/[0.04] bg-[#141210]/60 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-6 py-2.5">
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'screening' && (
              <>
                {isEquipment && (
                <span className="text-[10px] font-semibold text-slate-600 uppercase tracking-widest mr-1">
                  Previous Deals:
                </span>
                )}
                {isEquipment && exampleDeals.map((deal) => {
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
                {isEquipment && (
                <button
                  onClick={() => setActiveTab('historical')}
                  className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gold-400 hover:text-gold-300 border border-gold-500/20 hover:border-gold-500/40 transition-colors"
                >
                  View History &rarr;
                </button>
                )}
                <div className="ml-auto flex items-center gap-2">
                  {valid && <ExportPanel summaryText={summaryText} inputs={inputs} metrics={metrics} riskScore={riskScore} recommendation={recommendation} screeningResult={screeningResult} profile={profile} moduleLabel={moduleLabel} />}
                  {activePipelineDealId && valid && (
                    <button
                      onClick={async () => {
                        const { error } = await updatePipelineDeal(activePipelineDealId, inputs, riskScore.composite, user?.id, profile?.org_id);
                        if (!error) {
                          const btn = document.getElementById('update-pipeline-btn');
                          if (btn) { btn.textContent = 'Updated'; setTimeout(() => { btn.textContent = 'Update Pipeline Deal'; }, 2000); }
                        }
                      }}
                      id="update-pipeline-btn"
                      className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gold-400 hover:text-gold-300 border border-gold-500/20 hover:border-gold-500/40 transition-colors"
                    >
                      Update Pipeline Deal
                    </button>
                  )}
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
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:h-[calc(100vh-160px)]">
            {/* Left: Form — independent scroll on desktop */}
            <div className="lg:col-span-5 xl:col-span-4 lg:overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              <DealInputForm
                inputs={inputs}
                onChange={setInputs}
                schema={mod.FORM_SCHEMA}
                modules={modules}
                activeModule={activeModule}
                onModuleChange={handleModuleChange}
                pipelineDeals={pipelineDealsList}
              />
            </div>

            {/* Right: Results — independent scroll on desktop */}
            <div className="lg:col-span-7 xl:col-span-8 lg:overflow-y-auto lg:pl-2">
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
                    Fill in borrower and {isEquipment ? 'equipment' : activeModule === 'accounts_receivable' ? 'receivables' : 'inventory'} details{isEquipment ? ', or load a deal above' : ''}.
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
                    {[
                      { n: '1', t: 'Borrower Financials', d: 'Revenue, EBITDA, debt' },
                      { n: '2', t: mod.FORM_SCHEMA.sections[1]?.title || 'Collateral Details', d: isEquipment ? 'Cost, type, term, structure' : activeModule === 'accounts_receivable' ? 'AR aging, concentration, dilution' : 'Composition, turnover, NOLV' },
                      { n: '3', t: 'Review Assessment', d: 'Score, metrics, stress test' },
                    ].map((s) => (
                      <div key={s.n} className="glass-card rounded-xl p-4 text-center">
                        <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center mx-auto mb-2.5">
                          <span className="text-xs font-bold text-gold-400">{s.n}</span>
                        </div>
                        <p className="text-xs text-slate-300 font-semibold mb-0.5">{s.t}</p>
                        <p className="text-[10px] text-slate-600">{s.d}</p>
                      </div>
                    ))}
                  </div>
                  {/* Try Example button */}
                  {isEquipment && exampleDeals.length > 0 && (
                    <button
                      onClick={() => loadExample(exampleDeals[0])}
                      className="mt-6 px-5 py-2.5 rounded-xl bg-gold-500/[0.08] border border-gold-500/20 text-sm text-gold-400 font-medium hover:bg-gold-500/[0.12] hover:border-gold-500/30 transition-all"
                    >
                      Load an example deal to explore
                    </button>
                  )}
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
                      isEquipment && { id: 'sec-debt', label: 'Debt Service' },
                      !isEquipment && { id: 'sec-facility', label: 'Facility' },
                      { id: 'sec-stress', label: 'Stress Test' },
                      { id: 'sec-recommendation', label: 'Recommendation' },
                      { id: 'sec-structure', label: 'Structure' },
                      isEquipment && { id: 'sec-whatif', label: 'What-If' },
                      isEquipment && { id: 'sec-comps', label: 'Comps' },
                      isEquipment && { id: 'sec-benchmarks', label: 'Benchmarks' },
                      isEquipment && { id: 'sec-sensitivity', label: 'Sensitivity' },
                      { id: 'sec-weights', label: 'Weights' },
                      { id: 'sec-policy', label: 'Policy' },
                      isEquipment && { id: 'sec-checklist', label: 'Checklist' },
                    ].filter(Boolean).map((s) => (
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
                        {inputs.industrySector}
                        {isEquipment && <> &middot; {inputs.equipmentType} &middot; {inputs.equipmentCondition} &middot; {ftLabel}</>}
                        {!isEquipment && <> &middot; {moduleLabel}</>}
                      </p>
                      {/* Financial context badges */}
                      <div className="flex items-center gap-3 mt-2">
                        {isEquipment && metrics.ebitdaMargin !== undefined && (
                          <>
                            <span className="text-[11px] text-slate-500">
                              EBITDA Margin <span className="font-mono font-semibold text-slate-300">{formatPercent(metrics.ebitdaMargin)}</span>
                            </span>
                            <span className="text-slate-700">&middot;</span>
                            <span className="text-[11px] text-slate-500">
                              Debt Yield <span className="font-mono font-semibold text-slate-300">{formatPercent(metrics.debtYield)}</span>
                            </span>
                          </>
                        )}
                        {activeModule === 'accounts_receivable' && metrics.dso !== undefined && (
                          <>
                            <span className="text-[11px] text-slate-500">
                              DSO <span className="font-mono font-semibold text-slate-300">{Math.round(metrics.dso)} days</span>
                            </span>
                            <span className="text-slate-700">&middot;</span>
                            <span className="text-[11px] text-slate-500">
                              Advance Rate <span className="font-mono font-semibold text-slate-300">{formatPercent(metrics.advanceRate * 100)}</span>
                            </span>
                          </>
                        )}
                        {activeModule === 'inventory_finance' && metrics.turnoverRatio !== undefined && (
                          <>
                            <span className="text-[11px] text-slate-500">
                              Turnover <span className="font-mono font-semibold text-slate-300">{metrics.turnoverRatio.toFixed(1)}x</span>
                            </span>
                            <span className="text-slate-700">&middot;</span>
                            <span className="text-[11px] text-slate-500">
                              Days on Hand <span className="font-mono font-semibold text-slate-300">{Math.round(metrics.daysOnHand)}</span>
                            </span>
                          </>
                        )}
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
                    <div className="flex flex-col items-end gap-2">
                      <div className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider border ${recommendation.bgClass} ${recommendation.textClass}`}>
                        Score: {riskScore.composite}/100
                      </div>
                      {/* Quick asset class switch */}
                      <div className="flex gap-1">
                        {modules.map(m => (
                          <button
                            key={m.key}
                            onClick={() => handleModuleChange(m.key)}
                            className={`px-2 py-0.5 rounded text-[9px] font-semibold transition-colors ${
                              activeModule === m.key
                                ? 'bg-gold-500/15 text-gold-400 border border-gold-500/30'
                                : 'text-slate-600 hover:text-slate-400 border border-transparent'
                            }`}
                          >
                            {m.name.replace(' Finance', '')}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Screening Verdict */}
                  {screeningResult && (
                    <ScreeningVerdict verdict={screeningResult.verdict} reasons={screeningResult.reasons} />
                  )}

                  {/* Executive Summary — equipment only (uses equipment-specific metrics) */}
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

                  {/* Metrics — module-specific cards */}
                  <div id="sec-metrics" className="grid grid-cols-2 xl:grid-cols-5 gap-3 scroll-mt-20">
                    {/* DSCR & Leverage — shared across all modules */}
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

                    {/* Equipment-specific */}
                    {isEquipment && (
                      <>
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
                      </>
                    )}

                    {/* AR-specific */}
                    {activeModule === 'accounts_receivable' && (
                      <>
                        <MetricCard
                          title="Borrowing Base" value={formatCurrency(metrics.borrowingBase)}
                          subtitle={`${formatPercent((metrics.advanceRate || 0) * 100)} of eligible AR`}
                          status={metrics.borrowingBase > 0 ? 'good' : 'weak'}
                          threshold={`Eligible AR: ${formatCurrency(metrics.eligibleAR)}`}
                        />
                        <MetricCard
                          title="DSO" value={`${Math.round(metrics.dso || 0)} days`}
                          subtitle="Days Sales Outstanding"
                          status={metrics.dso < 45 ? 'excellent' : metrics.dso <= 60 ? 'good' : metrics.dso <= 75 ? 'adequate' : 'weak'}
                          threshold="Target < 45 · Watch > 75"
                          flag={metrics.dso > 75 ? 'Elevated' : null}
                        />
                        <MetricCard
                          title="Concentration" value={formatPercent((metrics.concentrationRisk || 0) * 100)}
                          subtitle="Top customer % of AR"
                          status={(metrics.concentrationRisk || 0) < 0.15 ? 'excellent' : metrics.concentrationRisk <= 0.25 ? 'good' : 'weak'}
                          threshold="Target < 15% · Max 25%"
                          flag={metrics.concentrationRisk > 0.25 ? 'High' : null}
                        />
                      </>
                    )}

                    {/* Inventory-specific */}
                    {activeModule === 'inventory_finance' && (
                      <>
                        <MetricCard
                          title="Borrowing Base" value={formatCurrency(metrics.borrowingBase)}
                          subtitle={`${formatPercent((metrics.appliedAdvanceRate || 0) * 100)} blended rate`}
                          status={metrics.borrowingBase > 0 ? 'good' : 'weak'}
                          threshold={`Eligible: ${formatCurrency(metrics.eligibleInventory)}`}
                        />
                        <MetricCard
                          title="Turnover" value={`${(metrics.turnoverRatio || 0).toFixed(1)}x`}
                          subtitle={`${Math.round(metrics.daysOnHand || 0)} days on hand`}
                          status={metrics.turnoverRatio >= 8 ? 'excellent' : metrics.turnoverRatio >= 4 ? 'good' : metrics.turnoverRatio >= 2 ? 'adequate' : 'weak'}
                          threshold="Min 4.0x · Target 6.0x+"
                          flag={metrics.turnoverRatio < 4 ? 'Below min' : null}
                        />
                        <MetricCard
                          title="Obsolescence" value={formatPercent((metrics.obsolescenceRate || 0) * 100)}
                          subtitle="Obsolete / Total Inventory"
                          status={(metrics.obsolescenceRate || 0) < 0.05 ? 'excellent' : metrics.obsolescenceRate <= 0.10 ? 'good' : 'weak'}
                          threshold="Target < 5% · Max 10%"
                          flag={metrics.obsolescenceRate > 0.10 ? 'High' : null}
                        />
                      </>
                    )}
                  </div>

                  {/* Debt Service — Equipment only */}
                  {isEquipment && (
                    <div id="sec-debt" className="glass-card rounded-2xl p-5 scroll-mt-20">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                        Debt Service Summary
                        {ft !== 'EFA' && (
                          <span className="ml-2 text-gold-400 normal-case font-medium text-[11px]">
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
                  )}

                  {/* Facility Summary — AR & Inventory */}
                  {!isEquipment && (
                    <div id="sec-facility" className="glass-card rounded-2xl p-5 scroll-mt-20">
                      <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
                        Revolving Facility Summary
                        {!metrics.debtServiceEstimated && (
                          <span className="ml-2 text-emerald-400 normal-case font-medium text-[11px]">
                            Actual DS provided
                          </span>
                        )}
                      </h3>
                      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        {[
                          { label: 'Screening Rate', value: `${((metrics.effectiveRate || metrics.rate || 0) * 100).toFixed(2)}%` },
                          { label: activeModule === 'accounts_receivable' ? 'Eligible AR' : 'Eligible Inventory', value: formatCurrencyFull(metrics.eligibleAR || metrics.eligibleInventory || 0) },
                          { label: 'Borrowing Base', value: formatCurrencyFull(metrics.borrowingBase || 0) },
                          { label: 'Annual DS (Facility)', value: formatCurrencyFull(metrics.newAnnualDebtService || 0) },
                          { label: `Annual DS (Existing)${!metrics.debtServiceEstimated ? '' : ' est.'}`, value: formatCurrencyFull(metrics.existingDebtService || 0) },
                        ].map((item) => (
                          <div key={item.label}>
                            <span className="text-[10px] text-slate-600">{item.label}</span>
                            <p className="text-sm text-slate-200 font-mono font-semibold mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Amortization Schedule — Equipment only */}
                  {isEquipment && (
                    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
                      <AmortizationSchedule
                        principal={metrics.financedPrincipal}
                        annualRate={metrics.rate}
                        termMonths={inputs.loanTerm}
                      />
                    </Suspense></ErrorBoundary>
                  )}

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

                  {/* Interactive Tools — Equipment only (lazy-loaded) */}
                  <ErrorBoundary><Suspense fallback={<LazyFallback />}>
                    {isEquipment && (
                      <>
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
                      </>
                    )}

                    <div id="sec-weights" className="scroll-mt-20">
                      <ScoringWeights inputs={inputs} metrics={metrics} riskScore={baseRiskScore} onWeightsChange={setCustomWeights} />
                    </div>
                  </Suspense></ErrorBoundary>

                  <div id="sec-policy" className="scroll-mt-20">
                    <ScreeningCriteria
                      activeModule={activeModule}
                      onCriteriaChange={setScreeningCriteria}
                    />
                  </div>

                  {isEquipment && (
                    <ErrorBoundary><Suspense fallback={<LazyFallback />}>
                      <div id="sec-checklist" className="scroll-mt-20">
                        <DueDiligenceChecklist inputs={inputs} metrics={metrics} riskScore={riskScore} />
                      </div>
                    </Suspense></ErrorBoundary>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <ErrorBoundary><Suspense fallback={<LazyFallback />}>
            {activeTab === 'historical' ? (
              <div className="space-y-8">
                <PortfolioAnalytics scoredDeals={allHistorical} />
                <HistoricalDealsTable deals={[...historicalDeals, ...importedDeals]} sofr={sofr} />
              </div>
            ) : activeTab === 'pipeline' ? (
              <DealPipeline
                currentInputs={valid ? inputs : null}
                currentScore={valid ? riskScore.composite : null}
                onLoadDeal={(dealInputs, dealId) => { setInputs(dealInputs); setActiveDeal(null); setActivePipelineDealId(dealId || null); setActiveTab('screening'); }}
                readOnly={isExpired}
              />
            ) : activeTab === 'dashboard' ? (
              <PipelineDashboard />
            ) : activeTab === 'batch' ? (
              <BatchScreening
                sofr={sofr}
                onLoadDeal={(dealInputs) => { setInputs(dealInputs); setActiveDeal(null); setActiveTab('screening'); }}
              />
            ) : activeTab === 'audit' ? (
              <AuditLogViewer />
            ) : activeTab === 'team' ? (
              <TeamManagement />
            ) : activeTab === 'billing' ? (
              <BillingPage />
            ) : (
              /* Compare tab */
              <DealComparison
                exampleDeals={exampleDeals}
                savedDeals={savedDealsList}
                historicalDeals={historicalDeals}
                sofr={sofr}
              />
            )}
          </Suspense></ErrorBoundary>
        )}
      </div>
    </div>
  );
}
