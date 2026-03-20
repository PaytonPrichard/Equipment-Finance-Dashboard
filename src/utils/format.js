// ============================================================
// Shared formatting utilities — used by all asset class modules
// ============================================================

export function formatCurrency(value) {
  if (!value && value !== 0) return '$0';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

export function formatCurrencyFull(value) {
  if (!value && value !== 0) return '$0';
  return '$' + Math.round(value).toLocaleString();
}

export function formatPercent(value, decimals = 1) {
  return value.toFixed(decimals) + '%';
}

export function formatRatio(value) {
  return value.toFixed(2) + 'x';
}

/**
 * Linear interpolation between breakpoints.
 * breakpoints: [[inputValue, score], ...] sorted ascending by inputValue.
 */
export function lerp(value, breakpoints) {
  if (value <= breakpoints[0][0]) return breakpoints[0][1];
  const last = breakpoints[breakpoints.length - 1];
  if (value >= last[0]) return last[1];
  for (let i = 0; i < breakpoints.length - 1; i++) {
    const [v1, s1] = breakpoints[i];
    const [v2, s2] = breakpoints[i + 1];
    if (value >= v1 && value <= v2) {
      const t = (value - v1) / (v2 - v1);
      return Math.round(s1 + t * (s2 - s1));
    }
  }
  return breakpoints[0][1];
}

/**
 * Standard amortization monthly payment.
 */
export function calculateMonthlyPayment(principal, annualRate, termMonths) {
  if (!principal || !termMonths || termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (
    (principal * (r * Math.pow(1 + r, termMonths))) /
    (Math.pow(1 + r, termMonths) - 1)
  );
}

/**
 * Generate year-by-year amortization schedule.
 */
export function generateAmortizationSchedule(principal, annualRate, termMonths) {
  if (!principal || !termMonths || termMonths <= 0) return [];
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;

  let balance = principal;
  const years = [];
  let yearInterest = 0;
  let yearPrincipal = 0;

  for (let month = 1; month <= termMonths; month++) {
    const interestPmt = balance * r;
    const principalPmt = monthlyPayment - interestPmt;
    yearInterest += interestPmt;
    yearPrincipal += principalPmt;
    balance = Math.max(balance - principalPmt, 0);

    if (month % 12 === 0 || month === termMonths) {
      years.push({
        year: Math.ceil(month / 12),
        principal: Math.round(yearPrincipal),
        interest: Math.round(yearInterest),
        totalPayment: Math.round(yearPrincipal + yearInterest),
        endingBalance: Math.round(balance),
      });
      yearInterest = 0;
      yearPrincipal = 0;
    }
  }

  const totalInterest = years.reduce((sum, y) => sum + y.interest, 0);
  const totalPrincipal = years.reduce((sum, y) => sum + y.principal, 0);
  return { years, totalInterest, totalPrincipal, totalCost: totalInterest + totalPrincipal };
}
