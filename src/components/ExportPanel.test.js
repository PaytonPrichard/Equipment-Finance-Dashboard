// Structural assertions for the branded PDF generator. These don't validate
// pixel-perfect layout but they prove the new sections (red flags,
// recommendation + conditions, strengths & concerns, sensitivity, FCCR row,
// firm thresholds, footer metadata, structured suggested-structure) render
// for each module so a future refactor can't silently drop one.

import { generateBrandedPdfHtml, memoCaptureMarkup, scopeMemoCss, stripAppStylesForCapture, MEMO_SCOPE } from './ExportPanel';
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

  test('states the recommendation once, in the score banner', () => {
    // "Recommended Action" used to restate the banner directly beneath it:
    // same category, same colour, same detail line, within about 200px on
    // page one. Derived from the module rather than hardcoded, so this
    // still holds if the fixture's verdict moves.
    const metrics = ef.calculateMetrics(inputs);
    const rec = ef.getRecommendation(ef.calculateRiskScore(inputs, metrics).composite);
    const count = (t) => html.split(t).length - 1;
    expect(count(rec.category)).toBe(1);
    expect(count(rec.detail)).toBe(1);
    expect(html).not.toContain('Recommended Action');
  });

  test('term coverage says what it is a percentage of', () => {
    // 58% means nothing without the two numbers behind it, and term
    // coverage is this product's framing rather than a standard ratio.
    expect(html).toMatch(/Term Coverage/);
    expect(html).toContain(`${(inputs.loanTerm / 12).toFixed(1)}yr / ${inputs.usefulLife}yr`);
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

  test('conditions get their own section when there are any', () => {
    // High concentration + high dilution triggers enhancements.
    expect(html).toContain('Conditions and Mitigants');
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

// ---------------------------------------------------------------
// The PDF is rendered from a node in the live app, not from the memo
// document. Taking only <body> dropped the <head> stylesheet, so from
// the Sep 1 memo rework every section title, the header and the tables
// printed unstyled while the stored HTML looked correct.
// ---------------------------------------------------------------
describe('the PDF capture keeps the memo stylesheet', () => {
  const html = buildPdfFor('equipment_finance', ef, {
    ...EF_INITIAL,
    companyName: 'Style Co',
    annualRevenue: 50000000, ebitda: 8000000, totalExistingDebt: 15000000,
    industrySector: 'Manufacturing', creditRating: 'Adequate',
    equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
    equipmentCost: 5000000, downPayment: 500000, financingType: 'EFA',
    usefulLife: 15, loanTerm: 84, essentialUse: true,
  });

  test('carries the section, header and table rules, scoped to the container', () => {
    const markup = memoCaptureMarkup(html);
    expect(markup).toContain(`.${MEMO_SCOPE} .section-title {`);
    expect(markup).toContain(`.${MEMO_SCOPE} .header {`);
    expect(markup).toContain(`.${MEMO_SCOPE} td, .${MEMO_SCOPE} th {`);
    expect(markup).toContain('Style Co');
  });

  test('no unscoped rule can restyle the app while the PDF renders', () => {
    const css = memoCaptureMarkup(html).match(/<style>([\s\S]*?)<\/style>/)[1];
    expect(css).not.toMatch(/@page|@media/);
    for (const [, selectors] of css.matchAll(/([^{}]+)\{[^}]*\}/g)) {
      for (const sel of selectors.split(',')) {
        expect(sel.trim().startsWith(`.${MEMO_SCOPE}`)).toBe(true);
      }
    }
  });

  test('body and * map onto the container itself', () => {
    const out = scopeMemoCss('body { margin: 0; } * { box-sizing: border-box; }', 'm');
    expect(out).toMatch(/\.m \{\s*margin: 0;/);
    expect(out).toMatch(/\.m, \.m \* \{\s*box-sizing: border-box;/);
    expect(out).not.toMatch(/(^|\})\s*(body|\*)\s*\{/);
  });

  test('a section title in the capture node actually computes as styled', () => {
    const container = document.createElement('div');
    container.className = MEMO_SCOPE;
    container.innerHTML = memoCaptureMarkup(html);
    document.body.appendChild(container);
    const title = container.querySelector('.section-title');
    expect(title).not.toBeNull();
    expect(getComputedStyle(title).textTransform).toBe('uppercase');
    document.body.removeChild(container);
  });

  test('the download handler uses the scoped markup', () => {
    const src = require('fs').readFileSync(__dirname + '/ExportPanel.js', 'utf8');
    expect(src).toMatch(/container\.innerHTML = memoCaptureMarkup\(html\)/);
  });
});

// ---------------------------------------------------------------
// html2canvas 1.4.1 throws on oklch(), Tailwind 4's colour format, so
// every download fell back to the print window and no memo snapshot was
// ever stored. The clone it renders must carry only the memo's styles.
// ---------------------------------------------------------------
describe('the PDF clone carries no app stylesheet', () => {
  function clonedDoc() {
    const doc = document.implementation.createHTMLDocument('clone');
    doc.head.innerHTML = `
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans">
      <link rel="stylesheet" href="/static/css/main.abc123.css">
      <style>:root { --color-gray-200: oklch(92.8% 0.006 264.531); }</style>`;
    doc.body.innerHTML = `<div class="${MEMO_SCOPE}"><style>.${MEMO_SCOPE} .section-title { color: #1e293b; }</style><div class="section-title">Deal Overview</div></div>`;
    return doc;
  }

  test('removes app CSS, keeps the web font and the memo stylesheet', () => {
    const doc = clonedDoc();
    stripAppStylesForCapture(doc);
    const css = [...doc.querySelectorAll('style')].map((s) => s.textContent).join('');
    expect(css).not.toContain('oklch');
    expect(css).toContain(`.${MEMO_SCOPE} .section-title`);
    const hrefs = [...doc.querySelectorAll('link[rel="stylesheet"]')].map((l) => l.getAttribute('href'));
    expect(hrefs).toEqual(['https://fonts.googleapis.com/css2?family=IBM+Plex+Sans']);
  });

  test('the download handler strips the clone before html2canvas parses it', () => {
    const src = require('fs').readFileSync(__dirname + '/ExportPanel.js', 'utf8');
    expect(src).toMatch(/onclone: \(doc\) => stripAppStylesForCapture\(doc\)/);
  });

  test('the captured node is in flow, so the clone has a height', () => {
    // html2pdf deep-clones this node into its own container. A fixed or
    // absolute node measures zero high there, which printed one blank page.
    const src = require('fs').readFileSync(__dirname + '/ExportPanel.js', 'utf8');
    expect(src).toMatch(/wrapper\.style\.position = 'fixed'/);
    expect(src).not.toMatch(/container\.style\.position/);
    expect(src).toMatch(/\.from\(container\)/);
  });
});

// html2pdf renders the whole memo to one canvas and slices it at fixed page
// heights, so a block with no rule is cut wherever the boundary happens to
// fall. Layout is not testable here, but the rules that drive it are, and
// getting them wrong is invisible until someone opens the PDF.
describe('the memo paginates without cutting anything in half', () => {
  const memos = [
    ['equipment finance', 'equipment_finance', ef, { ...EF_INITIAL, companyName: 'EF Test Co', annualRevenue: 38400000, priorYearRevenue: 34900000, ebitda: 7400000, priorYearEbitda: 6600000, yearsInBusiness: 16, totalExistingDebt: 14200000, equipmentCost: 6275000, downPayment: 941250, usefulLife: 12, loanTerm: 84, industrySector: 'Mining' }],
    ['accounts receivable', 'accounts_receivable', ar, { ...AR_INITIAL, companyName: 'AR Test Co', annualRevenue: 42000000, ebitda: 5200000, yearsInBusiness: 14, totalExistingDebt: 11000000 }],
    ['inventory finance', 'inventory_finance', inv, { ...INV_INITIAL, companyName: 'Inv Test Co', annualRevenue: 51000000, ebitda: 6800000, yearsInBusiness: 19, totalExistingDebt: 13000000 }],
  ];

  test.each(memos)('%s keeps every block whole', (_label, key, mod, inputs) => {
    const html = buildPdfFor(key, mod, inputs);
    expect(html).toContain('.page > div, .section, .keep-together { page-break-inside: avoid; break-inside: avoid; }');
    expect(html).toContain('tr { page-break-inside: avoid; break-inside: avoid; }');
  });

  test.each(memos)('%s forces no page break', (_label, key, mod, inputs) => {
    // A forced break throws away whatever is left of the page it leaves
    // behind. Strengths & Risks carried one, and that is what left page 2
    // of the equipment memo half empty.
    const html = buildPdfFor(key, mod, inputs);
    expect(html).not.toMatch(/page-break-before\s*:\s*always/);
    expect(html).not.toMatch(/break-before\s*:\s*(always|page)/);
  });

  test.each(memos)('%s keeps the footer with the documents it cites', (_label, key, mod, inputs) => {
    // Apart, the boundary landed between them on the inventory memo and the
    // last page carried nothing but the disclaimer.
    const html = buildPdfFor(key, mod, inputs);
    const wrapper = html.indexOf('<div class="keep-together">');
    // The section title, not the bare words: those also appear in the
    // comment that explains why the wrapper is there.
    const sources = html.indexOf('<div class="section-title">Source Documents</div>');
    const footer = html.indexOf('Preliminary screening only');
    expect(wrapper).toBeGreaterThan(-1);
    expect(sources).toBeGreaterThan(wrapper);
    expect(footer).toBeGreaterThan(sources);
  });

  test('the pagination rules survive being scoped for capture', () => {
    // scopeMemoCss rewrites every selector. If it mangled these the rules
    // would silently stop applying inside the capture container, which is
    // the only place they matter.
    const html = buildPdfFor('equipment_finance', ef, { ...EF_INITIAL, companyName: 'EF Test Co', annualRevenue: 38400000, ebitda: 7400000, equipmentCost: 6275000, usefulLife: 12, loanTerm: 84 });
    const css = scopeMemoCss(html.match(/<style[^>]*>([\s\S]*?)<\/style>/)[1]);
    expect(css).toContain(`.${MEMO_SCOPE} .page > div`);
    expect(css).toContain(`.${MEMO_SCOPE} .keep-together`);
    expect(css).toContain(`.${MEMO_SCOPE} tr`);
  });
});

describe('scopeMemoCss', () => {
  test('a comment containing a comma does not become a selector', () => {
    // The rule matcher reads everything up to a brace as a selector list and
    // splits it on commas. A comment sitting above a rule was therefore
    // scoped as prose and the rule beneath it was left unscoped, so it
    // stopped applying inside the capture container.
    const css = `
      /* One rule, two rules, three rules. */
      .page > div { color: red; }
    `;
    const out = scopeMemoCss(css);
    expect(out).toContain(`.${MEMO_SCOPE} .page > div`);
    expect(out).not.toContain('three rules');
    expect(out).not.toMatch(/\/\*/);
  });

  test('a comma-separated selector list is still scoped in full', () => {
    const out = scopeMemoCss('.a, .b > i { color: red; }');
    expect(out).toContain(`.${MEMO_SCOPE} .a`);
    expect(out).toContain(`.${MEMO_SCOPE} .b > i`);
  });
});

describe('the last line of the memo survives the page slice', () => {
  test('the page reserves slack below its final element', () => {
    // html2pdf slices the canvas at page boundaries and the final cut lands
    // a pixel or two inside the content box. The footer's disclaimer ended
    // 1px from that edge, so its descenders were shaved in the PDF. Without
    // slack here, a rounding error costs letters instead of white space.
    const html = buildPdfFor('equipment_finance', ef, {
      ...EF_INITIAL, companyName: 'EF Test Co', annualRevenue: 50_000_000,
      ebitda: 2_000_000, equipmentCost: 5_000_000, usefulLife: 15, loanTerm: 84,
    });
    const rule = html.match(/\.page \{[^}]*\}/);
    expect(rule).not.toBeNull();
    const padding = rule[0].match(/padding:\s*0\s+0\s+(\d+)px\s+0/);
    expect(padding).not.toBeNull();
    expect(Number(padding[1])).toBeGreaterThanOrEqual(8);
  });
});
