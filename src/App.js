import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import { useAuth } from './contexts/AuthContext';
import { supabase } from './lib/supabase';
import LoginPage from './components/LoginPage';
import LandingPage from './components/LandingPage';
import OrgSetup from './components/OrgSetup';
import useSofrRate from './hooks/useSofrRate';
import { useIdleTimeout } from './hooks/useIdleTimeout';
import { isDemoMode } from './lib/demoMode';
import DemoBanner from './components/DemoBanner';
import { useToast } from './contexts/ToastContext';
import { TutorialProvider, useTutorial } from './contexts/TutorialContext';
import WelcomeTutorial from './components/WelcomeTutorial';
import TutorialBeacon from './components/TutorialBeacon';
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
import { computeBorrowerExtras, fccrStatus, liquidityCoverageStatus, revenueGrowthStatus } from './utils/borrowerMetrics';
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
const SettingsPanel = lazy(() => import('./components/SettingsPanel'));
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
        <span className="text-sm text-gray-500">Loading...</span>
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
          <p className="text-sm text-gray-700 mb-1">Something went wrong</p>
          <p className="text-[11px] text-gray-500 mb-4">This section failed to load.</p>
          <button
            onClick={() => this.setState({ hasError: false })}
            className="px-4 py-2 rounded-xl bg-white/[0.04] border border-white/[0.08] text-sm text-gray-900 hover:bg-white/[0.08] transition-all"
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

export default function App() {
  const { session, user, profile, loading: authLoading, refreshProfile, passwordRecovery, emailVerified, signOut } = useAuth();
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState('signin');

  // Auto sign-out after 30 minutes of inactivity (skipped in demo mode)
  useIdleTimeout(() => {
    if (session && !isDemoMode()) signOut();
  });

  // Show loading screen while auth initializes
  if (authLoading) {
    return (
      <div className="min-h-screen bg-[#f8f9fa] flex flex-col items-center justify-center">
        <h1 className="text-2xl font-extrabold text-gray-900 tracking-tight mb-6">Tranche</h1>
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
          <span className="text-sm text-gray-400 font-medium">Loading...</span>
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
      return <LoginPage initialMode={loginMode} onBackToLanding={() => setShowLogin(false)} />;
    }
    return (
      <LandingPage
        onGetStarted={() => { setLoginMode('signup'); setShowLogin(true); }}
        onSignIn={() => { setLoginMode('signin'); setShowLogin(true); }}
      />
    );
  }

  // Block unverified email users
  if (session && !emailVerified) {
    return <EmailVerificationScreen email={user?.email} signOut={signOut} />;
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
  const { addToast } = useToast();
  const draftSaveTimer = useRef(null);
  const { plan, isExpired, isExpiringSoon, daysRemaining } = useOrgPlan();

  // Enforce single session for Analyst tier (1 user plans)
  useSessionGuard(userId, plan === 'analyst', () => {
    alert('Your session was ended because another login was detected.');
    authSignOut();
  });

  const [savedDealsList, setSavedDealsList] = useState([]);
  const [pipelineDealsList, setPipelineDealsList] = useState([]);
  const [savingToPipeline, setSavingToPipeline] = useState(false);

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
  const [settingsOpen, setSettingsOpen] = useState(false);
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
      if (Array.isArray(data?.deal_templates)) {
        setDealTemplates(data.deal_templates);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Debounced save draft state to Supabase (2s delay)
  const [draftStatus, setDraftStatus] = useState(null); // null | 'saving' | 'saved'
  const [dealTemplates, setDealTemplates] = useState([]);
  const [showTemplateMenu, setShowTemplateMenu] = useState(false);
  useEffect(() => {
    if (!userId) return;
    setDraftStatus('saving');
    if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current);
    draftSaveTimer.current = setTimeout(() => {
      upsertPreferences(userId, {
        draft_inputs: { inputs, activeDeal, recentDeals, activeModule },
      }).then(() => {
        setDraftStatus('saved');
        setTimeout(() => setDraftStatus(null), 3000);
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
  const partialValid = (inputs.annualRevenue || 0) > 0 && (inputs.ebitda || 0) > 0;

  // Org credit policy overrides
  const orgSettings = useMemo(() => profile?.organizations?.org_settings || {}, [profile?.organizations?.org_settings]);

  // Dynamic module calculations (with org rate adjustments)
  const metrics = useMemo(() => {
    const baseMetrics = mod.calculateMetrics(inputs, sofr);

    // Apply org-level spread overrides if set
    if (orgSettings.baseSpreadBps !== undefined || orgSettings.creditSpreadStrong !== undefined || orgSettings.creditSpreadWeak !== undefined) {
      const orgSpreadAdj = (orgSettings.baseSpreadBps !== undefined ? orgSettings.baseSpreadBps - (baseMetrics.rateInfo?.baseSpread || 200) : 0)
        + (inputs.creditRating === 'Strong' && orgSettings.creditSpreadStrong !== undefined ? orgSettings.creditSpreadStrong - (baseMetrics.rateInfo?.creditAdj || -75) : 0)
        + (inputs.creditRating === 'Weak' && orgSettings.creditSpreadWeak !== undefined ? orgSettings.creditSpreadWeak - (baseMetrics.rateInfo?.creditAdj || 200) : 0);

      if (orgSpreadAdj !== 0) {
        const adjRate = (baseMetrics.rate || baseMetrics.effectiveRate || 0) + orgSpreadAdj / 10000;
        const adjNewDS = baseMetrics.netFinanced ? baseMetrics.netFinanced * adjRate / (baseMetrics.monthlyPayment ? 1 : 1) : baseMetrics.borrowingBase ? baseMetrics.borrowingBase * adjRate : baseMetrics.newAnnualDebtService;
        const totalDS = baseMetrics.existingDebtService + (adjNewDS || baseMetrics.newAnnualDebtService);
        const adjDscr = inputs.ebitda && totalDS > 0 ? inputs.ebitda / totalDS : baseMetrics.dscr;
        return {
          ...baseMetrics,
          rate: adjRate,
          effectiveRate: adjRate,
          newAnnualDebtService: adjNewDS || baseMetrics.newAnnualDebtService,
          dscr: adjDscr,
        };
      }
    }
    return baseMetrics;
  }, [inputs, sofr, mod, orgSettings]);
  const baseRiskScore = useMemo(() => mod.calculateRiskScore(inputs, metrics), [inputs, metrics, mod]);
  const borrowerExtras = useMemo(() => computeBorrowerExtras(inputs, metrics), [inputs, metrics]);

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
    if (!window.confirm('Clear all fields? This cannot be undone.')) return;
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

  // eslint-disable-next-line no-unused-vars
  const handleCsvImport = (deals) => {
    setImportedDeals(deals);
    setActiveTab('historical');
  };

  const ft = inputs.financingType || 'EFA';
  const ftLabel = FINANCING_TYPES[ft]?.label || 'EFA';
  const moduleLabel = mod.META?.name || 'Equipment Finance';

  return (
    <TutorialProvider userId={userId}>
    <TutorialWelcomeHandler loadExample={loadExample} exampleDeals={exampleDeals} addToast={addToast} />
    <div className="min-h-screen">
      <DemoBanner />
      <Header activeTab={activeTab} onTabChange={setActiveTab} onOpenGuide={() => setGuideOpen(true)} onOpenSettings={() => setSettingsOpen(true)} />
      <Suspense fallback={null}>
        <InfoGuide isOpen={guideOpen} onClose={() => setGuideOpen(false)} />
        <Suspense fallback={null}>
          <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} onCriteriaChange={setScreeningCriteria} activeModule={activeModule} />
        </Suspense>
      </Suspense>
      <PlanBanner
        plan={plan}
        isExpired={isExpired}
        isExpiringSoon={isExpiringSoon}
        daysRemaining={daysRemaining}
        onManagePlan={() => setActiveTab('team')}
      />

      {/* SOFR Change Alert Banner (only shows when rate moves >25bps) */}
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
              <span className="text-[11px] text-amber-800">
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
              className="flex-shrink-0 text-amber-600 hover:text-amber-800 transition-colors p-1 rounded hover:bg-amber-100"
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

      {/* Toolbar */}
      {(activeTab === 'screening' || activeTab === 'batch') && (
      <div className="border-b border-gray-200 bg-white/80 backdrop-blur-sm">
        <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-2">
          <div className="flex items-center gap-2">
            {/* Single / Batch toggle */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setActiveTab('screening')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  activeTab === 'screening' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Single Deal
              </button>
              <button
                onClick={() => setActiveTab('batch')}
                className={`px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all ${
                  activeTab === 'batch' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Batch Upload
              </button>
            </div>
            {activeTab === 'screening' && (
              <>
                <div className="ml-auto flex items-center gap-2">
                  {/* Templates */}
                  <div className="relative">
                    <button
                      onClick={() => setShowTemplateMenu(!showTemplateMenu)}
                      className="pill-btn px-3 py-2 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-700 flex items-center gap-1.5"
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                      Templates
                    </button>
                    {showTemplateMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowTemplateMenu(false)} />
                        <div className="absolute top-full right-0 mt-2 py-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-fade-in">
                          {/* Save current as template */}
                          {inputs.companyName && (
                            <button
                              onClick={() => {
                                const name = prompt('Template name:', `${inputs.industrySector || 'Deal'} Template`);
                                if (!name) return;
                                const newTemplates = [...dealTemplates, { name, inputs: { ...inputs }, module: activeModule, created: Date.now() }];
                                setDealTemplates(newTemplates);
                                upsertPreferences(userId, { deal_templates: newTemplates });
                                setShowTemplateMenu(false);
                                addToast('Template saved', 'success');
                              }}
                              className="w-full text-left px-4 py-2 text-[12px] text-gray-700 hover:bg-gray-50 transition-colors"
                            >
                              Save current as template
                            </button>
                          )}
                          {dealTemplates.length > 0 && <div className="border-t border-gray-100 my-1" />}
                          {dealTemplates.map((t, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-1.5 hover:bg-gray-50 group">
                              <button
                                onClick={() => {
                                  if (t.module && t.module !== activeModule) {
                                    handleModuleChange(t.module);
                                  }
                                  setInputs(t.inputs);
                                  setShowTemplateMenu(false);
                                }}
                                className="text-[12px] text-gray-600 truncate flex-1 text-left"
                              >
                                {t.name}
                              </button>
                              <button
                                onClick={() => {
                                  const updated = dealTemplates.filter((_, j) => j !== i);
                                  setDealTemplates(updated);
                                  upsertPreferences(userId, { deal_templates: updated });
                                }}
                                className="text-gray-300 hover:text-rose-400 opacity-0 group-hover:opacity-100 transition-all ml-2"
                              >
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                  <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                              </button>
                            </div>
                          ))}
                          {dealTemplates.length === 0 && !inputs.companyName && (
                            <p className="px-4 py-2 text-[11px] text-gray-400">No templates saved. Fill in a deal form to save one.</p>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                  {valid && <ExportPanel summaryText={summaryText} inputs={inputs} metrics={metrics} riskScore={riskScore} recommendation={recommendation} screeningResult={screeningResult} profile={profile} moduleLabel={moduleLabel} />}
                  {activePipelineDealId && valid && (
                    <button
                      onClick={async () => {
                        const { error } = await updatePipelineDeal(activePipelineDealId, inputs, riskScore.composite, user?.id, profile?.org_id);
                        if (error) {
                          addToast('Failed to update deal', 'error');
                        } else {
                          addToast('Pipeline deal updated', 'success');
                        }
                      }}
                      className="px-4 py-2 rounded-xl bg-gold-500/15 text-[11px] font-semibold text-gold-300 border border-gold-500/30 hover:bg-gold-500/20 hover:border-gold-500/40 transition-all"
                    >
                      Update Pipeline Deal
                    </button>
                  )}
                  {valid && !activePipelineDealId && (
                    <button
                      onClick={async () => {
                        if (!user?.id || !profile?.org_id) {
                          addToast('Profile is still loading. Try again in a moment.', 'warning');
                          return;
                        }
                        setSavingToPipeline(true);
                        const dealName = (inputs.companyName || '').trim() || `Untitled Deal — ${new Date().toLocaleDateString()}`;
                        const { createPipelineDeal } = await import('./lib/pipeline');
                        const { data, error } = await createPipelineDeal(user.id, profile.org_id, dealName, inputs, riskScore?.composite ?? null);
                        setSavingToPipeline(false);
                        if (error) {
                          addToast('Failed to save to pipeline.', 'error');
                        } else if (data) {
                          addToast(`Saved "${dealName}" to pipeline`, 'success');
                          setPipelineDealsList((prev) => [data, ...prev]);
                          setActivePipelineDealId(data.id);
                        }
                      }}
                      disabled={savingToPipeline}
                      className="px-4 py-2 rounded-xl text-[11px] font-semibold text-gray-900 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                      style={{ backgroundColor: '#D4A843' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                        <polyline points="17 21 17 13 7 13 7 21" />
                      </svg>
                      {savingToPipeline ? 'Saving...' : 'Save to Pipeline'}
                    </button>
                  )}
                  <button
                    onClick={clearForm}
                    className="pill-btn px-3 py-2 rounded-lg text-[11px] font-medium text-gray-400 hover:text-slate-400"
                  >
                    Clear
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Main */}
      <div className="max-w-[1600px] mx-auto px-3 md:px-6 py-4 md:py-8">
        {activeTab === 'batch' ? (
          <ErrorBoundary><Suspense fallback={<LazyFallback />}>
            <BatchScreening
              sofr={sofr}
              activeModule={activeModule}
              onLoadDeal={(dealInputs) => { setInputs(dealInputs); setActiveDeal(null); setActiveTab('screening'); }}
            />
          </Suspense></ErrorBoundary>
        ) : activeTab === 'screening' ? (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:h-[calc(100vh-160px)]">
            {/* Left: Form — independent scroll on desktop */}
            <div className="lg:col-span-4 lg:overflow-y-auto" style={{ scrollbarWidth: 'none' }}>
              <DealInputForm
                inputs={inputs}
                onChange={setInputs}
                schema={mod.FORM_SCHEMA}
                modules={modules}
                activeModule={activeModule}
                onModuleChange={handleModuleChange}
                pipelineDeals={pipelineDealsList}
                sofr={sofr}
                sofrSource={sofrSource}
                analystName={profile?.full_name || user?.user_metadata?.full_name || ''}
                analystEmail={user?.email || ''}
                draftStatus={draftStatus}
              />
            </div>

            {/* Right: Results — independent scroll on desktop */}
            <div className="lg:col-span-8 lg:overflow-y-auto">
              {!valid && !partialValid ? (
                <div className="flex flex-col items-center justify-center min-h-[520px] text-center">
                  <div className="w-16 h-16 rounded-2xl bg-gray-100 border border-gray-200 flex items-center justify-center mb-5">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gray-400" strokeWidth="1.5">
                      <path d="M9 17H7A5 5 0 0 1 7 7h2" />
                      <path d="M15 7h2a5 5 0 1 1 0 10h-2" />
                      <line x1="8" y1="12" x2="16" y2="12" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Enter Deal Parameters</h3>
                  <p className="text-sm text-gray-400 max-w-md mb-8">
                    Fill in borrower and {isEquipment ? 'equipment' : activeModule === 'accounts_receivable' ? 'receivables' : 'inventory'} details to see screening results.
                  </p>
                  <div className="grid grid-cols-3 gap-4 max-w-lg w-full">
                    {[
                      { n: '1', t: 'Borrower Financials', d: 'Revenue, EBITDA, debt' },
                      { n: '2', t: mod.FORM_SCHEMA.sections[1]?.title || 'Collateral Details', d: isEquipment ? 'Cost, type, term, structure' : activeModule === 'accounts_receivable' ? 'AR aging, concentration, dilution' : 'Composition, turnover, NOLV' },
                      { n: '3', t: 'Review Assessment', d: 'Score, metrics, stress test' },
                    ].map((s) => (
                      <div key={s.n} className="glass-card rounded-xl p-4 text-center">
                        <div className="w-7 h-7 rounded-lg bg-gray-100 flex items-center justify-center mx-auto mb-2.5">
                          <span className="text-xs font-bold text-gray-500">{s.n}</span>
                        </div>
                        <p className="text-xs text-gray-700 font-semibold mb-0.5">{s.t}</p>
                        <p className="text-[10px] text-gray-400">{s.d}</p>
                      </div>
                    ))}
                  </div>
                  {/* Try Example buttons */}
                  {isEquipment && exampleDeals.length > 1 && (
                    <div className="mt-6 flex items-center gap-3">
                      <button
                        onClick={() => loadExample(exampleDeals.find(d => d.id === 'strong') || exampleDeals[0])}
                        className="px-4 py-2.5 rounded-xl bg-gray-900 text-sm text-white font-medium hover:bg-gray-800 transition-all"
                      >
                        Try a strong deal (85+)
                      </button>
                      <button
                        onClick={() => loadExample(exampleDeals.find(d => d.id === 'moderate') || exampleDeals[1])}
                        className="px-4 py-2.5 rounded-xl border border-gray-300 text-sm text-gray-700 font-medium hover:border-gray-400 transition-all"
                      >
                        Try a borderline deal (~50)
                      </button>
                    </div>
                  )}
                  {/* Recently Screened Deals */}
                  {recentDeals.length > 0 && (
                    <div className="mt-8 max-w-lg w-full">
                      <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">
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
                              className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium flex items-center gap-1.5 text-gray-500 hover:text-gray-700 transition-colors"
                              title={`${deal.industry} — Score ${s} — ${new Date(deal.timestamp).toLocaleDateString()}`}
                            >
                              <span className={`inline-flex items-center justify-center w-4 h-4 rounded-full text-[8px] font-bold leading-none text-gray-900 ${chipColor}`}>
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
              ) : !valid && partialValid ? (
                /* Partial preview: show preliminary metrics when revenue + EBITDA are filled */
                <div className="space-y-4 animate-fade-in-up">
                  <div className="glass-card rounded-2xl p-5">
                    <p className="text-[11px] text-gray-400 uppercase tracking-wider font-semibold mb-3">Preliminary Preview</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-[11px] text-gray-400">DSCR</p>
                        <p className="text-lg font-bold font-mono text-gray-800">{metrics.dscr ? metrics.dscr.toFixed(2) + 'x' : 'N/A'}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-gray-400">Leverage</p>
                        <p className="text-lg font-bold font-mono text-gray-800">{metrics.leverage ? metrics.leverage.toFixed(2) + 'x' : 'N/A'}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-400 mt-4">
                      Fill in {isEquipment ? 'equipment cost, useful life, and term' : activeModule === 'accounts_receivable' ? 'total AR outstanding' : 'total inventory'} to see full screening results.
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-6 animate-fade-in-up">
                  {/* Section Nav (simplified) */}
                  <nav className="flex flex-wrap gap-1.5 pb-1 items-center">
                    <TutorialBeacon id="nav" title="Jump To" description="Click any label to scroll to that section." position="bottom" />
                    {[
                      { id: 'sec-score', label: 'Score' },
                      { id: 'sec-metrics', label: 'Metrics' },
                      { id: 'sec-stress', label: 'Stress Test' },
                      { id: 'sec-recommendation', label: 'Assessment' },
                      { id: 'sec-structure', label: 'Structure' },
                      { id: 'sec-policy', label: 'Policy' },
                    ].map((s) => (
                      <button
                        key={s.id}
                        onClick={() => document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="px-2.5 py-1 rounded-lg text-[10px] font-semibold text-gray-500 hover:text-gray-700 bg-gray-50 border border-gray-200 hover:border-gray-300 transition-all"
                      >
                        {s.label}
                      </button>
                    ))}
                  </nav>

                  {/* Company header */}
                  <div id="sec-summary" className="flex items-center justify-between flex-wrap gap-3 scroll-mt-20">
                    <div>
                      {inputs.companyName && (
                        <h2 className="text-xl font-bold text-gray-900">{inputs.companyName}</h2>
                      )}
                      <p className="text-sm text-gray-500 mt-0.5">
                        {inputs.industrySector}
                        {isEquipment && <> &middot; {inputs.equipmentType} &middot; {inputs.equipmentCondition} &middot; {ftLabel}</>}
                        {!isEquipment && <> &middot; {moduleLabel}</>}
                      </p>
                      {/* Financial context badges */}
                      <div className="flex items-center gap-3 mt-2">
                        {isEquipment && metrics.ebitdaMargin !== undefined && (
                          <>
                            <span className="text-[11px] text-gray-500">
                              EBITDA Margin <span className="font-mono font-semibold text-gray-700">{formatPercent(metrics.ebitdaMargin)}</span>
                            </span>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-[11px] text-gray-500">
                              Debt Yield <span className="font-mono font-semibold text-gray-700">{formatPercent(metrics.debtYield)}</span>
                            </span>
                          </>
                        )}
                        {activeModule === 'accounts_receivable' && metrics.dso !== undefined && (
                          <>
                            <span className="text-[11px] text-gray-500">
                              DSO <span className="font-mono font-semibold text-gray-700">{Math.round(metrics.dso)} days</span>
                            </span>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-[11px] text-gray-500">
                              Advance Rate <span className="font-mono font-semibold text-gray-700">{formatPercent(metrics.advanceRate * 100)}</span>
                            </span>
                          </>
                        )}
                        {activeModule === 'inventory_finance' && metrics.turnoverRatio !== undefined && (
                          <>
                            <span className="text-[11px] text-gray-500">
                              Turnover <span className="font-mono font-semibold text-gray-700">{metrics.turnoverRatio.toFixed(1)}x</span>
                            </span>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-[11px] text-gray-500">
                              Days on Hand <span className="font-mono font-semibold text-gray-700">{Math.round(metrics.daysOnHand)}</span>
                            </span>
                          </>
                        )}
                        {inputs.yearsInBusiness > 0 && (
                          <>
                            <span className="text-gray-300">&middot;</span>
                            <span className="text-[11px] text-gray-500">
                              Est. <span className="font-mono font-semibold text-gray-700">{inputs.yearsInBusiness}</span> yrs
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
                                : 'text-gray-400 hover:text-slate-400 border border-transparent'
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
                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                        Risk Score
                        <TutorialBeacon id="score" title="Risk Score" description="75+ is strong, 55-74 moderate, below 35 weak." position="bottom" />
                      </h3>
                      <div className="flex items-center justify-center">
                        <RiskScoreGauge score={riskScore.composite} />
                      </div>
                    </div>
                    <div className="glass-card rounded-2xl p-5">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-3">Risk Factor Breakdown</h3>
                      <RiskRadarChart factors={riskScore.factors} />
                    </div>
                  </div>

                  {/* Metrics */}
                  <div id="sec-metrics" className="space-y-3 scroll-mt-20">
                    {/* Primary metrics: DSCR & Leverage (always prominent) */}
                    <div className="grid grid-cols-2 gap-3">
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
                    </div>

                    {/* Coverage & Liquidity & Trend (universal across modules) */}
                    <div className="grid grid-cols-3 gap-3">
                      <MetricCard
                        title="FCCR"
                        value={borrowerExtras.fccr != null ? formatRatio(borrowerExtras.fccr) : '—'}
                        subtitle={
                          borrowerExtras.fccr != null
                            ? `(EBITDA − ${formatCurrency(borrowerExtras.maintenanceCapex)}) / DS${borrowerExtras.maintCapexUserProvided ? '' : ' · capex est. 3% of rev'}`
                            : 'Needs EBITDA + debt service'
                        }
                        status={fccrStatus(borrowerExtras.fccr)}
                        threshold="Min 1.0x · Target 1.25x+"
                        flag={borrowerExtras.fccr != null && borrowerExtras.fccr < 1.0 ? 'Below 1.0x' : null}
                      />
                      <MetricCard
                        title="Liquidity"
                        value={borrowerExtras.totalLiquidity > 0 ? formatCurrency(borrowerExtras.totalLiquidity) : '—'}
                        subtitle={
                          borrowerExtras.monthsOfDebtServiceCoverage != null
                            ? `${borrowerExtras.monthsOfDebtServiceCoverage.toFixed(1)} months of debt service`
                            : 'Cash + available revolver'
                        }
                        status={liquidityCoverageStatus(borrowerExtras.monthsOfDebtServiceCoverage)}
                        threshold="Target 6+ months"
                        flag={borrowerExtras.monthsOfDebtServiceCoverage != null && borrowerExtras.monthsOfDebtServiceCoverage < 3 ? 'Thin' : null}
                      />
                      <MetricCard
                        title="Revenue Growth"
                        value={
                          borrowerExtras.revenueGrowth != null
                            ? `${borrowerExtras.revenueGrowth >= 0 ? '+' : ''}${(borrowerExtras.revenueGrowth * 100).toFixed(1)}%`
                            : '—'
                        }
                        subtitle={
                          borrowerExtras.marginTrendBps != null
                            ? `Margin ${borrowerExtras.marginTrendBps >= 0 ? '+' : ''}${Math.round(borrowerExtras.marginTrendBps)} bps YoY`
                            : 'Enter prior year revenue + EBITDA'
                        }
                        status={revenueGrowthStatus(borrowerExtras.revenueGrowth)}
                        threshold="Growth + margin expansion"
                        flag={borrowerExtras.revenueGrowth != null && borrowerExtras.revenueGrowth < -0.05 ? 'Declining' : null}
                      />
                    </div>

                    {/* Secondary metrics: module-specific */}
                    <div className="grid grid-cols-3 gap-3">

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
                  </div>

                  {/* Debt Service — Equipment only */}
                  {isEquipment && (
                    <div id="sec-debt" className="glass-card rounded-2xl p-5 scroll-mt-20">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
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
                            <span className="text-[10px] text-gray-400">{item.label}</span>
                            <p className="text-sm text-gray-800 font-mono font-semibold mt-0.5">{item.value}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Facility Summary — AR & Inventory */}
                  {!isEquipment && (
                    <div id="sec-facility" className="glass-card rounded-2xl p-5 scroll-mt-20">
                      <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-4">
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
                            <span className="text-[10px] text-gray-400">{item.label}</span>
                            <p className="text-sm text-gray-800 font-mono font-semibold mt-0.5">{item.value}</p>
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
                    <StressTestPanel stressResults={stressResults} beaconSlot={<TutorialBeacon id="stress" title="Stress Test" description="See how the deal holds up under revenue declines." position="bottom" />} />
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
        ) : activeTab === 'pipeline' ? (
          <ErrorBoundary><Suspense fallback={<LazyFallback />}>
            <DealPipeline
              currentInputs={valid ? inputs : null}
              currentScore={valid ? riskScore.composite : null}
              onLoadDeal={(dealInputs, dealId) => { setInputs(dealInputs); setActiveDeal(null); setActivePipelineDealId(dealId || null); setActiveTab('screening'); }}
              readOnly={isExpired}
            />
          </Suspense></ErrorBoundary>
        ) : activeTab === 'team' ? (
          <ErrorBoundary><Suspense fallback={<LazyFallback />}>
            <TeamManagement />
          </Suspense></ErrorBoundary>
        ) : (
          /* Dashboard group: Overview, Compare, Performance, Audit */
          <ErrorBoundary><Suspense fallback={<LazyFallback />}>
            <div className="space-y-6">
              {/* Sub-tab bar */}
              <div className="flex items-center gap-1 bg-gray-100 rounded-xl p-1 border border-gray-200 w-fit">
                {[
                  { id: 'dashboard', label: 'Overview' },
                  { id: 'compare', label: 'Compare' },
                  { id: 'historical', label: 'Performance' },
                  { id: 'audit', label: 'Audit Log' },
                ].map((sub) => (
                  <button
                    key={sub.id}
                    onClick={() => setActiveTab(sub.id)}
                    className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-all ${
                      activeTab === sub.id
                        ? 'bg-white text-gray-900 shadow-sm border border-gray-200'
                        : 'text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {sub.label}
                  </button>
                ))}
              </div>

              {activeTab === 'dashboard' && <PipelineDashboard />}
              {activeTab === 'compare' && (
                <DealComparison
                  exampleDeals={exampleDeals}
                  savedDeals={savedDealsList}
                  historicalDeals={historicalDeals}
                  sofr={sofr}
                />
              )}
              {activeTab === 'historical' && (
                <div className="space-y-8">
                  <PortfolioAnalytics scoredDeals={allHistorical} />
                  <HistoricalDealsTable deals={[...historicalDeals, ...importedDeals]} sofr={sofr} />
                </div>
              )}
              {activeTab === 'audit' && <AuditLogViewer />}
            </div>
          </Suspense></ErrorBoundary>
        )}
      </div>
    </div>
    </TutorialProvider>
  );
}

// Email verification screen — Step 2 of 3 onboarding
function EmailVerificationScreen({ email, signOut }) {
  const [resendState, setResendState] = useState('idle'); // idle, sent, cooldown

  const handleResend = async () => {
    if (resendState !== 'idle' || !supabase) return;
    setResendState('sent');
    await supabase.auth.resend({ type: 'signup', email });
    setTimeout(() => setResendState('cooldown'), 2000);
    setTimeout(() => setResendState('idle'), 60000);
  };

  return (
    <div className="min-h-screen bg-[#f8f9fa] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center">
        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-2 h-2 rounded-full bg-gray-900" />
          <div className="w-8 h-0.5 bg-gray-900" />
          <div className="w-2 h-2 rounded-full bg-gray-900 animate-pulse" />
          <div className="w-8 h-0.5 bg-gray-200" />
          <div className="w-2 h-2 rounded-full bg-gray-200" />
          <span className="text-[10px] text-gray-400 ml-2">Step 2 of 3</span>
        </div>
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-50 border border-amber-200 mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-amber-500" strokeWidth="2">
            <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
            <polyline points="22,6 12,13 2,6" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-gray-900 mb-2">Check your inbox</h2>
        <p className="text-sm text-gray-500 mb-2">
          We sent a verification link to <span className="text-gray-900 font-medium">{email}</span>.
        </p>
        <p className="text-[11px] text-gray-400 mb-6">
          Check your spam folder if you don't see it. Usually arrives within a couple minutes.
        </p>
        <div className="flex items-center justify-center gap-4">
          <button
            onClick={handleResend}
            disabled={resendState !== 'idle'}
            className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-sm text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {resendState === 'sent' ? 'Sent!' : resendState === 'cooldown' ? 'Wait 60s' : 'Resend email'}
          </button>
          <button
            onClick={signOut}
            className="text-sm text-gray-500 hover:text-gray-700 font-medium transition-colors"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}

// Tutorial welcome handler — sits inside TutorialProvider to access context
function TutorialWelcomeHandler({ loadExample, exampleDeals, addToast }) {
  const tutorial = useTutorial();
  if (!tutorial?.showWelcome) return null;
  return (
    <WelcomeTutorial
      onComplete={() => {
        tutorial.completeWelcome();
        if (exampleDeals?.length > 0) {
          loadExample(exampleDeals[0]);
          addToast('Example deal loaded. Explore the results below.', 'info');
        }
      }}
      onSkip={() => tutorial.completeWelcome()}
    />
  );
}
