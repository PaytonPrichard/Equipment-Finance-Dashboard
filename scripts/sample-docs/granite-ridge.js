// ============================================================
// Granite Ridge Materials LLC — equipment finance, four documents.
//
// The multi-document scenario. One deal spread across a credit
// application, reviewed financials, a dealer quote, and a broker's
// cover email, the way a deal actually arrives.
//
// Hazards deliberately planted:
//   1. CONFLICT — the broker email states EBITDA "just under 7.9MM";
//      the financial statements state 7,400,000. The merge must take
//      the financial statement and must say so.
//   2. UNITS — the term is written "7 years" in prose; the field is months.
//   3. DERIVED — the founding year is given, not years in business.
//   4. ABSENCE — no document states a credit rating. It must come back
//      blank, not guessed.
// ============================================================

const { page, usd } = require('./_shared');

const TRUTH = {
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
  // A fixed aggregate processing plant maps to Construction Equipment
  // (8-15 yr life) rather than Heavy Machinery (10-20 yr). Both are
  // defensible; all three documents read as Construction Equipment
  // independently, and the stated 12-year life sits centrally in that band.
  equipmentType: 'Construction Equipment',
  equipmentCondition: 'New',
  equipmentCost: 6275000,
  downPayment: 941250,
  financingType: 'EFA',
  usefulLife: 12,
  loanTerm: 84,
  essentialUse: true,
};

// ---- 01. Credit application ----

const creditApplication = page({
  title: 'Granite Ridge — Credit Application',
  letterhead: {
    name: 'COMMERCIAL EQUIPMENT FINANCE APPLICATION',
    meta: 'Received 14 August 2026 &nbsp;&middot;&nbsp; File No. GRM-2608-114',
  },
  body: `
  <h2>Applicant</h2>
  <table class="kv">
    <tr><td>Legal name</td><td>Granite Ridge Materials LLC</td></tr>
    <tr><td>Entity type</td><td>Limited liability company (Pennsylvania)</td></tr>
    <tr><td>Year founded</td><td>2010</td></tr>
    <tr><td>Principal business</td><td>Crushed stone and construction aggregate production</td></tr>
    <tr><td>Facilities</td><td>Two active quarries, Blair and Huntingdon Counties, PA</td></tr>
    <tr><td>Employees</td><td>142 full time, 21 seasonal</td></tr>
  </table>

  <h2>Request</h2>
  <table class="kv">
    <tr><td>Purpose</td><td>Acquisition of a replacement primary crushing and screening plant</td></tr>
    <tr><td>Equipment cost</td><td>${usd(6275000)}</td></tr>
    <tr><td>Applicant contribution</td><td>${usd(941250)} (15%)</td></tr>
    <tr><td>Amount requested</td><td>${usd(5333750)}</td></tr>
    <tr><td>Structure requested</td><td>Equipment finance agreement, applicant takes title at closing</td></tr>
  </table>

  <h2>Existing Obligations</h2>
  <p>As of 30 June 2026 the applicant carries ${usd(14200000)} of funded debt across a term
  loan, two equipment notes, and capitalized lease obligations. Annual debt service on these
  obligations is ${usd(2310000)}. The applicant maintains a ${usd(6000000)} revolving line
  with First Keystone Bank, drawn ${usd(2000000)} at the date of this application.</p>

  <h2>Statement of Use</h2>
  <p>The plant subject to this application is the applicant's primary crushing asset. All
  saleable production at the Blair County quarry passes through it. The unit being replaced
  has reached the end of its service life and is the binding constraint on throughput. The
  applicant cannot produce salable aggregate at that site without it. Downtime is not
  absorbable through the Huntingdon site, which runs a different product mix.</p>

  <h2>Certification</h2>
  <p>The undersigned certifies the information above is accurate to the best of their
  knowledge.</p>
  <p style="margin-top:22px">_______________________________<br>
  Dana Whitfield, Chief Financial Officer<br>
  Granite Ridge Materials LLC</p>
  `,
});

// ---- 02. Financial statements ----

const financialStatements = page({
  title: 'Granite Ridge — Financial Statements',
  letterhead: {
    name: 'GRANITE RIDGE MATERIALS LLC',
    meta: 'Reviewed Financial Statements &nbsp;&middot;&nbsp; Fiscal Years Ended 31 December 2025 and 2024 &nbsp;&middot;&nbsp; Prepared by Aldridge and Coyle CPAs',
  },
  body: `
  <h1>Statements of Operations</h1>
  <table>
    <thead><tr><th>(in dollars)</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
    <tbody>
      <tr><td>Aggregate sales</td><td>35,120,000</td><td>32,010,000</td></tr>
      <tr><td>Hauling and delivery revenue</td><td>3,280,000</td><td>2,890,000</td></tr>
      <tr class="total"><td>Total revenue</td><td>38,400,000</td><td>34,900,000</td></tr>
      <tr><td>Cost of sales, excluding depreciation</td><td>(24,180,000)</td><td>(22,410,000)</td></tr>
      <tr><td>Selling, general and administrative</td><td>(6,820,000)</td><td>(5,890,000)</td></tr>
      <tr class="total"><td>EBITDA</td><td>7,400,000</td><td>6,600,000</td></tr>
      <tr><td>Depreciation, depletion and amortization</td><td>(3,940,000)</td><td>(3,610,000)</td></tr>
      <tr><td>Interest expense</td><td>(1,180,000)</td><td>(1,090,000)</td></tr>
      <tr class="total"><td>Income before taxes</td><td>2,280,000</td><td>1,900,000</td></tr>
    </tbody>
  </table>
  <p class="note">EBITDA is presented before non-recurring items. No adjustments or addbacks
  have been applied to either period.</p>

  <h1>Balance Sheet Data</h1>
  <table>
    <thead><tr><th>(in dollars)</th><th>31 Dec 2025</th><th>31 Dec 2024</th></tr></thead>
    <tbody>
      <tr><td>Cash and cash equivalents</td><td>2,650,000</td><td>2,120,000</td></tr>
      <tr><td>Accounts receivable, net</td><td>5,410,000</td><td>4,980,000</td></tr>
      <tr><td>Inventories</td><td>3,190,000</td><td>2,940,000</td></tr>
      <tr class="sub"><td>Total current assets</td><td>11,780,000</td><td>10,530,000</td></tr>
      <tr><td>Property, plant and equipment, net</td><td>28,640,000</td><td>27,110,000</td></tr>
      <tr><td>Mineral rights and reserves, net</td><td>9,220,000</td><td>9,540,000</td></tr>
      <tr class="total"><td>Total assets</td><td>49,640,000</td><td>47,180,000</td></tr>
      <tr><td>Accounts payable and accrued liabilities</td><td>4,120,000</td><td>3,860,000</td></tr>
      <tr><td>Current portion of long-term debt</td><td>2,310,000</td><td>2,140,000</td></tr>
      <tr><td>Long-term debt, net of current portion</td><td>11,890,000</td><td>12,020,000</td></tr>
      <tr class="total"><td>Total funded debt</td><td>14,200,000</td><td>14,160,000</td></tr>
    </tbody>
  </table>

  <h1>Supplemental Data</h1>
  <table class="kv">
    <tr><td>Annual debt service, existing obligations</td><td>${usd(2310000)}</td></tr>
    <tr><td>Maintenance capital expenditure, FY 2025</td><td>${usd(1850000)}</td></tr>
    <tr><td>Growth capital expenditure, FY 2025</td><td>${usd(2790000)}</td></tr>
    <tr><td>Undrawn revolving credit availability at year end</td><td>${usd(4000000)}</td></tr>
  </table>
  <p class="note">Maintenance capital expenditure represents replacement and overhaul of
  existing production assets. Growth capital expenditure is excluded from that figure.</p>
  `,
});

// ---- 03. Dealer equipment quote ----

const equipmentQuote = page({
  title: 'Granite Ridge — Equipment Quotation',
  letterhead: {
    name: 'KEYSTONE AGGREGATE SYSTEMS, INC.',
    meta: 'Authorized Dealer &nbsp;&middot;&nbsp; 4180 Industrial Parkway, Altoona, PA &nbsp;&middot;&nbsp; Quotation 26-QT-3391',
  },
  body: `
  <table class="kv">
    <tr><td>Quotation date</td><td>28 July 2026</td></tr>
    <tr><td>Prepared for</td><td>Granite Ridge Materials LLC, Blair County Quarry</td></tr>
    <tr><td>Quotation valid through</td><td>26 September 2026</td></tr>
    <tr><td>Condition</td><td>New, factory build, never placed in service</td></tr>
  </table>

  <h2>Equipment</h2>
  <table>
    <thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Extended</th></tr></thead>
    <tbody>
      <tr><td>Primary jaw crusher, 48x42, skid mounted</td><td>1</td><td>2,180,000</td><td>2,180,000</td></tr>
      <tr><td>Secondary cone crusher, 400 hp</td><td>1</td><td>1,540,000</td><td>1,540,000</td></tr>
      <tr><td>Triple-deck inclined screen, 8x20</td><td>2</td><td>486,000</td><td>972,000</td></tr>
      <tr><td>Conveyor package, 6 units, 36 in.</td><td>1</td><td>735,000</td><td>735,000</td></tr>
      <tr><td>Switchgear, motor control center, wiring</td><td>1</td><td>412,000</td><td>412,000</td></tr>
      <tr><td>Installation, commissioning, operator training</td><td>1</td><td>436,000</td><td>436,000</td></tr>
      <tr class="total"><td colspan="3">Total delivered and installed</td><td>6,275,000</td></tr>
    </tbody>
  </table>

  <h2>Terms</h2>
  <table class="kv">
    <tr><td>Deposit due at order</td><td>${usd(941250)}</td></tr>
    <tr><td>Balance due at commissioning</td><td>${usd(5333750)}</td></tr>
    <tr><td>Delivery</td><td>18 to 22 weeks from order</td></tr>
    <tr><td>Warranty</td><td>24 months, parts and labor</td></tr>
  </table>

  <h2>Engineering Note</h2>
  <p>Design service life for this configuration is 12 years at the duty cycle described by
  the customer (single shift, seasonal operation, approximately 1,900 operating hours per
  year). Wear parts are consumable and excluded from that figure. The plant is skid mounted
  and relocatable between sites.</p>
  `,
});

// ---- 04. Broker cover email ----
// Plain text on purpose. Prose, abbreviations, and one wrong number.

const brokerEmail = [
  'From: Marc Delacroix <mdelacroix@havenbridgecapital.com>',
  'To: Credit Team',
  'Date: Fri, 21 Aug 2026 08:47',
  'Subject: Granite Ridge Materials - new crushing plant, ~$5.3MM request',
  '',
  'Team,',
  '',
  'Sending over Granite Ridge Materials for your look. Quarry operator out of central PA,',
  'two sites, been at it since 2010 so call it a decade and a half of operating history.',
  'Management is the same family that started it.',
  '',
  'The ask is a replacement primary crushing plant. Quote is attached, comes to 6.275MM',
  'all in delivered and installed. They are putting up 15% cash, so roughly 5.3MM of',
  'financing. They want a straight EFA, they want title, they are not interested in a',
  'fair market value structure.',
  '',
  'Financials attached as well. Topline just over 38MM last year against about 34.9MM the',
  'year prior, so call it 10% growth. EBITDA came in just under 7.9MM. Existing debt is',
  '14.2MM with annual service around 2.3MM. They keep about 2.65MM of cash and have 4MM',
  'undrawn on the First Keystone revolver.',
  '',
  'On term - they asked for 7 years. Dealer says the plant is good for 12 years at their',
  'duty cycle so there is real cushion there. This is the only primary crusher at the Blair',
  'County site, everything they sell out of that quarry goes through it, so it is about as',
  'essential as equipment gets.',
  '',
  'Happy to get you anything else. They are talking to one other shop so a quick read would',
  'help.',
  '',
  'Marc',
  '',
  '--',
  'Marc Delacroix | Havenbridge Capital Partners',
  'SAMPLE - SYNTHETIC DATA. Fictional borrower. Not a real credit file.',
  '',
].join('\n');

module.exports = {
  scenario: 'granite-ridge-multidoc',
  assetClass: 'equipment',
  moduleKey: 'equipment_finance',
  description:
    'Four documents, one deal. Cross-document EBITDA conflict, term stated in years, founding year instead of tenure, credit rating absent from every document.',
  truth: TRUTH,
  documents: [
    { file: '01_credit-application.pdf', html: creditApplication, documentType: 'credit_application' },
    { file: '02_financial-statements.pdf', html: financialStatements, documentType: 'financial_statement' },
    { file: '03_equipment-quote.pdf', html: equipmentQuote, documentType: 'equipment_quote' },
    { file: '04_broker-email.txt', text: brokerEmail, documentType: 'deal_sheet' },
  ],
  // What the merge must do when two documents disagree.
  expectedConflicts: [
    {
      field: 'ebitda',
      chosenFrom: '02_financial-statements.pdf',
      chosenValue: 7400000,
      alsoStated: [{ file: '04_broker-email.txt', value: 7900000 }],
      why: 'Reviewed financial statements outrank a broker summary for financial data.',
    },
  ],
  // Fields no document states. These must come back blank, not guessed.
  expectedAbsent: ['creditRating'],
};
