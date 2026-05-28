// ============================================================
// Shared formatting utilities — used by all asset class modules.
//
// Phase 1 of the TypeScript migration. See AUDIT.md.
// Behavior unchanged from format.js; types added.
// ============================================================

/** Currency, abbreviated (K/M/B). For tight spaces. */
export function formatCurrency(value: number | null | undefined): string {
  if (!value && value !== 0) return '$0';
  if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

/** Currency, full digits. For committee PDFs. */
export function formatCurrencyFull(value: number | null | undefined): string {
  if (!value && value !== 0) return '$0';
  return '$' + Math.round(value).toLocaleString();
}

export function formatPercent(value: number, decimals: number = 1): string {
  return value.toFixed(decimals) + '%';
}

export function formatRatio(value: number): string {
  return value.toFixed(2) + 'x';
}

/**
 * Display label for an org plan key. The DB stores keys like `free_trial`;
 * this maps them to proper-cased names. There is no standalone free tier, so
 * `free` (legacy webhook value) and the unset default both read "Free Trial".
 * `pro` is the legacy key the webhook still writes for the Team tier — see
 * AUDIT.md P0-6. Unknown keys fall back to title-cased text.
 */
const PLAN_LABELS: Record<string, string> = {
  free_trial: 'Free Trial',
  free: 'Free Trial',
  analyst: 'Analyst',
  team: 'Team',
  pro: 'Team',
  enterprise: 'Enterprise',
};

export function formatPlanName(plan: string | null | undefined): string {
  if (!plan) return 'Free Trial';
  return (
    PLAN_LABELS[plan] ||
    plan.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

/** A single breakpoint: [inputValue, score]. */
export type Breakpoint = readonly [number, number];

/**
 * Linear interpolation between breakpoints.
 * Breakpoints must be sorted ascending by inputValue.
 * Values outside the range are clamped to the nearest breakpoint's score.
 */
export function lerp(value: number, breakpoints: readonly Breakpoint[]): number {
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

/** Standard amortization monthly payment. */
export function calculateMonthlyPayment(
  principal: number,
  annualRate: number,
  termMonths: number,
): number {
  if (!principal || !termMonths || termMonths <= 0) return 0;
  const r = annualRate / 12;
  if (r === 0) return principal / termMonths;
  return (
    (principal * (r * Math.pow(1 + r, termMonths))) /
    (Math.pow(1 + r, termMonths) - 1)
  );
}

export interface AmortizationYear {
  year: number;
  principal: number;
  interest: number;
  totalPayment: number;
  endingBalance: number;
}

export interface AmortizationSchedule {
  years: AmortizationYear[];
  totalInterest: number;
  totalPrincipal: number;
  totalCost: number;
}

/**
 * Generate year-by-year amortization schedule.
 * Returns an empty array (not a schedule object) for invalid inputs — preserving
 * the original JS behavior. Callers should check `Array.isArray(result)` or use
 * `'years' in result`.
 */
export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  termMonths: number,
): AmortizationSchedule | [] {
  if (!principal || !termMonths || termMonths <= 0) return [];
  const monthlyPayment = calculateMonthlyPayment(principal, annualRate, termMonths);
  const r = annualRate / 12;

  let balance = principal;
  const years: AmortizationYear[] = [];
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
