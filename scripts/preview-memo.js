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

// App.js stamps the day the documents were read. Matching it here keeps
// the preview honest: the fixture used to say Sep 1 forever, so the memo
// looked like it had been written weeks after anyone opened the file.
const READ_ON = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

const MODULE_KEY = process.argv[2] || 'equipment_finance';

// US letter at 96dpi, with the margins the PDF actually uses.
const PAGE_W = 816;        // 8.5in
const PAD_X = 76.8;        // 0.8in
const PAD_Y = 67.2;        // 0.7in
const CONTENT_H = 921.6;   // 11in less the top and bottom margins

/**
 * Wrap the memo in a letter-sized sheet.
 *
 * Without this the file is the bare memo, and a browser lays it out at
 * whatever the window happens to be. At 1900px wide every table stretches
 * edge to edge, currency columns sit a hand's width from their labels, and
 * the whole thing reads as badly designed. It is not: it is designed for a
 * 662px column and never gets to be one here.
 *
 * So: true page width, true margins, and a dashed rule wherever a page
 * break will fall, which is the thing you actually want to check.
 */
function asSheet(html) {
  const style = `
  <style>
    html, body { background: #6b7280; margin: 0; padding: 36px 0; }
    .preview-note {
      width: ${PAGE_W}px; margin: 0 auto 12px; color: #f3f4f6;
      font: 12px/1.5 -apple-system, Segoe UI, Roboto, sans-serif;
    }
    .preview-note b { color: #fff; }
    .sheet {
      width: ${PAGE_W}px; margin: 0 auto; background: #fff; position: relative;
      padding: ${PAD_Y}px ${PAD_X}px; box-shadow: 0 2px 24px rgba(0,0,0,0.4);
    }
    .sheet-guides {
      position: absolute; left: 0; right: 0; top: ${PAD_Y}px; bottom: 0;
      pointer-events: none;
      background: repeating-linear-gradient(
        to bottom,
        transparent 0, transparent ${CONTENT_H - 1}px,
        rgba(225,29,72,0.5) ${CONTENT_H - 1}px, rgba(225,29,72,0.5) ${CONTENT_H}px
      );
    }
  </style>`;

  // Paginate the preview the way html2pdf paginates the PDF.
  //
  // Drawing rules every ${CONTENT_H}px onto the raw flow shows where the
  // boundary WOULD fall if nothing were protected, which is not what gets
  // printed: html2pdf reads break-inside per element and inserts a spacer to
  // push anything that would be cut. Without this the preview drew a line
  // through the middle of Deal Overview, a break the real PDF does not have.
  //
  // Same algorithm, same order, so the rules and the content agree.
  const paginate = `<script>
    (function () {
      var PAGE = ${CONTENT_H};
      var sheet = document.querySelector('.sheet');
      // Measure from the content element, not from the sheet plus its
      // padding. The padding is fractional (0.7in is 67.2px), so deriving
      // the origin arithmetically put the first block at -0.5px, which
      // floors to page -1 and reads as straddling. The whole memo got
      // pushed down a page before its own header.
      var content = sheet.querySelector('.page') || sheet;
      var base = content.getBoundingClientRect().top + window.scrollY;
      var els = [].slice.call(sheet.querySelectorAll('*'));
      for (var i = 0; i < els.length; i++) {
        var el = els[i];
        if (el.className === 'sheet-guides') continue;
        var cs = getComputedStyle(el);
        if (cs.breakInside !== 'avoid' && cs.pageBreakInside !== 'avoid') continue;
        var r = el.getBoundingClientRect();
        var top = r.top + window.scrollY - base;
        var bot = r.bottom + window.scrollY - base;
        if (Math.floor(top / PAGE) === Math.floor(bot / PAGE)) continue;
        if ((bot - top) / PAGE > 1) continue;
        var pad = document.createElement('div');
        pad.style.display = 'block';
        pad.style.height = (PAGE - (top % PAGE)) + 'px';
        el.parentNode.insertBefore(pad, el);
      }
      var pages = Math.ceil((sheet.scrollHeight - ${PAD_Y} * 2) / PAGE);
      document.querySelector('.preview-note').innerHTML +=
        ' &middot; <b>' + pages + ' pages</b>';
    })();
  <\/script>`;

  const note = `<div class="preview-note">Letter, at true size. <b>Dashed red</b> is where a page break falls.</div>`;
  const body = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  const inner = body ? body[1] : html;
  return html
    .replace(/<\/head>/i, `${style}</head>`)
    .replace(/<body[^>]*>[\s\S]*<\/body>/i, `<body>${note}<div class="sheet"><div class="sheet-guides"></div>${inner}</div>${paginate}</body>`);
}

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
      { fileName: '01_credit-application.pdf', documentType: 'Credit application', addedOn: READ_ON },
      { fileName: '02_financial-statements.pdf', documentType: 'Financial statements', addedOn: READ_ON },
      { fileName: '03_equipment-quote.pdf', documentType: 'Equipment quote', addedOn: READ_ON },
      { fileName: '04_broker-email.txt', documentType: 'Deal sheet', addedOn: READ_ON },
    ],
  },
  accounts_receivable: {
    label: 'Accounts Receivable',
    modulePath: 'src/modules/accounts-receivable/scoring.ts',
    constantsPath: 'src/modules/accounts-receivable/constants.ts',
    // Matches test-deal-sheets/accounts-receivable/atlas-industrial-multidoc.
    inputs: {
      companyName: 'Atlas Industrial Supply LLC',
      annualRevenue: 42000000, priorYearRevenue: 38500000,
      ebitda: 5200000, priorYearEbitda: 4700000,
      yearsInBusiness: 14, totalExistingDebt: 11000000,
      actualAnnualDebtService: 1850000, cashOnHand: 1900000,
      availableLiquidity: 2500000,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      totalAROutstanding: 12000000, requestedAdvanceRate: 85,
      arUnder30: 65, arOver30: 22, arOver60: 9, arOver90: 4,
      topCustomerConcentration: 18, dilutionRate: 3.2, ineligiblesPct: 12,
      existingABLFacility: true,
    },
    sourceDocuments: [
      { fileName: '01_credit-application.pdf', documentType: 'Credit application', addedOn: READ_ON },
      { fileName: '02_ar-aging.pdf', documentType: 'AR aging report', addedOn: READ_ON },
      { fileName: '03_borrowing-base-certificate.pdf', documentType: 'Borrowing base certificate', addedOn: READ_ON },
      { fileName: '04_customer-concentration.pdf', documentType: 'AR aging report', addedOn: READ_ON },
    ],
  },
  inventory_finance: {
    label: 'Inventory Finance',
    modulePath: 'src/modules/inventory-finance/scoring.ts',
    constantsPath: 'src/modules/inventory-finance/constants.ts',
    // Matches test-deal-sheets/inventory/cascade-outdoor-multidoc.
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
    sourceDocuments: [
      { fileName: '01_credit-application.pdf', documentType: 'Credit application', addedOn: READ_ON },
      { fileName: '02_inventory-report.pdf', documentType: 'Financial statements', addedOn: READ_ON },
      { fileName: '03_nolv-appraisal.pdf', documentType: 'Appraisal', addedOn: READ_ON },
      { fileName: '04_broker-email.txt', documentType: 'Deal sheet', addedOn: READ_ON },
    ],
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
  fs.writeFileSync(out, asSheet(html), 'utf-8');

  console.log(`Score ${riskScore.composite}/100, verdict ${screeningResult.verdict}`);
  console.log(`Wrote ${out}`);
})().catch((e) => { console.error(e); process.exit(1); });
