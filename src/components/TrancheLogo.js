import React from 'react';

const GOLD = '#D4A843';
const CHARCOAL = '#141210';

export default function TrancheLogo({
  size = 28,
  framed = true,
  barColor = GOLD,
  frameColor = CHARCOAL,
  className = '',
  title = 'Tranche',
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={title}
      className={className}
    >
      {framed && <rect x="0" y="0" width="100" height="100" rx="22" fill={frameColor} />}
      <rect x="33" y="29.75" width="34" height="8.5" rx="4.25" fill={barColor} />
      <rect x="22.5" y="45.75" width="55" height="8.5" rx="4.25" fill={barColor} />
      <rect x="11" y="61.75" width="78" height="8.5" rx="4.25" fill={barColor} />
    </svg>
  );
}
