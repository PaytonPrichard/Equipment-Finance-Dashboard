// ============================================================
// Cascade Outdoor Brands Inc. — inventory finance, four documents.
//
// Same central hazard as the AR corpus, in its second shape: inventory
// composition is stored as PERCENTAGES and every perpetual inventory
// report states DOLLARS by category. On top of that, NOLV arrives from an
// appraisal as a dollar recovery figure and has to be expressed against
// book value.
//
// Other hazards planted:
//   - Obsolete stock overlaps the three stage categories rather than
//     sitting beside them, so raw plus WIP plus finished must still total
//     the inventory, and the sum check must not treat that as an error.
//   - Turnover is stated; days on hand is stated separately. Neither
//     should be derived from the other.
//   - "Not perishable" is stated explicitly, so the boolean is a real
//     reading rather than a default.
//   - Founding year, not tenure. No credit rating anywhere.
// ============================================================

const { page, usd } = require('./_shared');

const TRUTH = {
  companyName: 'Cascade Outdoor Brands Inc.',
  annualRevenue: 51000000,
  priorYearRevenue: 46000000,
  ebitda: 6800000,
  priorYearEbitda: 5900000,
  yearsInBusiness: 19,
  totalExistingDebt: 16500000,
  actualAnnualDebtService: 2400000,
  cashOnHand: 2200000,
  industrySector: 'Manufacturing',
  totalInventory: 14000000,
  requestedAdvanceRate: 55,
  // Stated in the inventory report as dollars against $14,000,000.
  rawMaterials: 25,        // 3,500,000
  workInProgress: 15,      // 2,100,000
  finishedGoods: 60,       // 8,400,000
  obsoleteInventory: 6,    //   840,000, overlapping the three above
  inventoryTurnover: 5.2,
  averageDaysOnHand: 70,
  nolvPct: 58,             // 8,120,000 recovery on 14,000,000 book
  perishable: false,
};

// ---- 01. Credit application ----

const creditApplication = page({
  title: 'Cascade Outdoor — Credit Application',
  letterhead: {
    name: 'INVENTORY REVOLVING FACILITY APPLICATION',
    meta: 'Received 19 August 2026 &nbsp;&middot;&nbsp; File No. COB-2608-088',
  },
  body: `
  <h2>Applicant</h2>
  <table class="kv">
    <tr><td>Legal name</td><td>Cascade Outdoor Brands Inc.</td></tr>
    <tr><td>Entity type</td><td>Corporation (Oregon)</td></tr>
    <tr><td>Year founded</td><td>2007</td></tr>
    <tr><td>Principal business</td><td>Manufacture of technical outerwear and pack systems</td></tr>
    <tr><td>Facilities</td><td>Manufacturing and distribution, Bend OR. Overflow warehouse, Reno NV.</td></tr>
    <tr><td>Channels</td><td>Wholesale to specialty retail (72%), direct to consumer (28%)</td></tr>
  </table>

  <h2>Request</h2>
  <table class="kv">
    <tr><td>Facility type</td><td>Revolving credit facility secured by inventory</td></tr>
    <tr><td>Requested advance rate</td><td>55% of eligible inventory</td></tr>
    <tr><td>Purpose</td><td>Fund the autumn and winter production build ahead of wholesale shipping</td></tr>
  </table>

  <h2>Existing Obligations</h2>
  <p>Total funded debt is ${usd(16500000)} across a term loan, an equipment note and
  capitalized leases, with annual debt service of ${usd(2400000)}. Cash and equivalents at
  the most recent month end were ${usd(2200000)}.</p>

  <h2>Financial Summary</h2>
  <p class="note">Prepared by management from internal statements.</p>
  <table>
    <thead><tr><th>(in dollars)</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
    <tbody>
      <tr><td>Net sales</td><td>51,000,000</td><td>46,000,000</td></tr>
      <tr><td>Cost of goods sold</td><td>(30,600,000)</td><td>(28,060,000)</td></tr>
      <tr><td>Operating expenses</td><td>(13,600,000)</td><td>(12,040,000)</td></tr>
      <tr class="total"><td>EBITDA</td><td>6,800,000</td><td>5,900,000</td></tr>
    </tbody>
  </table>

  <h2>Product Characteristics</h2>
  <p>Inventory consists of technical apparel, packs and hard goods. Product is not
  perishable and carries no expiry dating. Styling is refreshed on a two-year cycle, and
  prior-season product is cleared through outlet and direct channels rather than
  written off.</p>
  `,
});

// ---- 02. Perpetual inventory report. Dollars by category. ----

const inventoryReport = page({
  title: 'Cascade Outdoor — Inventory Report',
  letterhead: {
    name: 'CASCADE OUTDOOR BRANDS INC.',
    meta: 'Perpetual Inventory Summary &nbsp;&middot;&nbsp; At cost &nbsp;&middot;&nbsp; As of 31 July 2026',
  },
  body: `
  <h1>Inventory by Stage</h1>
  <table>
    <thead><tr><th>Category</th><th>Value at cost</th><th>SKUs</th></tr></thead>
    <tbody>
      <tr><td>Raw materials (fabric, hardware, trim)</td><td>3,500,000</td><td>412</td></tr>
      <tr><td>Work in progress</td><td>2,100,000</td><td>168</td></tr>
      <tr><td>Finished goods</td><td>8,400,000</td><td>1,046</td></tr>
      <tr class="total"><td>Total inventory at cost</td><td>14,000,000</td><td>1,626</td></tr>
    </tbody>
  </table>

  <h1>Reserves</h1>
  <table>
    <thead><tr><th>Category</th><th>Value at cost</th></tr></thead>
    <tbody>
      <tr><td>Obsolete and slow-moving (over 18 months on hand)</td><td>840,000</td></tr>
    </tbody>
  </table>
  <p class="note">Obsolete and slow-moving stock is identified across all three stage
  categories above and is not a separate stage. It is reserved against for reporting but
  remains in the totals shown.</p>

  <h1>Turnover</h1>
  <table class="kv">
    <tr><td>Cost of goods sold, trailing twelve months</td><td>${usd(30600000)}</td></tr>
    <tr><td>Average inventory at cost</td><td>${usd(5885000)}</td></tr>
    <tr><td>Inventory turnover</td><td>5.2 turns per year</td></tr>
    <tr><td>Average days on hand</td><td>70 days</td></tr>
  </table>
  `,
});

// ---- 03. NOLV appraisal excerpt ----

const appraisal = page({
  title: 'Cascade Outdoor — NOLV Appraisal',
  letterhead: {
    name: 'HARROW &amp; PIKE VALUATION SERVICES',
    meta: 'Net Orderly Liquidation Value Appraisal &nbsp;&middot;&nbsp; Cascade Outdoor Brands Inc. &nbsp;&middot;&nbsp; Field work completed 12 August 2026',
  },
  body: `
  <h2>Scope</h2>
  <p>Harrow &amp; Pike was engaged to estimate the net orderly liquidation value of the
  subject inventory. Field work comprised a physical test count at the Bend, Oregon
  facility, review of the perpetual inventory records at 31 July 2026, and analysis of
  comparable disposition results for technical outerwear.</p>

  <h2>Conclusion</h2>
  <table>
    <thead><tr><th>Category</th><th>Cost basis</th><th>Recovery</th><th>NOLV</th></tr></thead>
    <tbody>
      <tr><td>Raw materials</td><td>3,500,000</td><td>32%</td><td>1,120,000</td></tr>
      <tr><td>Work in progress</td><td>2,100,000</td><td>18%</td><td>378,000</td></tr>
      <tr><td>Finished goods, current season</td><td>6,300,000</td><td>82%</td><td>5,166,000</td></tr>
      <tr><td>Finished goods, prior season</td><td>2,100,000</td><td>69%</td><td>1,449,000</td></tr>
      <tr class="total"><td>Total</td><td>14,000,000</td><td></td><td>8,120,000</td></tr>
    </tbody>
  </table>

  <h2>Observations</h2>
  <p>Recovery on current-season finished goods is strong and reflects an established
  wholesale channel that would absorb inventory in an orderly wind-down. Work in progress
  recovers poorly, as partially assembled garments have limited value outside the
  applicant's own production process.</p>
  <p>The subject inventory is not perishable and has no expiry dating. Storage
  requirements are ordinary dry warehouse.</p>
  <p class="note">Costs of sale, including commission, transport and holding costs, have
  been deducted in arriving at the net figures above.</p>
  `,
});

// ---- 04. Broker cover email ----

const brokerEmail = [
  'From: Priya Raghunathan <praghunathan@stillwaterdebt.com>',
  'To: Credit Team',
  'Date: Thu, 27 Aug 2026 16:12',
  'Subject: Cascade Outdoor Brands - inventory revolver, seasonal build',
  '',
  'Hi all,',
  '',
  'Cascade Outdoor Brands for your review. Technical outerwear manufacturer out of Bend,',
  'Oregon, going since 2007. Wholesale into specialty retail with a growing DTC channel.',
  '',
  'They want an inventory revolver at 55% to fund the autumn and winter build. Inventory',
  'sits at 14MM at cost right now, split roughly a quarter raw, fifteen percent WIP and the',
  'balance finished goods. Harrow and Pike just finished the NOLV work and came out at',
  '8.12MM, which is a little over half of book.',
  '',
  'Topline 51MM last year against 46MM prior. EBITDA 6.8MM. Existing debt is 16.5MM with',
  'about 2.4MM of annual service.',
  '',
  'Turnover is 5.2x and days on hand around 70, which for seasonal outerwear is reasonable.',
  'Nothing perishable, no dating issues.',
  '',
  'Let me know what else you need.',
  '',
  'Priya',
  '',
  '--',
  'Priya Raghunathan | Stillwater Debt Advisors',
  'SAMPLE - SYNTHETIC DATA. Fictional borrower. Not a real credit file.',
  '',
].join('\n');

module.exports = {
  scenario: 'cascade-outdoor-multidoc',
  assetClass: 'inventory',
  moduleKey: 'inventory_finance',
  description:
    'Four documents for an inventory revolver. Composition is stated in dollars where the form stores percentages, NOLV arrives as a dollar recovery that has to be expressed against book value, and obsolete stock overlaps the three stage categories rather than sitting beside them.',
  truth: TRUTH,
  documents: [
    { file: '01_credit-application.pdf', html: creditApplication, documentType: 'credit_application' },
    { file: '02_inventory-report.pdf', html: inventoryReport, documentType: 'financial_statement' },
    { file: '03_nolv-appraisal.pdf', html: appraisal, documentType: 'appraisal' },
    { file: '04_broker-email.txt', text: brokerEmail, documentType: 'deal_sheet' },
  ],
  expectedConflicts: [],
  expectedAbsent: ['creditRating'],
};
