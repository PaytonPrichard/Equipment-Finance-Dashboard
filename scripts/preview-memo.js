#!/usr/bin/env node
/* eslint-disable */
// ============================================================
// Render the committee memo to an HTML file you can open.
//
//   node scripts/preview-memo.js               # Granite Ridge, equipment
//   node scripts/preview-memo.js accounts_receivable
//   node scripts/preview-memo.js inventory_finance
//
// Structural tests prove the sections exist. They cannot see a section
// running off the page, a table overflowing its column, or two blocks
// colliding at a page break. This renders the real generator output so you
// can look at it.
//
// Writes to outputs/memo-preview-<module>.html, which is gitignored.
// ============================================================

const fs = require('fs');
const path = require('path');

// The generator is ESM/JSX under CRA. esbuild is already a devDependency and
// already used by scripts/build-scoring.js for the same reason.
const esbuild = require('esbuild');

const REPO = path.join(__dirname, '..');
const OUT_DIR = path.join(REPO, 'outputs');

const MODULE_KEY = process.argv[2] || 'equipment_finance';

const FIXTURES = {
  equipment_finance: {
    label: 'Equipment Finance',
    modulePath: 'src/modules/equipment-finance/scoring.ts',
    constantsPath: 'src/modules/equipment-finance/constants.ts',
    inputs: {
      companyName: 'Granite Ridge Materials LLC',
      annualRevenue: 38400000,
      priorYearRevenue: 34900000,
      ebitda: 7400000,
      priorYearEbitda: 6600000,
      yearsInBusiness: 16,
      totalExistingDebt: 14200000,
      actualAnnualDebtService: 2310000,
      maintenanceCapex: 1850000,
      cashOnHand: 2650000,
      availableLiquidity: 4000000,
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
    },
    sourceDocuments: [
      { fileName: '01_credit-application.pdf', documentType: 'Credit application', addedOn: 'Sep 1, 2026' },
      { fileName: '02_financial-statements.pdf', documentType: 'Financial statements', addedOn: 'Sep 1, 2026' },
      { fileName: '03_equipment-quote.pdf', documentType: 'Equipment quote', addedOn: 'Sep 1, 2026' },
      { fileName: '04_broker-email.txt', documentType: 'Deal sheet', addedOn: 'Sep 1, 2026' },
    ],
  },
  accounts_receivable: {
    label: 'Accounts Receivable',
    modulePath: 'src/modules/accounts-receivable/scoring.ts',
    constantsPath: 'src/modules/accounts-receivable/constants.ts',
    inputs: {
      companyName: 'Atlas Industrial Supply LLC',
      annualRevenue: 42000000, priorYearRevenue: 38500000,
      ebitda: 5200000, priorYearEbitda: 4700000,
      yearsInBusiness: 14, totalExistingDebt: 11000000,
      actualAnnualDebtService: 1850000, cashOnHand: 1900000,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      totalAROutstanding: 12000000, requestedAdvanceRate: 85,
      arUnder30: 65, arOver30: 22, arOver60: 9, arOver90: 4,
      topCustomerConcentration: 18, dilutionRate: 3.2, ineligiblesPct: 12,
      existingABLFacility: true,
    },
    sourceDocuments: [],
  },
  inventory_finance: {
    label: 'Inventory Finance',
    modulePath: 'src/modules/inventory-finance/scoring.ts',
    constantsPath: 'src/modules/inventory-finance/constants.ts',
    inputs: {
      companyName: 'Cascade Outdoor Brands Inc.',
      annualRevenue: 51000000, priorYearRevenue: 46000000,
      ebitda: 6800000, priorYearEbitda: 5900000,
      yearsInBusiness: 19, totalExistingDebt: 16500000,
      actualAnnualDebtService: 2400000, cashOnHand: 2200000,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      totalInventory: 14000000, requestedAdvanceRate: 55,
      rawMaterials: 25, workInProgress: 15, finishedGoods: 60,
      obsoleteInventory: 6, inventoryTurnover: 5.2, averageDaysOnHand: 70,
      nolvPct: 58, perishable: false,
    },
    sourceDocuments: [],
  },
};

const fixture = FIXTURES[MODULE_KEY];
if (!fixture) {
  console.error(`Unknown module "${MODULE_KEY}". Try: ${Object.keys(FIXTURES).join(', ')}`);
  process.exit(1);
}

async function bundle(entry, globalName) {
  const result = await esbuild.build({
    entryPoints: [path.join(REPO, entry)],
    bundle: true,
    write: false,
    format: 'cjs',
    platform: 'node',
    target: 'node18',
    loader: { '.js': 'jsx', '.ts': 'ts', '.tsx': 'tsx', '.json': 'json' },
    external: ['react', 'react-dom'],
    logLevel: 'silent',
  });
  const code = result.outputFiles[0].text;
  const mod = { exports: {} };
  // eslint-disable-next-line no-new-func
  new Function('module', 'exports', 'require', code)(mod, mod.exports, require);
  return mod.exports;
}

(async () => {
  const scoring = await bundle(fixture.modulePath);
  const constants = await bundle(fixture.constantsPath);
  const panel = await bundle('src/components/ExportPanel.js');
  const criteriaMod = await bundle('src/lib/screeningCriteria.ts');
  const borrower = await bundle('src/utils/borrowerMetrics.js');

  const inputs = { ...constants.INITIAL_INPUTS, ...fixture.inputs };
  const criteria = criteriaMod.DEFAULT_CRITERIA;

  const metrics = scoring.calculateMetrics(inputs);
  const riskScore = scoring.calculateRiskScore(inputs, metrics);
  const recommendation = scoring.getRecommendation(riskScore.composite);
  const commentary = scoring.generateCommentary(inputs, metrics, riskScore, criteria);
  const structure = scoring.getSuggestedStructure(inputs, metrics, riskScore.composite);
  const stressResults = scoring.runStressTest(inputs);
  const factors = scoring.describeFactors(inputs, metrics, riskScore);
  const summaryText = scoring.generateExportSummary(
    inputs, metrics, riskScore, recommendation, commentary, structure, undefined, criteria,
  );
  const screeningResult = criteriaMod.evaluateScreening(
    criteria, metrics, riskScore, inputs, MODULE_KEY,
  );
  const borrowerExtras = borrower.computeBorrowerExtras(inputs, metrics);

  const html = panel.generateBrandedPdfHtml({
    summaryText, inputs, metrics, riskScore, recommendation, screeningResult,
    orgName: 'Keystone Credit Partners', analystName: 'J. Peter',
    moduleLabel: fixture.label, branding: {}, factors, structure, stressResults,
    moduleKey: MODULE_KEY, borrowerExtras, criteria,
    commentary, sourceDocuments: fixture.sourceDocuments,
  });

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const out = path.join(OUT_DIR, `memo-preview-${MODULE_KEY}.html`);
  fs.writeFileSync(out, html, 'utf-8');

  console.log(`Score ${riskScore.composite}/100, verdict ${screeningResult.verdict}`);
  console.log(`Wrote ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
