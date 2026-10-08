// ============================================================
// One recommendation per deal, led by the verdict.
//
// Each module's getRecommendation maps the composite score alone to a
// category. On its own that contradicts the verdict whenever a gate fires:
// a deal scoring 80 that breaks its cash-flow floor showed FLAG and, below
// it, "Strong Prospect. Recommend advancing to underwriting." AUDIT P0-8.
//
// The verdict comes first. A FLAG advances only with conditions, and the
// conditions are the verdict's own reasons, word for word, so nobody has to
// guess what must be resolved. A FAIL does not meet policy. Only a PASS
// takes the score category.
//
// Returns semantic fields. Presentation maps `tone` to classes in the
// component layer (src/components/recommendationStyle.js).
// ============================================================

import type { Recommendation, ScreeningResult, Verdict } from '../types';

export type RecommendationTone = 'pass' | 'flag' | 'fail' | 'score';

export interface GatedRecommendation extends Recommendation {
  verdict: Verdict | null;
  tone: RecommendationTone;
  /** FLAG reasons. Each must be resolved, or accepted by credit, before the deal advances. */
  conditions: string[];
  /** FAIL reasons. */
  failures: string[];
  /** The score-only category, kept for the gauge and for reference. */
  scoreCategory: string;
}

export function recommendationFor(
  scoreRec: Recommendation,
  screening: Pick<ScreeningResult, 'verdict' | 'reasons'> | null | undefined,
): GatedRecommendation {
  const reasons = screening?.reasons || [];
  const failures = reasons.filter((r) => r.level === 'fail').map((r) => r.text);
  const conditions = reasons.filter((r) => r.level === 'flag').map((r) => r.text);
  const base = { scoreCategory: scoreRec.category, failures, conditions };

  if (!screening?.verdict) {
    // No verdict to lead with, e.g. a deal whose inputs cannot be evaluated.
    return { ...scoreRec, ...base, verdict: null, tone: 'score' };
  }

  if (screening.verdict === 'fail') {
    return {
      ...base,
      verdict: 'fail',
      tone: 'fail',
      category: 'Does Not Meet Policy',
      detail: 'Restructure or decline. The failed criteria are listed below.',
    };
  }

  if (screening.verdict === 'flag') {
    const n = conditions.length;
    return {
      ...base,
      verdict: 'flag',
      tone: 'flag',
      category: 'Advance with Conditions',
      detail: `Advance only once ${n === 1 ? 'the condition below is' : `all ${n} conditions below are`} resolved or accepted by credit.`,
    };
  }

  return { ...scoreRec, ...base, verdict: 'pass', tone: 'pass' };
}
