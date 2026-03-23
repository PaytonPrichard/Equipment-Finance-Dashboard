import React from 'react';

const CIRCUMFERENCE = 2 * Math.PI * 80;
const ARC_LENGTH = CIRCUMFERENCE * 0.75;

function getScoreColor(score) {
  if (score >= 75) return '#10b981';
  if (score >= 55) return '#84cc16';
  if (score >= 35) return '#f59e0b';
  return '#ef4444';
}

function getScoreLabel(score) {
  if (score >= 75) return 'Strong';
  if (score >= 55) return 'Moderate';
  if (score >= 35) return 'Borderline';
  return 'Weak';
}

export default function RiskScoreGauge({ score }) {
  const fillLength = ARC_LENGTH * (score / 100);
  const color = getScoreColor(score);
  const needleAngleDeg = 135 + (score / 100) * 270;
  const needleAngleRad = (needleAngleDeg * Math.PI) / 180;
  const needleLength = 58;
  const needleX = 100 + needleLength * Math.cos(needleAngleRad);
  const needleY = 100 + needleLength * Math.sin(needleAngleRad);

  return (
    <div className="flex flex-col items-center">
      <svg viewBox="0 0 200 155" className="w-full max-w-[260px]">
        {/* Background arc */}
        <circle
          cx="100" cy="100" r="80" fill="none"
          stroke="rgba(148,163,184,0.15)" strokeWidth="16"
          strokeDasharray={`${ARC_LENGTH} ${CIRCUMFERENCE}`}
          transform="rotate(135, 100, 100)"
          strokeLinecap="round"
        />
        {/* Segment colors (subtle) */}
        {[
          { start: 0, end: 35, color: 'rgba(239,68,68,0.08)' },
          { start: 35, end: 55, color: 'rgba(245,158,11,0.08)' },
          { start: 55, end: 75, color: 'rgba(132,204,22,0.08)' },
          { start: 75, end: 100, color: 'rgba(16,185,129,0.08)' },
        ].map((seg, i) => {
          const segLength = ARC_LENGTH * ((seg.end - seg.start) / 100);
          const offset = ARC_LENGTH - ARC_LENGTH * (seg.start / 100);
          return (
            <circle
              key={i} cx="100" cy="100" r="80" fill="none"
              stroke={seg.color} strokeWidth="16"
              strokeDasharray={`${segLength} ${CIRCUMFERENCE}`}
              strokeDashoffset={-ARC_LENGTH + offset}
              transform="rotate(135, 100, 100)"
            />
          );
        })}
        {/* Tick marks */}
        {[0, 25, 50, 75, 100].map((tick) => {
          const angle = 135 + (tick / 100) * 270;
          const rad = (angle * Math.PI) / 180;
          return (
            <line
              key={tick}
              x1={100 + 70 * Math.cos(rad)} y1={100 + 70 * Math.sin(rad)}
              x2={100 + 92 * Math.cos(rad)} y2={100 + 92 * Math.sin(rad)}
              stroke="rgba(148,163,184,0.15)" strokeWidth="1.5" strokeLinecap="round"
            />
          );
        })}
        {/* Active fill */}
        <circle
          cx="100" cy="100" r="80" fill="none"
          stroke={color} strokeWidth="16"
          strokeDasharray={`${fillLength} ${CIRCUMFERENCE}`}
          transform="rotate(135, 100, 100)"
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.16,1,0.3,1), stroke 0.4s ease' }}
        />
        {/* Needle */}
        <line
          x1="100" y1="100" x2={needleX} y2={needleY}
          stroke={color} strokeWidth="2" strokeLinecap="round"
          style={{ transition: 'all 0.8s cubic-bezier(0.16,1,0.3,1)' }}
        />
        <circle cx="100" cy="100" r="5" fill={color} style={{ transition: 'fill 0.4s ease' }} />
        <circle cx="100" cy="100" r="2" fill="#ffffff" />
        {/* Score text */}
        <text
          x="100" y="138" textAnchor="middle"
          style={{ fontSize: '34px', fontWeight: 800, fontFamily: 'Inter, sans-serif', fill: '#111827' }}
        >
          {score}
        </text>
        <text
          x="100" y="152" textAnchor="middle"
          style={{ fontSize: '10px', fontWeight: 600, fontFamily: 'Inter, sans-serif', fill: '#374151', letterSpacing: '0.15em' }}
        >
          {getScoreLabel(score).toUpperCase()}
        </text>
      </svg>
    </div>
  );
}
