// Structural assertions for the branded PDF generator. These don't validate
// pixel-perfect layout but they prove the new sections (red flags,
// recommendation + conditions, strengths & concerns, sensitivity, FCCR row,
// firm thresholds, footer metadata, structured suggested-structure) render
// for each module so a future refactor can't silently drop one.

import { generateBrandedPdfHtml } from './ExportPanel';
import * as ef from '../modules/equipment-finance/scoring';
import * as ar from '../modules/accounts-receivable/scoring';
import * as inv from '../modules/inventory-finance/scoring';
import { INITIAL_INPUTS as EF_INITIAL } from '../modules/equipment-finance/constants';
import { INITIAL_INPUTS as AR_INITIAL } from '../modules/accounts-receivable/constants';
import { INITIAL_INPUTS as INV_INITIAL } from '../modules/inventory-finance/constants';
import { computeBorrowerExtras } from '../utils/borrowerMetrics';
import { evaluateScreening, DEFAULT_CRITERIA } from '../lib/screeningCriteria';

function buildPdfFor(moduleKey, mod, baseInputs) {
  const metrics = mod.calculateMetrics(baseInputs);
  const riskScore = mod.calculateRiskScore(baseInputs, metrics);
  const recommendation = mod.getRecommendation(riskScore.composite);
  const commentary = mod.generateCommentary(baseInputs, metrics, riskScore, DEFAULT_CRITERIA);
  const structure = mod.getSuggestedStructure(baseInputs, metrics, riskScore.composite);
  const stressResults = mod.runStressTest(baseInputs);
  const factors = mod.describeFactors(baseInputs, metrics, riskScore);
  const summaryText = mod.generateExportSummary(baseInputs, metrics, riskScore, recommendation, commentary, structure, undefined, DEFAULT_CRITERIA);
  const borrowerExtras = computeBorrowerExtras(baseInputs, metrics);
  const screeningResult = evaluateScreening(DEFAULT_CRITERIA, metrics, riskScore, baseInputs, moduleKey);

  return generateBrandedPdfHtml({
    summaryText, inputs: baseInputs, metrics, riskScore, recommendation, screeningResult,
    orgName: 'Test Bank', analystName: 'Test Analyst', moduleLabel: 'Test Module',
    branding: {}, factors, structure, stressResults, moduleKey, borrowerExtras,
    criteria: DEFAULT_CRITERIA,
  });
}

describe('generateBrandedPdfHtml — Equipment Finance', () => {
  const inputs = {
    ...EF_INITIAL,
    companyName: 'EF Test Co',
    yearsInBusiness: 10,
    annualRevenue: 50_000_000,
    ebitda: 2_000_000, // intentionally tight to surface red flags
    totalExistingDebt: 25_000_000,
    industrySector: 'Construction',
    creditRating: 'Weak',
    equipmentType: 'Heavy Machinery',
    equipmentCondition: 'New',
    equipmentCost: 5_000_000,
    downPayment: 500_000,
    financingType: 'EFA',
    usefulLife: 15,
    loanTerm: 84,
    essentialUse: true,
  };
  const html = buildPdfFor('equipment_finance', ef, inputs);

  test('renders the Recommended Action section', () => {
    expect(html).toContain('Recommended Action');
  });

  test('renders the firm-threshold strip with pass/flag thresholds', () => {
    expect(html).toMatch(/Firm pass threshold/);
    expect(html).toMatch(/Firm flag threshold/);
  });

  test('renders Strengths & Risks', () => {
    expect(html).toContain('Strengths');
    expect(html).toContain('Risks');
  });

  test('renders Sensitivity Analysis with all four scenarios', () => {
    expect(html).toContain('Sensitivity Analysis');
    expect(html).toContain('Base Case');
    // EF labels include the percent in parentheses
    expect(html).toMatch(/Severe \(-30%\)/);
  });

  test('Sensitivity has DSCR and FCCR columns but no Borrowing Base column for EF', () => {
    expect(html).toMatch(/>DSCR<\/th>/);
    expect(html).toMatch(/>FCCR<\/th>/);
    expect(html).not.toMatch(/>Borrowing Base<\/th>/);
  });

  test('Key Metrics table includes FCCR row', () => {
    expect(html).toMatch(/<td>FCCR<\/td>/);
  });

  test('Suggested Structure section appears with structured EF content', () => {
    expect(html).toContain('Suggested Structure');
    // EF: structure type label (EFA) and rate range
    expect(html).toContain('EFA');
    expect(html).toContain('Indicative rate');
  });

  test('Footer includes Prepared by and version', () => {
    expect(html).toContain('Prepared by: Test Analyst');
    expect(html).toMatch(/Tranche v/);
  });
});

describe('generateBrandedPdfHtml — Accounts Receivable', () => {
  const inputs = {
    ...AR_INITIAL,
    companyName: 'AR Test Co',
    yearsInBusiness: 10,
    annualRevenue: 50_000_000,
    ebitda: 6_000_000,
    totalExistingDebt: 18_000_000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalAROutstanding: 12_000_000,
    arUnder30: 60,
    arOver30: 22,
    arOver60: 12,
    arOver90: 6,
    topCustomerConcentration: 30,
    dilutionRate: 6,
    ineligiblesPct: 15,
    requestedAdvanceRate: 80,
  };
  const html = buildPdfFor('accounts_receivable', ar, inputs);

  test('Sensitivity has Borrowing Base column for AR', () => {
    expect(html).toMatch(/>Borrowing Base<\/th>/);
  });

  test('Suggested Structure surfaces AR reporting requirements list', () => {
    expect(html).toContain('Reporting Requirements');
    expect(html).toMatch(/borrowing base certificate/i);
  });

  test('Recommended Action shows conditions when enhancements exist', () => {
    expect(html).toContain('Recommended Action');
    // High concentration + high dilution triggers enhancements
    expect(html).toContain('Conditions / Mitigants');
  });

  test('Sensitivity rows render finite numeric DSCR and FCCR values', () => {
    // The cell values come through the table; assert at least one row contains
    // a 0.00x-style ratio in monospace cells.
    // Matches the mono cell without pinning the exact font stack: this
    // assertion is about the sensitivity table rendering finite ratios, not
    // about which monospace family is configured.
    expect(html).toMatch(/monospace">\d+\.\d+x</);
  });
});

describe('generateBrandedPdfHtml — Inventory Finance', () => {
  const inputs = {
    ...INV_INITIAL,
    companyName: 'Inv Test Co',
    yearsInBusiness: 10,
    annualRevenue: 50_000_000,
    ebitda: 6_000_000,
    totalExistingDebt: 18_000_000,
    industrySector: 'Manufacturing',
    creditRating: 'Adequate',
    totalInventory: 8_000_000,
    rawMaterials: 30,
    workInProgress: 15,
    finishedGoods: 50,
    obsoleteInventory: 5,
    inventoryTurnover: 6,
    averageDaysOnHand: 60,
    requestedAdvanceRate: 55,
    nolvPct: 55,
  };
  const html = buildPdfFor('inventory_finance', inv, inputs);

  test('Sensitivity has Borrowing Base column for Inventory', () => {
    expect(html).toMatch(/>Borrowing Base<\/th>/);
  });

  test('Suggested Structure renders the borrowing-base sublimits table', () => {
    expect(html).toContain('Borrowing Base Sublimits');
    expect(html).toContain('Raw Materials');
    expect(html).toContain('Work-in-Progress');
    expect(html).toContain('Finished Goods');
  });

  test('Suggested Structure surfaces field exam frequency', () => {
    expect(html).toMatch(/Field exams/);
  });

  test('Inventory module also gets the FCCR row in Key Metrics', () => {
    expect(html).toMatch(/<td>FCCR<\/td>/);
  });
});

// ───────────────────────────────────────────────────────────────
// Phase 4: what a committee memo has to open with, and where its
// numbers came from.
// ───────────────────────────────────────────────────────────────

describe('memo opens by stating the ask', () => {
  const efInputs = {
    ...EF_INITIAL,
    companyName: 'Granite Ridge Materials LLC',
    annualRevenue: 38400000,
    ebitda: 7400000,
    totalExistingDebt: 14200000,
    yearsInBusiness: 16,
    industrySector: 'Mining',
    creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery',
    equipmentCondition: 'New',
    equipmentCost: 6275000,
    downPayment: 941250,
    financingType: 'EFA',
    usefulLife: 12,
    loanTerm: 84,
    essentialUse: true,
  };

  test('transaction summary names the amount, term and borrower', () => {
    // A reader used to get a score before knowing what was being asked for.
    const html = buildPdfFor('equipment_finance', ef, efInputs);
    expect(html).toContain('Transaction Summary');
    expect(html).toContain('84-month');
    expect(html).toContain('Granite Ridge Materials LLC');
    // Amount financed is cost less the borrower contribution.
    expect(html).toContain('$5,333,750');
  });

  test('borrower description comes from fields already collected', () => {
    const html = buildPdfFor('equipment_finance', ef, efInputs);
    expect(html).toContain('16 years');
    expect(html).toContain('mining');
    expect(html).toContain('adequate');
  });

  test('sources and uses reconciles to the amount financed', () => {
    const html = buildPdfFor('equipment_finance', ef, efInputs);
    expect(html).toContain('Sources and Uses');
    expect(html).toContain('$6,275,000');   // equipment cost
    expect(html).toContain('$941,250');     // borrower contribution
    expect(html).toContain('(15.0%)');      // as a share of cost
    expect(html).toContain('$5,333,750');   // financed
  });

  test('a deal with no company name does not render an empty request line', () => {
    const html = buildPdfFor('equipment_finance', ef, { ...efInputs, companyName: '' });
    expect(html).not.toContain('Transaction Summary');
  });

  test('AR and inventory state a revolver, not an equipment purchase', () => {
    const arHtml = buildPdfFor('accounts_receivable', ar, {
      ...AR_INITIAL,
      companyName: 'AR Co',
      annualRevenue: 40000000, ebitda: 6000000, totalExistingDebt: 12000000,
      totalAROutstanding: 10000000, arUnder30: 70, arOver30: 20, arOver60: 7, arOver90: 3,
      topCustomerConcentration: 15, dilutionRate: 3, requestedAdvanceRate: 85,
    });
    expect(arHtml).toContain('secured by accounts receivable');
    // Sources and uses describes a fixed purchase, which a revolver is not.
    expect(arHtml).not.toContain('Sources and Uses');
  });
});

describe('memo says where its numbers came from', () => {
  const inputs = {
    ...EF_INITIAL,
    companyName: 'Provenance Co',
    annualRevenue: 50000000, ebitda: 8000000, totalExistingDebt: 15000000,
    industrySector: 'Manufacturing', creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
    equipmentCost: 5000000, downPayment: 500000, financingType: 'EFA',
    usefulLife: 15, loanTerm: 84, essentialUse: true,
  };

  function buildWithSources(sourceDocuments) {
    const metrics = ef.calculateMetrics(inputs);
    const riskScore = ef.calculateRiskScore(inputs, metrics);
    const recommendation = ef.getRecommendation(riskScore.composite);
    const commentary = ef.generateCommentary(inputs, metrics, riskScore, DEFAULT_CRITERIA);
    const structure = ef.getSuggestedStructure(inputs, metrics, riskScore.composite);
    const screeningResult = evaluateScreening(DEFAULT_CRITERIA, metrics, riskScore, inputs, 'equipment_finance');
    return generateBrandedPdfHtml({
      summaryText: ef.generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, undefined, DEFAULT_CRITERIA),
      inputs, metrics, riskScore, recommendation, screeningResult,
      orgName: 'Test Bank', analystName: 'Test Analyst', moduleLabel: 'Equipment Finance',
      branding: {}, factors: ef.describeFactors(inputs, metrics, riskScore),
      structure, stressResults: ef.runStressTest(inputs), moduleKey: 'equipment_finance',
      criteria: DEFAULT_CRITERIA, commentary, sourceDocuments,
    });
  }

  test('lists each document that fed the inputs', () => {
    const html = buildWithSources([
      { fileName: '02_financial-statements.pdf', documentType: 'Financial statements', addedOn: 'Sep 1, 2026' },
      { fileName: '03_equipment-quote.pdf', documentType: 'Equipment quote', addedOn: 'Sep 1, 2026' },
    ]);
    expect(html).toContain('Source Documents');
    expect(html).toContain('02_financial-statements.pdf');
    expect(html).toContain('Equipment quote');
    expect(html).toContain('Sep 1, 2026');
  });

  test('says so plainly when the inputs were typed', () => {
    const html = buildWithSources([]);
    expect(html).toContain('Source Documents');
    expect(html).toContain('entered manually');
  });

  test('states that the score comes from reviewed inputs, not the documents', () => {
    // The claim the whole provenance story rests on.
    const html = buildWithSources([
      { fileName: 'x.pdf', documentType: 'Financial statements', addedOn: 'Sep 1, 2026' },
    ]);
    expect(html).toContain('reviewed by the analyst before scoring');
    expect(html).toContain('not from the documents directly');
  });

  test('a filename cannot inject markup into the memo', () => {
    const html = buildWithSources([
      { fileName: '<img src=x onerror=alert(1)>.pdf', documentType: 'Other document', addedOn: 'Sep 1, 2026' },
    ]);
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x');
  });
});

describe('assessment section is passed in, not re-parsed', () => {
  const inputs = {
    ...EF_INITIAL,
    companyName: 'Assessment Co',
    annualRevenue: 50000000, ebitda: 8000000, totalExistingDebt: 15000000,
    industrySector: 'Manufacturing', creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
    equipmentCost: 5000000, downPayment: 500000, financingType: 'EFA',
    usefulLife: 15, loanTerm: 84, essentialUse: true,
  };

  function build({ summaryText, commentary }) {
    const metrics = ef.calculateMetrics(inputs);
    const riskScore = ef.calculateRiskScore(inputs, metrics);
    const recommendation = ef.getRecommendation(riskScore.composite);
    const structure = ef.getSuggestedStructure(inputs, metrics, riskScore.composite);
    return generateBrandedPdfHtml({
      summaryText, inputs, metrics, riskScore, recommendation,
      screeningResult: evaluateScreening(DEFAULT_CRITERIA, metrics, riskScore, inputs, 'equipment_finance'),
      orgName: 'Test Bank', analystName: 'Test Analyst', moduleLabel: 'Equipment Finance',
      branding: {}, factors: ef.describeFactors(inputs, metrics, riskScore),
      structure, stressResults: ef.runStressTest(inputs), moduleKey: 'equipment_finance',
      criteria: DEFAULT_CRITERIA, commentary,
    });
  }

  test('renaming a header in the text summary no longer empties the section', () => {
    // This is the regression: the section was recovered by string-matching
    // 'ASSESSMENT NOTES' out of a blob, so a header rename silently dropped it.
    const html = build({
      summaryText: 'COMPLETELY DIFFERENT HEADERS\nnothing matchable here',
      commentary: ['Leverage is moderate at 1.9x EBITDA.', 'Essential-use equipment supports recovery.'],
    });
    expect(html).toContain('Leverage is moderate at 1.9x EBITDA.');
    expect(html).toContain('Essential-use equipment supports recovery.');
  });

  test('an un-updated caller still gets its assessment from the text summary', () => {
    const html = build({
      summaryText: 'ASSESSMENT NOTES\n----------\n1. Legacy parsed line.\n\nSTRESS TEST\n',
      commentary: null,
    });
    expect(html).toContain('Legacy parsed line.');
  });
});

describe('the memo contains no model-generated prose', () => {
  // The product claim: extraction only ever prefills fields for analyst
  // review, and the memo is assembled from inputs, computed metrics and
  // threshold-selected templates. If the memo ever reaches for the
  // extraction path, that claim stops being true.
  const fs = require('fs');
  const path = require('path');
  const source = fs.readFileSync(path.join(__dirname, 'ExportPanel.js'), 'utf-8');

  test('ExportPanel imports nothing from the extraction path', () => {
    expect(source).not.toMatch(/from\s+['"].*extract/i);
    expect(source).not.toMatch(/from\s+['"].*parse-deal/i);
    expect(source).not.toMatch(/anthropic/i);
  });

  test('ExportPanel makes no network calls of its own', () => {
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(source).not.toMatch(/XMLHttpRequest/);
  });
});

describe('the request line reads correctly aloud', () => {
  // "a 85% advance rate" is the sort of thing that reads as unpolished in a
  // committee document. The article depends on how the number is spoken.
  const arBase = {
    ...AR_INITIAL,
    companyName: 'Article Co',
    annualRevenue: 40000000, ebitda: 6000000, totalExistingDebt: 12000000,
    totalAROutstanding: 10000000, arUnder30: 70, arOver30: 20, arOver60: 7, arOver90: 3,
    topCustomerConcentration: 15, dilutionRate: 3,
  };

  test('85% takes "an"', () => {
    const html = buildPdfFor('accounts_receivable', ar, { ...arBase, requestedAdvanceRate: 85 });
    expect(html).toContain('at an 85% advance rate');
  });

  test('55% takes "a"', () => {
    const html = buildPdfFor('accounts_receivable', ar, { ...arBase, requestedAdvanceRate: 55 });
    expect(html).toContain('at a 55% advance rate');
  });

  test('80% takes "an"', () => {
    const html = buildPdfFor('accounts_receivable', ar, { ...arBase, requestedAdvanceRate: 80 });
    expect(html).toContain('at an 80% advance rate');
  });

  test('no advance rate means no facility size, so no transaction summary', () => {
    // The borrowing base is the advance rate applied to eligible AR, so
    // without a rate there is no facility to state. Omitting the section
    // beats printing "$0 revolving facility".
    const html = buildPdfFor('accounts_receivable', ar, { ...arBase, requestedAdvanceRate: 0 });
    expect(html).not.toContain('Transaction Summary');
  });

  test('no memo ever prints a dangling article', () => {
    for (const rate of [55, 80, 85, 0]) {
      const html = buildPdfFor('accounts_receivable', ar, { ...arBase, requestedAdvanceRate: rate });
      expect(html).not.toMatch(/at an?\s+% advance/);
      expect(html).not.toMatch(/at a 8[0-9]% advance/);
      expect(html).not.toMatch(/at an [2-79][0-9]% advance/);
    }
  });
});

// ---------------------------------------------------------------
// Page geometry. These four facts have to agree or the memo is laid
// out at one width and printed at another, which is what silently
// shrank every memo to ~92% and put it on A4 while the stylesheet
// claimed letter. Asserted against the source because the geometry
// lives in the download handler, not in the returned HTML.
// ---------------------------------------------------------------
describe('PDF page geometry', () => {
  const src = require('fs').readFileSync(__dirname + '/ExportPanel.js', 'utf8');

  test('targets US letter, matching the @page rule', () => {
    expect(src).toMatch(/format: 'letter'/);
    expect(src).toMatch(/@page \{ margin: 0\.7in 0\.8in; size: letter; \}/);
  });

  test('jsPDF margins are the same 0.8in / 0.7in the @page rule uses', () => {
    expect(src).toMatch(/const MARGIN_X_MM = 20\.32;/);
    expect(src).toMatch(/const MARGIN_Y_MM = 17\.78;/);
    expect(src).toMatch(/margin: \[MARGIN_Y_MM, MARGIN_X_MM, MARGIN_Y_MM, MARGIN_X_MM\]/);
  });

  test('the capture container is the printable width, so nothing is scaled', () => {
    // 215.9mm letter less two 20.32mm margins, at 96px to the inch.
    const expected = Math.round(((215.9 - 20.32 * 2) * 96) / 25.4);
    expect(expected).toBe(662);
    expect(src).toMatch(/container\.style\.width = `\$\{CONTENT_PX\}px`/);
    expect(src).not.toMatch(/container\.style\.width = '780px'/);
  });

  test('body type is set for paper, not for a screen', () => {
    // 13.5 CSS px renders 1:1 at ~10pt, which is memo convention.
    expect(src).toMatch(/line-height: 1\.5; font-size: 13\.5px;/);
    expect(src).toMatch(/td, th \{ padding: 5px 12px 5px 0; font-size: 12\.5px;/);
  });
});
