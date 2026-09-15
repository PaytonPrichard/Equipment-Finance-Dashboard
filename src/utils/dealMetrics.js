import { calculateMonthlyPayment } from './format';

// One definition of a deal's metrics, used by every surface that shows them.
//
// This logic used to live inline in App.js, which meant the pipeline drawer
// computed its own metrics from `calculateMetrics(inputs)` with no rate and no
// org override. The drawer therefore priced every deal at DEFAULT_SOFR and
// ignored the firm's spreads, so the same deal showed one DSCR on the
// screening view and a different one in the drawer.

/**
 * Re-price metrics when an organization overrides its spreads in Settings.
 *
 * Debt service has to be recomputed the same way the module computes it, or
 * the override silently changes the definition of DSCR. A term facility
 * amortizes (monthly payment * 12); a revolver does not, so borrowing base
 * times rate is the right shape there. Getting this wrong inflated DSCR 22%
 * for any firm with a custom spread, on the highest-weighted factor and the
 * primary pass/fail gate.
 */
export function applyOrgSpread(baseMetrics, inputs, orgSettings) {
  const s = orgSettings || {};
  const hasOverride =
    s.baseSpreadBps !== undefined ||
    s.creditSpreadStrong !== undefined ||
    s.creditSpreadWeak !== undefined;
  if (!hasOverride || !baseMetrics) return baseMetrics;

  const orgSpreadAdj =
    (s.baseSpreadBps !== undefined ? s.baseSpreadBps - (baseMetrics.rateInfo?.baseSpread || 200) : 0) +
    (inputs?.creditRating === 'Strong' && s.creditSpreadStrong !== undefined
      ? s.creditSpreadStrong - (baseMetrics.rateInfo?.creditAdj || -75)
      : 0) +
    (inputs?.creditRating === 'Weak' && s.creditSpreadWeak !== undefined
      ? s.creditSpreadWeak - (baseMetrics.rateInfo?.creditAdj || 200)
      : 0);

  if (orgSpreadAdj === 0) return baseMetrics;

  const adjRate = (baseMetrics.rate || baseMetrics.effectiveRate || 0) + orgSpreadAdj / 10000;
  const adjNewDS = baseMetrics.netFinanced
    ? calculateMonthlyPayment(baseMetrics.netFinanced, adjRate, inputs?.loanTerm) * 12
    : baseMetrics.borrowingBase
      ? baseMetrics.borrowingBase * adjRate
      : baseMetrics.newAnnualDebtService;
  const totalDS = baseMetrics.existingDebtService + (adjNewDS || baseMetrics.newAnnualDebtService);
  const adjDscr = inputs?.ebitda && totalDS > 0 ? inputs.ebitda / totalDS : baseMetrics.dscr;

  return {
    ...baseMetrics,
    rate: adjRate,
    effectiveRate: adjRate,
    newAnnualDebtService: adjNewDS || baseMetrics.newAnnualDebtService,
    dscr: adjDscr,
  };
}

/**
 * The metrics for a deal, at the live rate and under the firm's spreads.
 * Every surface that displays a deal should go through this.
 */
export function computeDealMetrics(mod, inputs, sofr, orgSettings) {
  return applyOrgSpread(mod.calculateMetrics(inputs, sofr), inputs, orgSettings);
}
