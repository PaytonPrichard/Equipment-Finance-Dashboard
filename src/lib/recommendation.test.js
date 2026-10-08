import { recommendationFor } from './recommendation';
import { getRecommendation } from '../modules/equipment-finance/scoring';

// AUDIT P0-8: a deal scoring 80 that breaks a gate used to read
// "Strong Prospect. Recommend advancing to underwriting" under a FLAG.
const strong = getRecommendation(80);

test('PASS keeps the score category', () => {
  const r = recommendationFor(strong, { verdict: 'pass', reasons: [] });
  expect(r.category).toBe('Strong Prospect');
  expect(r.detail).toBe('Recommend advancing to underwriting');
  expect(r.tone).toBe('pass');
});

test('FLAG on a strong score advances only with conditions, listed word for word', () => {
  const reasons = [
    { level: 'flag', text: 'LTV 104% exceeds maximum (100%)' },
    { level: 'flag', text: 'Breaks under stress: FCCR 0.71x in the combined severe case (revenue -20% and margin -200 bps)' },
  ];
  const r = recommendationFor(strong, { verdict: 'flag', reasons });
  expect(r.category).toBe('Advance with Conditions');
  expect(r.detail).toBe('Advance only once all 2 conditions below are resolved or accepted by credit.');
  expect(r.conditions).toEqual(reasons.map((x) => x.text));
  expect(r.failures).toEqual([]);
  expect(r.scoreCategory).toBe('Strong Prospect');
  expect(r.category).not.toMatch(/Strong/);
});

test('one condition reads in the singular', () => {
  const r = recommendationFor(strong, { verdict: 'flag', reasons: [{ level: 'flag', text: 'x' }] });
  expect(r.detail).toBe('Advance only once the condition below is resolved or accepted by credit.');
});

test('FAIL does not meet policy and separates failures from flags', () => {
  const r = recommendationFor(strong, {
    verdict: 'fail',
    reasons: [
      { level: 'fail', text: 'DSCR 0.92x is below 1.0x, insufficient to service debt' },
      { level: 'flag', text: 'LTV 104% exceeds maximum (100%)' },
    ],
  });
  expect(r.category).toBe('Does Not Meet Policy');
  expect(r.failures).toEqual(['DSCR 0.92x is below 1.0x, insufficient to service debt']);
  expect(r.conditions).toEqual(['LTV 104% exceeds maximum (100%)']);
});

test('carries no Tailwind classes for a gated verdict', () => {
  const r = recommendationFor(strong, { verdict: 'flag', reasons: [] });
  expect(r.bgClass).toBeUndefined();
  expect(r.textClass).toBeUndefined();
});

test('no verdict falls back to the score recommendation', () => {
  const r = recommendationFor(strong, null);
  expect(r.category).toBe('Strong Prospect');
  expect(r.tone).toBe('score');
});
