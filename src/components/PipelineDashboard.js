import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { fetchPipelineDeals } from '../lib/pipeline';
import { formatCurrency } from '../utils/format';

const STAGES = ['Screening', 'Under Review', 'Approved', 'Funded', 'Declined'];

const STAGE_COLORS = {
  Screening:      { bg: 'bg-gold-500/[0.08]',    border: 'border-gold-500/20',    text: 'text-gold-400',    bar: 'bg-gold-500' },
  'Under Review': { bg: 'bg-amber-500/[0.08]',   border: 'border-amber-500/20',   text: 'text-amber-400',   bar: 'bg-amber-500' },
  Approved:       { bg: 'bg-emerald-500/[0.08]',  border: 'border-emerald-500/20', text: 'text-emerald-400', bar: 'bg-emerald-500' },
  Funded:         { bg: 'bg-teal-500/[0.08]',     border: 'border-teal-500/20',    text: 'text-teal-400',    bar: 'bg-teal-500' },
  Declined:       { bg: 'bg-rose-500/[0.08]',     border: 'border-rose-500/20',    text: 'text-rose-400',    bar: 'bg-rose-500' },
};

function getDealValue(deal) {
  const i = deal.inputs || {};
  return i.equipmentCost || i.totalAROutstanding || i.totalInventory || 0;
}

export default function PipelineDashboard() {
  const { profile } = useAuth();
  const [deals, setDeals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Re-fetch when component mounts (tab switch) or refreshKey changes
  useEffect(() => {
    if (!profile?.org_id) {
      setLoading(false);
      return;
    }
    setError(null);
    fetchPipelineDeals(profile.org_id).then(({ data, error: fetchErr }) => {
      if (fetchErr) setError(fetchErr.message || 'Failed to load pipeline data');
      else setDeals(data || []);
      setLoading(false);
    }).catch((err) => { setError(err.message || 'Failed to load pipeline data'); setLoading(false); });
  }, [profile?.org_id, refreshKey]);

  // Re-fetch when tab becomes visible (user switches back to Dashboard)
  useEffect(() => {
    const handleFocus = () => setRefreshKey(k => k + 1);
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, []);

  const stats = useMemo(() => {
    const byStage = {};
    STAGES.forEach(s => { byStage[s] = { count: 0, value: 0, scores: [] }; });

    deals.forEach(d => {
      const stage = d.stage || 'Screening';
      if (!byStage[stage]) byStage[stage] = { count: 0, value: 0, scores: [] };
      byStage[stage].count++;
      byStage[stage].value += getDealValue(d);
      if (d.score) byStage[stage].scores.push(d.score);
    });

    const totalDeals = deals.length;
    const totalValue = deals.reduce((sum, d) => sum + getDealValue(d), 0);
    const activePipeline = deals.filter(d => !['Funded', 'Declined'].includes(d.stage));
    const activeValue = activePipeline.reduce((sum, d) => sum + getDealValue(d), 0);

    const funded = byStage.Funded.count;
    const declined = byStage.Declined.count;
    const decided = funded + declined;
    const passRate = decided > 0 ? Math.round((funded / decided) * 100) : null;

    const allScores = deals.filter(d => d.score).map(d => d.score);
    const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length) : null;

    // Recent activity (last 7 days)
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const recentDeals = deals.filter(d => new Date(d.updated_at || d.created_at).getTime() > weekAgo).length;

    // Score distribution
    const scoreDist = { strong: 0, moderate: 0, borderline: 0, weak: 0 };
    allScores.forEach(s => {
      if (s >= 75) scoreDist.strong++;
      else if (s >= 55) scoreDist.moderate++;
      else if (s >= 35) scoreDist.borderline++;
      else scoreDist.weak++;
    });

    return { byStage, totalDeals, totalValue, activeValue, passRate, avgScore, recentDeals, scoreDist, activePipeline: activePipeline.length };
  }, [deals]);

  if (loading) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <p className="text-slate-500 text-sm">Loading pipeline data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-rose-400" strokeWidth="1.5">
            <circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>
        <p className="text-sm text-slate-300 mb-1">Unable to load dashboard</p>
        <p className="text-[11px] text-slate-500">{error}</p>
      </div>
    );
  }

  if (deals.length === 0) {
    return (
      <div className="glass-card rounded-2xl p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center mx-auto mb-4">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-slate-600" strokeWidth="1.5">
            <path d="M22 12h-4l-3 9L9 3l-3 9H2"/>
          </svg>
        </div>
        <h3 className="text-sm font-semibold text-slate-300 mb-1">Your pipeline is empty</h3>
        <p className="text-[11px] text-slate-500">Screen a deal in the New Deal tab, then add it to your pipeline to track progress here.</p>
      </div>
    );
  }

  const maxStageCount = Math.max(...Object.values(stats.byStage).map(s => s.count), 1);

  return (
    <div className="space-y-5">
      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-slate-100">{stats.totalDeals}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Total Deals</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-gold-400">{formatCurrency(stats.activeValue)}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Active Pipeline</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className={`text-2xl font-bold font-mono ${stats.passRate !== null && stats.passRate >= 50 ? 'text-emerald-400' : stats.passRate !== null ? 'text-amber-400' : 'text-slate-500'}`}>
            {stats.passRate !== null ? `${stats.passRate}%` : '—'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Pass Rate</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className={`text-2xl font-bold font-mono ${stats.avgScore >= 75 ? 'text-emerald-400' : stats.avgScore >= 55 ? 'text-lime-400' : stats.avgScore >= 35 ? 'text-amber-400' : 'text-slate-300'}`}>
            {stats.avgScore !== null ? stats.avgScore : '—'}
          </p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Avg Score</p>
        </div>
        <div className="glass-card rounded-2xl p-4 text-center">
          <p className="text-2xl font-bold font-mono text-slate-100">{stats.recentDeals}</p>
          <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider">Last 7 Days</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {/* Deals by Stage */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
            Deals by Stage
          </h3>
          <div className="space-y-3">
            {STAGES.map(stage => {
              const s = stats.byStage[stage];
              const c = STAGE_COLORS[stage];
              const pct = maxStageCount > 0 ? (s.count / maxStageCount) * 100 : 0;
              return (
                <div key={stage}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-semibold ${c.text}`}>{stage}</span>
                    <div className="flex items-center gap-3">
                      {s.value > 0 && (
                        <span className="text-[10px] text-slate-600 font-mono">{formatCurrency(s.value)}</span>
                      )}
                      <span className="text-[11px] font-mono font-semibold text-slate-300">{s.count}</span>
                    </div>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${c.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Score Distribution */}
        <div className="glass-card rounded-2xl p-5">
          <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
            Score Distribution
          </h3>
          <div className="space-y-3">
            {[
              { label: 'Strong (75+)', count: stats.scoreDist.strong, bar: 'bg-emerald-500', text: 'text-emerald-400' },
              { label: 'Moderate (55–74)', count: stats.scoreDist.moderate, bar: 'bg-lime-500', text: 'text-lime-400' },
              { label: 'Borderline (35–54)', count: stats.scoreDist.borderline, bar: 'bg-amber-500', text: 'text-amber-400' },
              { label: 'Weak (<35)', count: stats.scoreDist.weak, bar: 'bg-rose-500', text: 'text-rose-400' },
            ].map(bucket => {
              const total = stats.totalDeals || 1;
              const pct = (bucket.count / total) * 100;
              return (
                <div key={bucket.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-[11px] font-semibold ${bucket.text}`}>{bucket.label}</span>
                    <span className="text-[11px] font-mono font-semibold text-slate-300">
                      {bucket.count}
                      <span className="text-slate-600 ml-1">({pct.toFixed(0)}%)</span>
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-slate-800/60 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${bucket.bar} transition-all duration-500`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Pipeline value breakdown */}
          <div className="mt-5 pt-4 border-t border-white/[0.04]">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Total Pipeline</span>
                <p className="text-sm font-mono font-semibold text-slate-200 mt-0.5">{formatCurrency(stats.totalValue)}</p>
              </div>
              <div>
                <span className="text-[10px] text-slate-600 uppercase tracking-wider">Active Deals</span>
                <p className="text-sm font-mono font-semibold text-slate-200 mt-0.5">{stats.activePipeline}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
