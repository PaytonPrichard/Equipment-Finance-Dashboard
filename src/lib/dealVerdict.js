import { getModule } from '../modules';
import { evaluateScreening, DEFAULT_CRITERIA } from './screeningCriteria';
import { computeDealMetrics } from '../utils/dealMetrics';

// One verdict for a deal, wherever it is shown.
//
// There used to be three. The screening view ran evaluateScreening, which
// honours the firm's thresholds and the hard DSCR, LTV, leverage and
// concentration gates. The pipeline card and the detail drawer each ran their
// own score-only helper against hardcoded 75/35 breakpoints, ignoring both the
// firm's policy and every gate. A deal scoring 82 that breached the LTV
// ceiling read PASS on the board and PASS in the drawer, in the drawer's case
// printed directly above its own failure reasons.
//
// Returns a semantic category, never Tailwind classes. Presentation maps the
// category in the component layer (CLAUDE.md).

/** @typedef {'pass'|'flag'|'fail'|'none'} VerdictCategory */

/**
 * Score-only fallback, for a deal whose inputs cannot be evaluated.
 *
 * This is the old behaviour, kept only for deals saved with partial inputs
 * where metrics cannot be computed at all. It is not the normal path, and a
 * caller can tell the difference: `gated` is false.
 */
function categoryFromScore(score) {
  if (score == null) return 'none';
  if (score >= 75) return 'pass';
  if (score >= 35) return 'flag';
  return 'fail';
}

/**
 * The verdict for a stored pipeline deal.
 *
 * @param {object} deal          A pipeline_deals row: inputs, score, asset_class.
 * @param {object} opts
 * @param {object} [opts.criteria]     The firm's thresholds. Falls back to defaults.
 * @param {number} [opts.sofr]         Live rate. Omit and the module default applies.
 * @param {object} [opts.orgSettings]  Spread overrides.
 * @returns {{ category: VerdictCategory, label: string|null, reasons: {level: string, text: string}[], gated: boolean, metrics: object|null, riskScore: object|null }}
 */
export function verdictForDeal(deal, { criteria, sofr, orgSettings } = {}) {
  const score = deal?.score != null ? Math.round(deal.score) : null;
  const moduleKey = deal?.asset_class || 'equipment_finance';

  let metrics = null;
  let riskScore = null;
  let screening = null;
  try {
    const mod = getModule(moduleKey);
    metrics = computeDealMetrics(mod, deal?.inputs || {}, sofr, orgSettings);
    riskScore = mod.calculateRiskScore(deal?.inputs || {}, metrics);
    screening = evaluateScreening(
      criteria || DEFAULT_CRITERIA,
      metrics,
      riskScore,
      deal?.inputs || {},
      moduleKey,
    );
  } catch {
    // A deal saved with partial inputs still has to render.
  }

  if (screening?.verdict) {
    const category = String(screening.verdict).toLowerCase();
    return {
      category,
      label: category.toUpperCase(),
      reasons: screening.reasons || [],
      gated: true,
      metrics,
      riskScore,
    };
  }

  const category = categoryFromScore(score);
  return {
    category,
    label: category === 'none' ? null : category.toUpperCase(),
    reasons: [],
    gated: false,
    metrics,
    riskScore,
  };
}
