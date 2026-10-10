import { buildStatementsMemoHtml } from './statementMemo';
import { getInitialDemoPipeline } from '../data/demoPipeline';
import exampleDeals from '../data/exampleDeals';
import { applyStatementBuild, setDealTreatment, overrideField } from '../lib/statementBuild';

const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

test('no statements, no section', () => {
  expect(buildStatementsMemoHtml({ ebitda: 1 }, undefined)).toBe('');
});

describe('a confirmed, saved build (Heartland, demo)', () => {
  const deal = getInitialDemoPipeline().find((d) => d.name === 'Heartland Foods Manufacturing');
  const t = text(buildStatementsMemoHtml(deal.inputs, undefined));

  test('names the EBITDA source, year and who confirmed', () => {
    expect(t).toContain('How the Numbers Were Built');
    expect(t).toContain('EBITDA, built from statements. Fiscal year ended 2025-12-31.');
    expect(t).toMatch(/All \d+ judgments confirmed by J\. Peter\./);
  });

  test('every built figure with its formula and page', () => {
    expect(t).toContain('EBITDA $11.5M Operating income $8.7M (FY2025 audited financials, p. 5) + Depreciation and amortization $2.8M (FY2025 audited financials, p. 7)');
    expect(t).toContain('Maintenance capex $2.5M');
    expect(t).toContain('(estimate)');
  });
});

describe('an unconfirmed build with overrides and a bridge (Prairie, demo)', () => {
  let inputs = applyStatementBuild(exampleDeals.find((d) => d.id === 'statements').inputs, undefined);
  inputs = setDealTreatment(inputs, 'floorplan', 'in', 'Credit agreement counts floorplan as debt', undefined, 'J. Peter').inputs;
  inputs = overrideField(inputs, 'leasePayments', 'Rent steps down after lease renewal', 'J. Peter').inputs;
  const t = text(buildStatementsMemoHtml(inputs, undefined));

  test('says how many judgments are not confirmed', () => {
    expect(t).toMatch(/\d+ of \d+ judgments not confirmed\./);
  });

  test('prints each override with its reason', () => {
    expect(t).toContain('Floorplan (dealers): Debt, overridden for this deal. Reason: Credit agreement counts floorplan as debt');
    expect(t).toContain('Typed by analyst, overriding the build. Reason: Rent steps down after lease renewal');
  });

  test('lists add-backs with their review status and the gap check', () => {
    expect(t).toContain('Add-backs (0 of 3 accepted)');
    expect(t).toContain('Pro forma EBITDA of store acquired in November $500K: not reviewed, excluded');
    expect(t).toMatch(/Caveat above 5%, firm policy\./);
  });
});

test('escapes what the analyst typed', () => {
  let inputs = applyStatementBuild(exampleDeals.find((d) => d.id === 'statements').inputs, undefined);
  inputs = overrideField(inputs, 'cashTaxes', '<script>x</script>').inputs;
  expect(buildStatementsMemoHtml(inputs, undefined)).not.toContain('<script>');
});

test('a working capital build reads as reported, sign reversed', () => {
  const deal = getInitialDemoPipeline().find((d) => d.name === 'Heartland Foods Manufacturing');
  expect(text(buildStatementsMemoHtml(deal.inputs, undefined))).toContain('Working capital increase $500K Change in working capital -$500K (FY2025 audited financials, p. 7), sign reversed');
});

describe('a deal rebuilt with newer firm rules', () => {
  const { rebuildWithCurrentRules } = require('../lib/statementBuild');
  const deal = getInitialDemoPipeline().find((d) => d.name === 'Heartland Foods Manufacturing');
  const from = deal.inputs.financials.firmRules;
  const to = { ...from, ebitdaGapTolerance: 0.1 };

  test('per deal: says when and who', () => {
    const { inputs } = rebuildWithCurrentRules(deal.inputs, to, { by: 'J. Peter', at: '2026-10-09T12:00:00Z' });
    expect(text(buildStatementsMemoHtml(inputs, to))).toContain('Rebuilt with firm rules on 2026-10-09 by J. Peter. EBITDA gap tolerance: 5% to 10%.');
  });

  test('bulk: says it was the admin, with the open deals', () => {
    const { inputs } = rebuildWithCurrentRules(deal.inputs, to, { by: 'Admin', at: '2026-10-09T12:00:00Z', bulk: true });
    expect(text(buildStatementsMemoHtml(inputs, to))).toContain("Rebuilt with firm rules on 2026-10-09 by Admin, with the firm's open deals.");
  });

  test('never rebuilt, no line', () => {
    expect(text(buildStatementsMemoHtml(deal.inputs, undefined))).not.toContain('Rebuilt with firm rules');
  });
});
