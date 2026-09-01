// ============================================================
// Atlas Industrial Supply LLC — accounts receivable, four documents.
//
// The AR corpus exists mainly to exercise one hazard, and it is the one
// that already reached production once: the form stores aging as
// PERCENTAGES, and every real aging report states DOLLARS. A model that
// copies "$2,640,000" into a field meaning "22%" produces a borrowing base
// wrong by five orders of magnitude that still looks plausible on screen.
//
// So nothing here states a percentage for the aging buckets. The model has
// to divide by the stated total. Ineligibles and NOLV-style figures are the
// same shape.
//
// Other hazards planted:
//   - Concentration lives in its own schedule, listed per customer, so the
//     largest has to be picked out rather than read off.
//   - Dilution is given as credits and gross billings, not as a rate.
//   - Founding year again, not tenure.
//   - No document states a credit rating.
// ============================================================

const { page, usd } = require('./_shared');

const TRUTH = {
  companyName: 'Atlas Industrial Supply LLC',
  annualRevenue: 42000000,
  priorYearRevenue: 38500000,
  ebitda: 5200000,
  priorYearEbitda: 4700000,
  yearsInBusiness: 14,
  totalExistingDebt: 11000000,
  actualAnnualDebtService: 1850000,
  cashOnHand: 1900000,
  availableLiquidity: 2500000,
  industrySector: 'Manufacturing',
  totalAROutstanding: 12000000,
  requestedAdvanceRate: 85,
  // Stated in the aging report as dollars against a $12,000,000 total.
  arUnder30: 65,   // 7,800,000
  arOver30: 22,    // 2,640,000
  arOver60: 9,     // 1,080,000
  arOver90: 4,     //   480,000
  topCustomerConcentration: 18,
  dilutionRate: 3.2,
  ineligiblesPct: 12,
  existingABLFacility: true,
};

// ---- 01. Credit application ----

const creditApplication = page({
  title: 'Atlas Industrial — Credit Application',
  letterhead: {
    name: 'ASSET-BASED REVOLVING FACILITY APPLICATION',
    meta: 'Received 3 August 2026 &nbsp;&middot;&nbsp; File No. AIS-2608-047',
  },
  body: `
  <h2>Applicant</h2>
  <table class="kv">
    <tr><td>Legal name</td><td>Atlas Industrial Supply LLC</td></tr>
    <tr><td>Entity type</td><td>Limited liability company (Ohio)</td></tr>
    <tr><td>Year founded</td><td>2012</td></tr>
    <tr><td>Principal business</td><td>Manufacture and distribution of industrial fasteners and fittings</td></tr>
    <tr><td>Facilities</td><td>Manufacturing plant, Twinsburg OH. Distribution centers, Twinsburg and Indianapolis.</td></tr>
    <tr><td>Employees</td><td>187 full time</td></tr>
  </table>

  <h2>Request</h2>
  <table class="kv">
    <tr><td>Facility type</td><td>Revolving credit facility secured by accounts receivable</td></tr>
    <tr><td>Requested advance rate</td><td>85% of eligible receivables</td></tr>
    <tr><td>Purpose</td><td>Refinance incumbent revolver, fund working capital through seasonal build</td></tr>
  </table>

  <h2>Existing Facilities</h2>
  <p>The applicant currently maintains an asset-based revolving credit facility with
  Midwest Commercial Bank, which this request would refinance. Total funded debt across
  the revolver, an equipment note and capitalized leases is ${usd(11000000)}, with annual
  debt service of ${usd(1850000)}. Undrawn availability under the incumbent facility at
  the date of this application was ${usd(2500000)}.</p>

  <h2>Financial Summary</h2>
  <p class="note">Prepared by management from internal statements. Audited statements
  available on request.</p>
  <table>
    <thead><tr><th>(in dollars)</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
    <tbody>
      <tr><td>Net sales</td><td>42,000,000</td><td>38,500,000</td></tr>
      <tr><td>Gross profit</td><td>13,440,000</td><td>12,127,000</td></tr>
      <tr><td>Operating expenses</td><td>(8,240,000)</td><td>(7,427,000)</td></tr>
      <tr class="total"><td>EBITDA</td><td>5,200,000</td><td>4,700,000</td></tr>
      <tr><td>Cash and cash equivalents at year end</td><td>1,900,000</td><td>1,640,000</td></tr>
    </tbody>
  </table>

  <h2>Certification</h2>
  <p style="margin-top:22px">_______________________________<br>
  Renata Oyelaran, Controller<br>
  Atlas Industrial Supply LLC</p>
  `,
});

// ---- 02. AR aging report. Dollars only, on purpose. ----

const agingReport = page({
  title: 'Atlas Industrial — AR Aging',
  letterhead: {
    name: 'ATLAS INDUSTRIAL SUPPLY LLC',
    meta: 'Accounts Receivable Aging Summary &nbsp;&middot;&nbsp; As of 31 July 2026 &nbsp;&middot;&nbsp; Generated from GL',
  },
  body: `
  <h1>Aging Summary</h1>
  <table>
    <thead><tr><th>Aging bucket</th><th>Balance</th><th>Invoices</th></tr></thead>
    <tbody>
      <tr><td>Current (0 to 30 days)</td><td>7,800,000</td><td>1,412</td></tr>
      <tr><td>31 to 60 days</td><td>2,640,000</td><td>486</td></tr>
      <tr><td>61 to 90 days</td><td>1,080,000</td><td>203</td></tr>
      <tr><td>Over 90 days</td><td>480,000</td><td>97</td></tr>
      <tr class="total"><td>Total accounts receivable</td><td>12,000,000</td><td>2,198</td></tr>
    </tbody>
  </table>
  <p class="note">Balances are gross, before ineligibility adjustments. See the borrowing
  base certificate for eligible collateral.</p>

  <h1>Dilution</h1>
  <table class="kv">
    <tr><td>Gross billings, trailing twelve months</td><td>${usd(43750000)}</td></tr>
    <tr><td>Credit memos issued</td><td>${usd(861000)}</td></tr>
    <tr><td>Returns and allowances</td><td>${usd(539000)}</td></tr>
    <tr><td>Total credits and adjustments</td><td>${usd(1400000)}</td></tr>
  </table>
  <p class="note">Credits and adjustments are stated against gross billings for the same
  trailing twelve-month period.</p>

  <h1>Collection Experience</h1>
  <table class="kv">
    <tr><td>Days sales outstanding, trailing twelve months</td><td>52 days</td></tr>
    <tr><td>Bad debt written off, FY 2025</td><td>${usd(112000)}</td></tr>
  </table>
  `,
});

// ---- 03. Borrowing base certificate ----

const borrowingBase = page({
  title: 'Atlas Industrial — Borrowing Base Certificate',
  letterhead: {
    name: 'BORROWING BASE CERTIFICATE',
    meta: 'Atlas Industrial Supply LLC &nbsp;&middot;&nbsp; Reporting period ended 31 July 2026 &nbsp;&middot;&nbsp; Certificate No. 41',
  },
  body: `
  <h1>Eligible Collateral</h1>
  <table>
    <thead><tr><th>Line</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Gross accounts receivable</td><td>12,000,000</td></tr>
      <tr class="sub"><td>Less: aged over 90 days</td><td>(480,000)</td></tr>
      <tr class="sub"><td>Less: cross-aged accounts</td><td>(312,000)</td></tr>
      <tr class="sub"><td>Less: contra accounts</td><td>(228,000)</td></tr>
      <tr class="sub"><td>Less: foreign and government obligors</td><td>(420,000)</td></tr>
      <tr class="total"><td>Total ineligible receivables</td><td>(1,440,000)</td></tr>
      <tr class="total"><td>Eligible accounts receivable</td><td>10,560,000</td></tr>
    </tbody>
  </table>

  <h1>Availability</h1>
  <table class="kv">
    <tr><td>Advance rate applied</td><td>85%</td></tr>
    <tr><td>Gross availability</td><td>${usd(8976000)}</td></tr>
    <tr><td>Less: dilution reserve</td><td>(${usd(287000)})</td></tr>
    <tr><td>Net availability</td><td>${usd(8689000)}</td></tr>
    <tr><td>Outstanding under the facility</td><td>${usd(6189000)}</td></tr>
    <tr><td>Excess availability</td><td>${usd(2500000)}</td></tr>
  </table>

  <p class="note">The undersigned certifies that the receivables listed above satisfy the
  eligibility criteria set out in the credit agreement.</p>
  <p style="margin-top:18px">_______________________________<br>
  Renata Oyelaran, Controller</p>
  `,
});

// ---- 04. Customer concentration schedule ----

const concentration = page({
  title: 'Atlas Industrial — Customer Concentration',
  letterhead: {
    name: 'ATLAS INDUSTRIAL SUPPLY LLC',
    meta: 'Customer Concentration Schedule &nbsp;&middot;&nbsp; Receivables outstanding at 31 July 2026',
  },
  body: `
  <table>
    <thead><tr><th>Customer</th><th>Receivable balance</th><th>Terms</th></tr></thead>
    <tbody>
      <tr><td>Keystone Rail Services</td><td>2,160,000</td><td>Net 45</td></tr>
      <tr><td>Delacourt Manufacturing Group</td><td>1,584,000</td><td>Net 30</td></tr>
      <tr><td>Bellweather Energy Partners</td><td>1,272,000</td><td>Net 60</td></tr>
      <tr><td>Halverson Fabrication</td><td>948,000</td><td>Net 30</td></tr>
      <tr><td>Northgate Utilities</td><td>744,000</td><td>Net 45</td></tr>
      <tr><td>All other customers (2,193 accounts)</td><td>5,292,000</td><td>Various</td></tr>
      <tr class="total"><td>Total accounts receivable</td><td>12,000,000</td><td></td></tr>
    </tbody>
  </table>
  <p class="note">No single customer other than those listed exceeds 2% of outstanding
  receivables. Keystone Rail Services has been a customer since 2016 and pays within terms.</p>
  `,
});

module.exports = {
  scenario: 'atlas-industrial-multidoc',
  assetClass: 'accounts-receivable',
  moduleKey: 'accounts_receivable',
  description:
    'Four documents for an ABL revolver. The aging report and the borrowing base certificate state dollars where the form stores percentages, which is the bug class that already reached production once. Concentration must be picked out of a per-customer schedule, dilution derived from credits against billings.',
  truth: TRUTH,
  documents: [
    { file: '01_credit-application.pdf', html: creditApplication, documentType: 'credit_application' },
    { file: '02_ar-aging.pdf', html: agingReport, documentType: 'ar_aging' },
    { file: '03_borrowing-base-certificate.pdf', html: borrowingBase, documentType: 'borrowing_base_certificate' },
    { file: '04_customer-concentration.pdf', html: concentration, documentType: 'ar_aging' },
  ],
  expectedConflicts: [],
  // No document characterizes credit quality, and none states EBITDA or
  // revenue: those live in financial statements this borrower did not
  // supply, which is realistic and tests that missing is reported as
  // missing rather than filled in.
  expectedAbsent: ['creditRating'],
};
