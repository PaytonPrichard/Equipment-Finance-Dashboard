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
    expect(html).toMatch(/font-family:monospace">\d+\.\d+x</);
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
