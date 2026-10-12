// The marketing pages' numbers, locked to the product.
//
// siteFacts.js is typed by hand so the landing bundle stays small. This file
// recomputes every figure in it from the real modules, the demo data and the
// committed real-deals report. If one of these fails, a page is claiming
// something the product no longer does: fix siteFacts.js, not the test.

import fs from 'fs';
import path from 'path';
import demoExtraction from '../../data/demoExtraction.json';
import { mergeExtractions, applyMergeToForm, DOCUMENT_TYPE_LABELS } from '../../lib/extractionMerge';
import { getModule } from '../../modules';
import {
  INITIAL_INPUTS,
  DEFAULT_SOFR,
  FACTOR_TARGETS,
  GENERAL_LIQUIDATION_HAIRCUT,
  getLiquidationHaircut,
} from '../../modules/equipment-finance/constants';
import { verdictForDeal } from '../../lib/dealVerdict';
import { computeDealMetrics } from '../../utils/dealMetrics';
import { DEFAULT_CRITERIA } from '../../lib/screeningCriteria';
import { buildBorrowerInputs, DEFAULT_TREATMENT_RULES } from '../../lib/borrowerBuild';
import { PRAIRIE_FINANCIALS } from '../../data/demoStatements';
import exampleDeals from '../../data/exampleDeals';
import {
  getInitialDemoFacilities,
  getInitialDemoCovenantTests,
} from '../../data/demoMonitoring';
import {
  GRANITE,
  PRAIRIE,
  DRIFT,
  EQUIPMENT_FACTORS,
  SCORE_BANDS,
  LIMITS,
  HAIRCUTS,
  SCORECARD,
  SCORECARD_RUN,
} from './siteFacts';

const mod = getModule('equipment_finance');

describe('Granite Ridge, the four-document sample deal', () => {
  const merged = mergeExtractions(demoExtraction.documents, []);
  const inputs = applyMergeToForm({
    initial: INITIAL_INPUTS,
    current: INITIAL_INPUTS,
    previousMerged: null,
    nextMerged: merged.inputs,
  });
  const metrics = computeDealMetrics(mod, inputs, DEFAULT_SOFR, undefined);
  const risk = mod.calculateRiskScore(inputs, metrics);
  const verdict = verdictForDeal(
    { inputs, score: risk.composite, asset_class: 'equipment_finance' },
    { sofr: DEFAULT_SOFR },
  );
  const rows = mod.describeFactors(inputs, metrics, risk);

  test('score and verdict', () => {
    expect(risk.composite).toBe(GRANITE.score);
    expect(verdict.label).toBe(GRANITE.verdict);
    expect(inputs.companyName).toBe(GRANITE.company);
    expect(inputs.industrySector).toBe(GRANITE.sector);
  });

  test('documents, their types and field counts', () => {
    expect(demoExtraction.documents.map((d) => ({
      name: d.fileName,
      type: DOCUMENT_TYPE_LABELS[d.documentType],
      fields: Object.keys(d.inputs).length,
    }))).toEqual(GRANITE.documents.map(({ name, type, fields }) => ({ name, type, fields })));
    expect(Object.keys(merged.inputs)).toHaveLength(GRANITE.mergedFields);
    expect(merged.conflicts).toHaveLength(GRANITE.conflictCount);
  });

  test('the EBITDA conflict and what the merge kept', () => {
    const ebitda = merged.conflicts.find((c) => c.field === 'ebitda');
    expect(ebitda.chosen).toMatchObject({ value: GRANITE.ebitdaConflict.chosen, fileName: GRANITE.ebitdaConflict.chosenFrom });
    expect(ebitda.alternatives[0]).toMatchObject({ value: GRANITE.ebitdaConflict.alternative, fileName: GRANITE.ebitdaConflict.alternativeFrom });

    const keys = { Company: 'companyName', Revenue: 'annualRevenue', EBITDA: 'ebitda', 'Equipment cost': 'equipmentCost' };
    GRANITE.merged.forEach((row) => {
      expect(merged.inputs[keys[row.field]]).toBe(row.value);
      // The page drops the numeric prefix from file names so the column fits.
      expect(merged.fieldSources[keys[row.field]].fileName.replace(/^\d+_/, '')).toBe(row.src);
    });
  });

  test('all seven factor rows', () => {
    expect(rows).toHaveLength(GRANITE.factors.length);
    GRANITE.factors.forEach((f) => {
      const row = rows.find((r) => r.key === f.key);
      expect(row.label).toBe(f.label);
      expect(row.score).toBe(f.score);
      expect(Math.round(row.weight * 100)).toBe(f.weight);
      expect(row.target).toBe(f.target);
      expect(row.passed).toBe(f.met);
      // The LTV caption also carries liquidation LTV, which the page prints
      // on its own line with its estimate marker.
      expect(row.caption.startsWith(f.value)).toBe(true);
    });
    expect(GRANITE.factors.reduce((sum, f) => sum + f.weight, 0)).toBe(100);
  });

  test('liquidation LTV and the haircut it rests on', () => {
    expect(Math.round(metrics.liquidationLtv * 100)).toBe(GRANITE.liquidationLtvPct);
    expect(metrics.liquidationHaircut * 100).toBe(GRANITE.liquidationHaircutPct);
    expect(metrics.liquidationHaircutBasis).toBe(GRANITE.liquidationHaircutBasis);
  });
});

describe('Prairie, the statement-built demo deal', () => {
  const build = buildBorrowerInputs(PRAIRIE_FINANCIALS, DEFAULT_TREATMENT_RULES);

  test('it is the example the demo offers', () => {
    expect(JSON.stringify(exampleDeals)).toContain(PRAIRIE.company);
  });

  test('built figures and the terms behind them', () => {
    expect(build.errors).toEqual([]);
    PRAIRIE.built.forEach((b) => {
      const d = build.derivations[b.key];
      expect(d.value).toBe(b.value);
      expect(d.terms.map((t) => ({ sign: t.sign, value: t.value, page: t.source.page })))
        .toEqual(b.terms.map((t) => ({ sign: t.sign, value: t.value, page: t.page })));
      // Page labels are shortened; each must still open the real one.
      b.terms.forEach((t, i) => expect(d.terms[i].label.startsWith(t.label)).toBe(true));
      if (b.note) expect(d.notes).toContain(b.note);
    });
  });

  test('maintenance capex is an estimate', () => {
    expect(build.derivations.maintenanceCapex.value).toBe(PRAIRIE.maintenanceCapex);
    expect(build.derivations.maintenanceCapex.estimate).toBe(true);
  });

  test('judgments to confirm, and the borrower-adjusted figure', () => {
    expect(build.judgments).toHaveLength(PRAIRIE.judgmentCount);
    expect(build.judgments.every((j) => j.confirmed === false)).toBe(true);
    const adjusted = build.comparisons.find((c) => c.against === 'adjusted');
    expect(adjusted.company).toBe(PRAIRIE.adjustedEbitda);
    expect(adjusted.gap).toBe(PRAIRIE.adjustedGap);
    expect(PRAIRIE_FINANCIALS.lineItems.revenue.source.document).toBe(PRAIRIE.document);
  });
});

describe('Monitoring drift, the two funded demo facilities', () => {
  const facilities = getInitialDemoFacilities();
  const tests = getInitialDemoCovenantTests();
  const UNIT = { DSCR: { key: 'dscr', covenant: 1, dp: 2 }, Leverage: { key: 'leverage', covenant: 2, dp: 1 } };

  test.each(DRIFT)('$facility $covenant', (row) => {
    const unit = UNIT[row.covenant];
    const facility = facilities.find((f) => f.borrower_name === row.facility);
    const underwrote = facility.underwritten_snapshot.metrics[unit.key];
    const readings = tests.filter((t) => t.covenant_id === `${facility.id}-cov-${unit.covenant}`);
    const current = readings[readings.length - 1].reported_value;
    const delta = current - underwrote;

    expect(`${underwrote.toFixed(unit.dp)}x`).toBe(row.underwrote);
    expect(`${current.toFixed(unit.dp)}x`).toBe(row.current);
    expect(`${delta > 0 ? '+' : ''}${delta.toFixed(unit.dp)}x`).toBe(row.drift);
    // Lower coverage and higher leverage are both the wrong direction.
    expect(row.worse).toBe(unit.key === 'dscr' ? delta < 0 : delta > 0);
  });
});

describe('Method: factors, bands, limits and haircuts', () => {
  test('equipment factor weights and targets', () => {
    expect(EQUIPMENT_FACTORS.map((f) => f.weight)).toEqual([25, 20, 15, 10, 10, 10, 10]);
    expect(EQUIPMENT_FACTORS.map((f) => f.label)).toEqual(GRANITE.factors.map((f) => f.label));
    expect(FACTOR_TARGETS).toEqual({ minDscr: 1.25, maxLeverage: 3.5, maxLtv: 0.85, maxTermCoverage: 80, minYearsInBusiness: 5 });
  });

  test('every module scores seven weighted factors', () => {
    ['equipment_finance', 'accounts_receivable', 'inventory_finance'].forEach((key) => {
      const m = getModule(key);
      const metrics = m.calculateMetrics(m.INITIAL_INPUTS || {}, DEFAULT_SOFR);
      const rows = m.describeFactors(m.INITIAL_INPUTS || {}, metrics, m.calculateRiskScore(m.INITIAL_INPUTS || {}, metrics));
      expect(rows).toHaveLength(7);
      expect(Math.round(rows.reduce((s, r) => s + r.weight, 0) * 100)).toBe(100);
    });
  });

  test('score bands and limits are the default criteria', () => {
    expect(SCORE_BANDS).toEqual({ pass: DEFAULT_CRITERIA.passScore, flag: DEFAULT_CRITERIA.flagScore });
    LIMITS.forEach((l) => expect(DEFAULT_CRITERIA[l.key]).toBe(l.value));
  });

  test('cash-flow stress scenarios', () => {
    expect(DEFAULT_CRITERIA).toMatchObject({
      stressRevenueDeclineMild: 10,
      stressRevenueDeclineModerate: 20,
      stressRevenueDeclineSevere: 30,
      stressMarginCompressionBps: 200,
      stressRateShockBps: 200,
      stressWcDelayDays: 20,
      stressCombinedRevenueDecline: 20,
      stressCombinedMarginBps: 200,
    });
  });

  test('liquidation haircuts and what backs each', () => {
    const TYPES = {
      'Trucks and fleet': 'Vehicles/Fleet',
      'Construction equipment': 'Construction Equipment',
      'Agricultural equipment': 'Agricultural Equipment',
      'Every other type': 'Other',
    };
    HAIRCUTS.forEach((h) => {
      expect(getLiquidationHaircut(TYPES[h.type], 'New')).toEqual({ rate: h.newPct / 100, basis: h.newBasis });
      expect(getLiquidationHaircut(TYPES[h.type], 'Used')).toEqual({ rate: h.usedPct / 100, basis: h.usedBasis });
    });
    expect(GENERAL_LIQUIDATION_HAIRCUT).toEqual({ New: 0.25, Used: 0.3 });
  });

  test('default treatment rules', () => {
    expect(DEFAULT_TREATMENT_RULES).toMatchObject({
      financeLeases: 'in',
      operatingLeases: 'out',
      floorplan: 'out',
      captiveFleet: 'corporate',
      ebitdaGapTolerance: 0.05,
    });
  });
});

describe('The real-deals scorecard', () => {
  const report = fs.readFileSync(
    path.join(__dirname, '../../../scripts/real-deals/reports', `${SCORECARD_RUN}.md`),
    'utf8',
  );
  // | Case | Expected | Tranche | Score | Result | Caveats |
  const table = report
    .split('\n')
    .filter((line) => /^\| .+ \| (PASS|FLAG|FAIL) \| (PASS|FLAG|FAIL) \| \d+ \|/.test(line))
    .map((line) => line.split('|').map((cell) => cell.trim()))
    .map((cells) => ({ name: cells[1], verdict: cells[3], score: Number(cells[4]) }));

  test('the page lists every case in the run, with its verdict and score', () => {
    expect(table).toHaveLength(9);
    expect(SCORECARD.map(({ name, verdict, score }) => ({ name, verdict, score }))).toEqual(table);
  });
});
