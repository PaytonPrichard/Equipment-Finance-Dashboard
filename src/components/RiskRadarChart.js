import React from 'react';
import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

const FACTOR_LABELS = {
  dscr: 'DSCR',
  leverage: 'Leverage',
  industry: 'Industry',
  essentiality: 'Essentiality',
  equipmentLtv: 'Equip/LTV',
  yearsInBusiness: 'Experience',
  termCoverage: 'Term Cov.',
};

const FACTOR_WEIGHTS = {
  dscr: '25%',
  leverage: '20%',
  industry: '15%',
  essentiality: '10%',
  equipmentLtv: '10%',
  yearsInBusiness: '10%',
  termCoverage: '10%',
};

function CustomTooltip({ active, payload }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 shadow-2xl">
      <p className="text-xs font-semibold text-slate-200">{data.label}</p>
      <p className="text-xs text-slate-400 mt-0.5">
        Score: <span className="text-blue-400 font-mono font-medium">{data.score}</span>/100
      </p>
      <p className="text-[10px] text-slate-500">Weight: {data.weight}</p>
    </div>
  );
}

export default function RiskRadarChart({ factors }) {
  const data = Object.entries(FACTOR_LABELS).map(([key, label]) => ({
    factor: label,
    label,
    score: factors[key] || 0,
    weight: FACTOR_WEIGHTS[key],
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={260}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="72%">
        <PolarGrid stroke="rgba(148,163,184,0.08)" strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="factor"
          tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#475569', fontSize: 9 }}
          axisLine={false}
          tickCount={5}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#3b82f6"
          fill="#3b82f6"
          fillOpacity={0.1}
          strokeWidth={2}
          dot={{ r: 3, fill: '#3b82f6', strokeWidth: 0 }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
