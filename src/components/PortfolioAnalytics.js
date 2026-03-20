import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

const OUTCOME_COLORS = {
  Performing: '#10b981',
  'Paid Off': '#d4a843',
  Watchlist: '#f59e0b',
  Defaulted: '#ef4444',
};

const THRESHOLD = 55;

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl shadow-2xl px-3 py-2">
      <p className="text-xs text-slate-200 font-medium">{label}</p>
      <p className="text-xs text-slate-400">
        Avg Score: <span className="text-white font-semibold">{payload[0].value.toFixed(1)}</span>
      </p>
    </div>
  );
};

export default function PortfolioAnalytics({ scoredDeals }) {
  const { barData, confusionMatrix } = useMemo(() => {
    const groups = {};
    Object.keys(OUTCOME_COLORS).forEach((key) => {
      groups[key] = [];
    });

    (scoredDeals || []).forEach((deal) => {
      const status = deal.outcome?.status;
      if (status && groups[status]) {
        groups[status].push(deal.rs?.composite ?? 0);
      }
    });

    const barData = Object.entries(groups)
      .filter(([, scores]) => scores.length > 0)
      .map(([status, scores]) => ({
        status,
        avgScore: scores.reduce((a, b) => a + b, 0) / scores.length,
        count: scores.length,
        color: OUTCOME_COLORS[status],
      }));

    let tp = 0, tn = 0, fp = 0, fn = 0;
    (scoredDeals || []).forEach((deal) => {
      const score = deal.rs?.composite ?? 0;
      const status = deal.outcome?.status;
      const highScore = score >= THRESHOLD;
      const good = status === 'Performing' || status === 'Paid Off';

      if (highScore && good) tp++;
      else if (!highScore && !good) tn++;
      else if (highScore && !good) fp++;
      else if (!highScore && good) fn++;
    });

    return { barData, confusionMatrix: { tp, tn, fp, fn } };
  }, [scoredDeals]);

  if (!scoredDeals || scoredDeals.length === 0) return null;

  const { tp, tn, fp, fn } = confusionMatrix;
  const total = tp + tn + fp + fn;

  return (
    <div className="space-y-6">
      {/* Average Score by Outcome */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Average Score by Outcome
        </h3>
        <div style={{ width: '100%', height: 220 }}>
          <ResponsiveContainer>
            <BarChart data={barData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.06)" />
              <XAxis
                dataKey="status"
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: '#64748b', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.06)' }} />
              <Bar dataKey="avgScore" radius={[6, 6, 0, 0]} maxBarSize={48}>
                {barData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Score Distribution */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Score Distribution
        </h3>
        <div className="bg-white/[0.02] rounded-xl p-4">
          {/* Scale labels */}
          <div className="flex justify-between text-[10px] text-slate-500 mb-1">
            <span>0</span>
            <span>25</span>
            <span>50</span>
            <span>75</span>
            <span>100</span>
          </div>
          {/* Track */}
          <div className="relative h-8 rounded-full bg-white/[0.02] border border-slate-700/30">
            {/* Threshold line */}
            <div
              className="absolute top-0 bottom-0 w-px bg-slate-500/40"
              style={{ left: `${THRESHOLD}%` }}
            />
            {/* Dots */}
            {(scoredDeals || []).map((deal, i) => {
              const score = Math.min(100, Math.max(0, deal.rs?.composite ?? 0));
              const color = OUTCOME_COLORS[deal.outcome?.status] || '#64748b';
              return (
                <div
                  key={i}
                  className="absolute top-1/2 -translate-y-1/2 rounded-full"
                  style={{
                    left: `${score}%`,
                    width: 8,
                    height: 8,
                    backgroundColor: color,
                    opacity: 0.85,
                    transform: 'translate(-50%, -50%)',
                    top: '50%',
                  }}
                  title={`${deal.inputs?.companyName || 'Deal'}: ${score.toFixed(1)}`}
                />
              );
            })}
          </div>
          {/* Threshold label */}
          <div className="mt-1 text-[10px] text-slate-500" style={{ marginLeft: `${THRESHOLD}%`, transform: 'translateX(-50%)' }}>
            Threshold ({THRESHOLD})
          </div>
        </div>
      </div>

      {/* Confusion Matrix */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4">
          Model Accuracy Matrix
        </h3>
        <div className="bg-white/[0.02] rounded-xl overflow-hidden">
          <table className="w-full text-xs text-center">
            <thead>
              <tr>
                <th className="p-3 text-slate-500 font-medium" />
                <th className="p-3 text-slate-400 font-semibold">Performed / Paid Off</th>
                <th className="p-3 text-slate-400 font-semibold">Defaulted / Watchlist</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="p-3 text-slate-400 font-semibold text-right">Score &ge; {THRESHOLD}</td>
                <td className="p-3">
                  <span className="inline-block bg-emerald-500/10 text-emerald-400 rounded-lg px-3 py-1.5 font-bold">
                    {tp}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">True Positive</div>
                </td>
                <td className="p-3">
                  <span className="inline-block bg-rose-500/10 text-rose-400 rounded-lg px-3 py-1.5 font-bold">
                    {fp}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">False Positive / Missed Risk</div>
                </td>
              </tr>
              <tr>
                <td className="p-3 text-slate-400 font-semibold text-right">Score &lt; {THRESHOLD}</td>
                <td className="p-3">
                  <span className="inline-block bg-amber-500/10 text-amber-400 rounded-lg px-3 py-1.5 font-bold">
                    {fn}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">False Negative / Over-Conservative</div>
                </td>
                <td className="p-3">
                  <span className="inline-block bg-gold-500/10 text-gold-400 rounded-lg px-3 py-1.5 font-bold">
                    {tn}
                  </span>
                  <div className="text-[10px] text-slate-500 mt-1">True Negative</div>
                </td>
              </tr>
            </tbody>
          </table>
          {total > 0 && (
            <div className="border-t border-slate-700/30 px-3 py-2 text-[10px] text-slate-500 text-right">
              Accuracy: {(((tp + tn) / total) * 100).toFixed(1)}% ({tp + tn}/{total})
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
