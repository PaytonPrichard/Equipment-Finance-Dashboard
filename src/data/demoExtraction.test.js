// The Video A numbers, locked to the product.
//
// VIDEO_SCRIPTS.md puts specific figures on screen and RECORDING_RUNBOOK.md
// phase 0 asks you to re-verify every one of them by hand before a shoot.
// Doing that by hand is what produces a video whose voiceover disagrees with
// the screen, because a scoring change is silent until somebody replays the
// recording. So the script's claims live here as assertions instead: change a
// breakpoint or a precedence rule and this fails, naming the beat that is now
// wrong, months before anyone presses record.
//
// The path mirrored here is the real one, in order: the captured extraction,
// the real merge, applyMergeToForm, computeDealMetrics, calculateRiskScore,
// verdictForDeal. Nothing is stubbed and no value is duplicated from the
// script by hand except the figures the script actually says out loud.
//
// Timestamps in the test names are the Video A time column.

import demoExtraction from './demoExtraction.json';
import {
  mergeExtractions,
  chooseAlternative,
  sourceDocuments,
  applyMergeToForm,
  DOCUMENT_TYPE_LABELS,
} from '../lib/extractionMerge';
import { getModule } from '../modules';
import { INITIAL_INPUTS, DEFAULT_SOFR } from '../modules/equipment-finance/constants';
import { verdictForDeal } from '../lib/dealVerdict';
import { computeDealMetrics } from '../utils/dealMetrics';

const mod = getModule('equipment_finance');

const documents = demoExtraction.documents.map((d) => ({
  fileName: d.fileName,
  documentType: d.documentType,
  inputs: d.inputs,
  found: d.found,
  warnings: d.warnings,
  notes: d.notes,
  error: d.error,
}));

const merged = mergeExtractions(documents, []);

const formFrom = (result, previous = null, current = INITIAL_INPUTS) =>
  applyMergeToForm({
    initial: INITIAL_INPUTS,
    current,
    previousMerged: previous,
    nextMerged: result.inputs,
  });

const asMerged = formFrom(merged);

/** Screen the deal exactly as App.js does, at a fixed rate. */
const screen = (inputs, sofr = DEFAULT_SOFR) => {
  const metrics = computeDealMetrics(mod, inputs, sofr, undefined);
  const riskScore = mod.calculateRiskScore(inputs, metrics);
  const verdict = verdictForDeal(
    { inputs, score: riskScore.composite, asset_class: 'equipment_finance' },
    { sofr },
  );
  return { metrics, riskScore, verdict };
};

describe('Video A, the Granite Ridge set', () => {
  test('0:36 four documents, classified the way the voiceover names them', () => {
    expect(documents).toHaveLength(4);
    expect(documents.map((d) => DOCUMENT_TYPE_LABELS[d.documentType])).toEqual([
      'Credit application',
      'Financial statements',
      'Equipment quote',
      'Deal sheet',
    ]);
    expect(merged.failed).toEqual([]);
  });

  test('0:45 three fields disagree', () => {
    expect(merged.conflicts.map((c) => c.field).sort()).toEqual([
      'annualRevenue',
      'companyName',
      'ebitda',
    ]);
  });

  test('0:52 the financials say 7.4, the broker says just under 7.9', () => {
    const ebitda = merged.conflicts.find((c) => c.field === 'ebitda');
    expect(ebitda.chosen).toMatchObject({
      value: 7400000,
      fileName: '02_financial-statements.pdf',
    });
    expect(ebitda.alternatives).toHaveLength(1);
    expect(ebitda.alternatives[0]).toMatchObject({
      value: 7900000,
      fileName: '04_broker-email.txt',
    });
  });

  test('1:14 precedence is per kind of fact, not global', () => {
    // The voiceover: financials won on money, the quote won on the
    // equipment, the application won on who the borrower is.
    expect(merged.fieldSources.ebitda.fileName).toBe('02_financial-statements.pdf');
    expect(merged.fieldSources.annualRevenue.fileName).toBe('02_financial-statements.pdf');
    expect(merged.fieldSources.equipmentCost.fileName).toBe('03_equipment-quote.pdf');
    expect(merged.fieldSources.equipmentType.fileName).toBe('03_equipment-quote.pdf');
    expect(merged.fieldSources.companyName.fileName).toBe('01_credit-application.pdf');
  });

  test('1:24 twenty fields, and it scores 80 PASS', () => {
    expect(Object.keys(merged.inputs)).toHaveLength(20);
    const { riskScore, verdict } = screen(asMerged);
    expect(riskScore.composite).toBe(80);
    expect(verdict.category).toBe('pass');
  });

  test('1:32 the mining line reads as the script quotes it', () => {
    const { metrics, riskScore } = screen(asMerged);
    const commentary = mod.generateCommentary(asMerged, metrics, riskScore);
    expect(commentary).toContain(
      'Mining sector carries cyclical/operational risk; consider shorter tenor, step-up payments, or additional credit support.',
    );
  });

  test('0:00 the ask is a $5.3 million, 84-month EFA', () => {
    const { metrics } = screen(asMerged);
    expect(metrics.netFinanced).toBe(5333750);
    expect(asMerged.loanTerm).toBe(84);
    expect(asMerged.financingType).toBe('EFA');
  });

  test('1:48 the memo can name all four documents', () => {
    expect(sourceDocuments(merged).map((d) => d.fileName)).toEqual([
      '01_credit-application.pdf',
      '02_financial-statements.pdf',
      '03_equipment-quote.pdf',
      '04_broker-email.txt',
    ]);
  });
});

describe('Video A 1:08, the "Use that" beat', () => {
  const ebitda = merged.conflicts.find((c) => c.field === 'ebitda');
  const switched = chooseAlternative(merged, 'ebitda', ebitda.alternatives[0]);
  const afterUseThat = formFrom(switched, merged.inputs, asMerged);

  test('taking the broker EBITDA moves margin 19.3 to 20.6', () => {
    expect(screen(asMerged).metrics.ebitdaMargin).toBeCloseTo(19.3, 1);
    expect(screen(afterUseThat).metrics.ebitdaMargin).toBeCloseTo(20.6, 1);
  });

  test('and debt yield 138.7 to 148.1', () => {
    expect(screen(asMerged).metrics.debtYield).toBeCloseTo(138.7, 1);
    expect(screen(afterUseThat).metrics.debtYield).toBeCloseTo(148.1, 1);
  });

  test('the score holds at 80, which is why the edit needs a punch-in', () => {
    // The script calls this out: the only things that move are two figures
    // in a thin grey line. If the score ever starts moving here, the shot
    // direction at 1:08 is wrong and the beat gets easier, not harder.
    expect(screen(afterUseThat).riskScore.composite).toBe(80);
  });

  test('clicking it again restores the financials', () => {
    const restored = chooseAlternative(switched, 'ebitda', ebitda.chosen);
    expect(restored.inputs.ebitda).toBe(7400000);
    expect(restored.fieldSources.ebitda.fileName).toBe('02_financial-statements.pdf');
  });
});

describe('Video A 1:24, what the score survives', () => {
  // The screening rate is live SOFR from FRED, so the 80 the voiceover says
  // is only true inside a rate band. Worth knowing before a shoot, and worth
  // knowing that it is the rate, not the deal, that moved it.
  test.each([
    [0.03, 80],
    [0.0387, 80], // live SOFR on 2026-09-22, the rate the shoot will run at
    [0.0425, 80],
    [0.045, 80],
    [0.0475, 79],
    [0.06, 79],
  ])('at SOFR %p the deal scores %p', (sofr, expected) => {
    expect(screen(asMerged, sofr).riskScore.composite).toBe(expected);
  });

  test('it passes across the whole band either way', () => {
    [0.03, 0.0425, 0.0475, 0.06].forEach((sofr) => {
      expect(screen(asMerged, sofr).verdict.category).toBe('pass');
    });
  });
});
