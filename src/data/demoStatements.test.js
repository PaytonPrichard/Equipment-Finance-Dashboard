// The demo's statement-built deals must tie out, or the demo shows a build
// that contradicts its own numbers.

import { getInitialDemoPipeline } from './demoPipeline';
import exampleDeals from './exampleDeals';
import { statementState, applyStatementBuild, pendingJudgments } from '../lib/statementBuild';
import { getModule } from '../modules';

const M = 1_000_000;
const mod = getModule('equipment_finance');

describe('"Try a deal built from statements" example', () => {
  const example = exampleDeals.find((d) => d.id === 'statements');
  const built = applyStatementBuild(example.inputs, undefined);
  const state = statementState(built, undefined);

  test('builds every field with no gaps', () => {
    expect(state.build.errors).toEqual([]);
    expect(built.annualRevenue).toBe(180 * M);
    expect(built.ebitda).toBeCloseTo(11.6 * M, 0);             // 11.0 + 3.2 - 2.6 floorplan interest
    expect(built.totalExistingDebt).toBe(20 * M);              // floorplan payable left out
    expect(built.actualAnnualDebtService).toBeCloseTo(3.9 * M, 0); // 4.1 - 2.6 + 2.4
  });

  test('scores once built, and leaves the judgments for the visitor', () => {
    expect(mod.isInputValid(built)).toBe(true);
    expect(pendingJudgments(state)).toBeGreaterThan(0);
  });

  test('is not the tutorial deal', () => {
    expect(exampleDeals[0].id).toBe('strong');
  });
});

describe('Heartland Foods in the demo pipeline', () => {
  const deal = getInitialDemoPipeline().find((d) => d.name === 'Heartland Foods Manufacturing');
  const state = statementState(deal.inputs, undefined);

  test('statements build the numbers the deal was screened on', () => {
    expect(state.build.errors).toEqual([]);
    expect(deal.inputs.annualRevenue).toBe(72 * M);
    expect(deal.inputs.ebitda).toBe(11.5 * M);
    expect(deal.inputs.totalExistingDebt).toBe(22 * M);
    expect(deal.inputs.actualAnnualDebtService).toBeCloseTo(2.7 * M, 0);
    expect(applyStatementBuild(deal.inputs, undefined)).toBe(deal.inputs); // already built, nothing moves
  });

  test('every judgment confirmed by the demo analyst, firm rules kept', () => {
    expect(pendingJudgments(state)).toBe(0);
    expect(Object.values(deal.inputs.financials.judgments).every((j) => j.by === 'J. Peter')).toBe(true);
    expect(deal.inputs.financials.firmRules).toBeDefined();
  });

  test('card score is a number', () => {
    expect(typeof deal.score).toBe('number');
  });
});

test('Heartland, a performing funded deal, passes the firm policy', () => {
  const { evaluateScreening, DEFAULT_CRITERIA } = require('../lib/screeningCriteria');
  const { calculateMetrics, calculateRiskScore } = require('../modules/equipment-finance/scoring');
  const deal = getInitialDemoPipeline().find((d) => d.name === 'Heartland Foods Manufacturing');
  const m = calculateMetrics(deal.inputs, 0.0425);
  const r = evaluateScreening(DEFAULT_CRITERIA, m, calculateRiskScore(deal.inputs, m), deal.inputs, 'equipment_finance');
  expect(r.verdict).toBe('pass');
});
