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
    <div className="bg-white border border-gray-200 rounded-xl px-3 py-2.5 shadow-lg">
      <p className="text-xs font-semibold text-gray-800">{data.label}</p>
      <p className="text-xs text-gray-500 mt-0.5">
        Score: <span className="text-gray-900 font-mono font-medium">{data.score}</span>/100
      </p>
      <p className="text-[10px] text-gray-400">Weight: {data.weight}</p>
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
        <PolarGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
        <PolarAngleAxis
          dataKey="factor"
          tick={{ fill: '#374151', fontSize: 10, fontWeight: 500 }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 100]}
          tick={{ fill: '#6b7280', fontSize: 9 }}
          axisLine={false}
          tickCount={5}
        />
        <Radar
          name="Score"
          dataKey="score"
          stroke="#1f2937"
          fill="#1f2937"
          fillOpacity={0.08}
          strokeWidth={2}
          dot={{ r: 3, fill: '#1f2937', strokeWidth: 0 }}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
