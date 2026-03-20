import React, { useState, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  ReferenceArea,
} from 'recharts';
import {
  calculateMetrics,
  calculateRiskScore,
  DEFAULT_SOFR,
  formatCurrency,
} from '../utils/calculations';

const VARIABLES = [
  { key: 'ebitda', label: 'EBITDA', inputField: 'ebitda' },
  { key: 'equipmentCost', label: 'Equipment Cost', inputField: 'equipmentCost' },
  { key: 'downPayment', label: 'Down Payment', inputField: 'downPayment' },
  { key: 'loanTerm', label: 'Loan Term', inputField: 'loanTerm' },
];

// Percentage-based steps: -50% to +50% in 10% increments (11 data points)
const PCT_STEPS = [-50, -40, -30, -20, -10, 0, 10, 20, 30, 40, 50];

// Loan term: -24 to +24 months in 6-month steps (9 data points)
const TERM_STEPS = [-24, -18, -12, -6, 0, 6, 12, 18, 24];

function computeScore(inputs, sofr, overrideField, overrideValue) {
  const adjusted = { ...inputs, [overrideField]: overrideValue };
  const metrics = calculateMetrics(adjusted, sofr);
  const { composite } = calculateRiskScore(adjusted, metrics);
  return composite;
}

function buildDataPoints(inputs, sofr, variable) {
  const baseValue = inputs[variable.inputField] || 0;

  if (variable.key === 'loanTerm') {
    return TERM_STEPS.map((delta) => {
      const adjusted = Math.max(baseValue + delta, 6); // minimum 6 months
      const score = computeScore(inputs, sofr, variable.inputField, adjusted);
      return {
        label: delta === 0 ? 'Base' : `${delta > 0 ? '+' : ''}${delta}mo`,
        adjustment: delta,
        adjustedValue: adjusted,
        score,
        isBase: delta === 0,
      };
    });
  }

  return PCT_STEPS.map((pct) => {
    const multiplier = 1 + pct / 100;
    const adjusted = Math.max(baseValue * multiplier, 0);
    const score = computeScore(inputs, sofr, variable.inputField, adjusted);
    return {
      label: pct === 0 ? 'Base' : `${pct > 0 ? '+' : ''}${pct}%`,
      adjustment: pct,
      adjustedValue: adjusted,
      score,
      isBase: pct === 0,
    };
  });
}

function getScoreColor(score) {
  if (score >= 75) return '#10b981'; // emerald
  if (score >= 35) return '#f59e0b'; // amber
  return '#f43f5e'; // rose
}

function formatAdjustedValue(variable, value) {
  if (variable.key === 'loanTerm') {
    return `${Math.round(value)} months`;
  }
  return formatCurrency(value);
}

function CustomTooltip({ active, payload, variable }) {
  if (!active || !payload || !payload.length) return null;
  const data = payload[0].payload;
  const scoreColor = getScoreColor(data.score);
  return (
    <div className="bg-slate-800 border border-slate-700/50 rounded-xl px-3 py-2.5 shadow-2xl">
      <p className="text-xs font-semibold text-slate-200">
        {variable.label}: {formatAdjustedValue(variable, data.adjustedValue)}
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        Adjustment: <span className="text-gold-400 font-mono font-medium">{data.label}</span>
      </p>
      <p className="text-xs text-slate-400 mt-0.5">
        Risk Score:{' '}
        <span className="font-mono font-semibold" style={{ color: scoreColor }}>
          {data.score}
        </span>
        /100
      </p>
    </div>
  );
}

function findMostSensitive(inputs, sofr) {
  let maxDrop = 0;
  let result = null;

  VARIABLES.forEach((variable) => {
    const baseValue = inputs[variable.inputField] || 0;
    if (baseValue <= 0 && variable.key !== 'loanTerm') return;

    const baseScore = computeScore(inputs, sofr, variable.inputField, baseValue);

    let stressedValue;
    if (variable.key === 'loanTerm') {
      // For loan term, test +12 months as the "stress" direction
      stressedValue = baseValue + 12;
    } else if (variable.key === 'downPayment') {
      // For down payment, a 30% decrease is the stress direction
      stressedValue = baseValue * 0.7;
    } else if (variable.key === 'equipmentCost') {
      // For equipment cost, a 30% increase is the stress direction
      stressedValue = baseValue * 1.3;
    } else {
      // For EBITDA, a 30% decrease is the stress direction
      stressedValue = baseValue * 0.7;
    }

    const stressedScore = computeScore(inputs, sofr, variable.inputField, stressedValue);
    const drop = baseScore - stressedScore;

    if (drop > maxDrop) {
      maxDrop = drop;
      result = {
        variable,
        baseScore,
        stressedScore,
        drop,
      };
    }
  });

  return result;
}

export default function SensitivityChart({ inputs, sofr = DEFAULT_SOFR }) {
  const [selectedVar, setSelectedVar] = useState('ebitda');

  const variable = VARIABLES.find((v) => v.key === selectedVar);

  const data = useMemo(
    () => buildDataPoints(inputs, sofr, variable),
    [inputs, sofr, variable]
  );

  const basePoint = data.find((d) => d.isBase);
  const baseScore = basePoint ? basePoint.score : 0;

  const sensitivity = useMemo(
    () => findMostSensitive(inputs, sofr),
    [inputs, sofr]
  );

  return (
    <div className="glass-card rounded-2xl p-6">
      {/* Header */}
      <div className="mb-5">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">
          Risk Score Sensitivity
        </h3>
        <p className="text-[11px] text-slate-500">
          How the risk score changes as a key variable is adjusted
        </p>
      </div>

      {/* Variable Toggle */}
      <div className="flex flex-wrap gap-1.5 mb-5">
        {VARIABLES.map((v) => (
          <button
            key={v.key}
            onClick={() => setSelectedVar(v.key)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-all ${
              selectedVar === v.key
                ? 'bg-gold-500/20 text-gold-400 border border-gold-500/30'
                : 'bg-white/[0.03] text-slate-500 border border-transparent hover:bg-white/[0.05] hover:text-slate-400'
            }`}
          >
            {v.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id="scoreLineGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#d4a843" stopOpacity={0.8} />
              <stop offset="100%" stopColor="#d4a843" stopOpacity={0.2} />
            </linearGradient>
          </defs>

          <CartesianGrid stroke="rgba(148,163,184,0.06)" strokeDasharray="3 3" />

          {/* Colored zone backgrounds */}
          <ReferenceArea y1={75} y2={100} fill="#10b981" fillOpacity={0.04} />
          <ReferenceArea y1={35} y2={75} fill="#f59e0b" fillOpacity={0.04} />
          <ReferenceArea y1={0} y2={35} fill="#f43f5e" fillOpacity={0.04} />

          {/* Zone boundary lines */}
          <ReferenceLine
            y={75}
            stroke="#10b981"
            strokeDasharray="4 4"
            strokeOpacity={0.3}
            label={{
              value: '75 — Strong',
              position: 'right',
              fill: '#10b981',
              fontSize: 9,
              opacity: 0.6,
            }}
          />
          <ReferenceLine
            y={35}
            stroke="#f43f5e"
            strokeDasharray="4 4"
            strokeOpacity={0.3}
            label={{
              value: '35 — Weak',
              position: 'right',
              fill: '#f43f5e',
              fontSize: 9,
              opacity: 0.6,
            }}
          />

          {/* Base case reference line */}
          <ReferenceLine
            y={baseScore}
            stroke="#d4a843"
            strokeDasharray="6 3"
            strokeOpacity={0.5}
            label={{
              value: `Base: ${baseScore}`,
              position: 'left',
              fill: '#d4a843',
              fontSize: 10,
              fontWeight: 600,
            }}
          />

          <XAxis
            dataKey="label"
            tick={{ fill: '#94a3b8', fontSize: 10, fontWeight: 500 }}
            axisLine={{ stroke: 'rgba(148,163,184,0.1)' }}
            tickLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fill: '#475569', fontSize: 9 }}
            axisLine={false}
            tickLine={false}
            tickCount={6}
            width={35}
          />

          <Tooltip
            content={<CustomTooltip variable={variable} />}
            cursor={{ stroke: 'rgba(148,163,184,0.15)', strokeWidth: 1 }}
          />

          <Line
            type="monotone"
            dataKey="score"
            stroke="#d4a843"
            strokeWidth={2.5}
            dot={(props) => {
              const { cx, cy, payload } = props;
              const color = payload.isBase ? '#d4a843' : getScoreColor(payload.score);
              const r = payload.isBase ? 5 : 3;
              return (
                <circle
                  key={`dot-${payload.label}`}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill={color}
                  stroke={payload.isBase ? '#5c4a1a' : 'none'}
                  strokeWidth={payload.isBase ? 2 : 0}
                />
              );
            }}
            activeDot={{
              r: 5,
              fill: '#d4a843',
              stroke: '#5c4a1a',
              strokeWidth: 2,
            }}
          />
        </LineChart>
      </ResponsiveContainer>

      {/* Sensitivity Summary */}
      {sensitivity && (
        <div className="mt-4 px-3 py-2.5 rounded-lg bg-white/[0.02]">
          <p className="text-[11px] text-slate-400">
            <span className="text-slate-300 font-medium">
              Most sensitive to {sensitivity.variable.label}:
            </span>{' '}
            score drops from{' '}
            <span className="font-mono font-semibold text-gold-400">
              {sensitivity.baseScore}
            </span>{' '}
            to{' '}
            <span
              className="font-mono font-semibold"
              style={{ color: getScoreColor(sensitivity.stressedScore) }}
            >
              {sensitivity.stressedScore}
            </span>{' '}
            with a{' '}
            {sensitivity.variable.key === 'loanTerm'
              ? '+12 month increase'
              : sensitivity.variable.key === 'equipmentCost'
              ? '30% increase'
              : '30% decline'}
          </p>
        </div>
      )}
    </div>
  );
}
