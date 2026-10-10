// ============================================================
// Ridgeline Freight & Logistics Inc. — equipment finance, two documents.
//
// Added 2026-10-09 to check the Trucking sector split (Trucking = high
// risk, Transportation/Logistics = moderate). The borrower is an
// asset-based truckload carrier, so the right sector is Trucking.
//
// Hazards deliberately planted:
//   1. SECTOR — "Logistics" is in the legal name and a small brokerage
//      arm (8% of revenue) is described. Both pull toward
//      Transportation/Logistics. The business is running 182 owned
//      tractors for hire, which is Trucking.
//   2. UNITS — the term is written "five years" in prose; the field is months.
//   3. DERIVED — the founding year is given, not years in business.
//   4. NOT STATED AS A VALUE — the down payment appears only as "10% of the
//      quoted price". Extraction must not compute it (AUDIT P1-18: copy
//      stated values, never derive), so it must come back blank.
//   5. ABSENCE — no document states a credit rating.
// ============================================================

const { page, usd } = require('./_shared');

const TRUTH = {
  companyName: 'Ridgeline Freight & Logistics Inc.',
  annualRevenue: 58600000,
  priorYearRevenue: 61200000,
  ebitda: 9100000,
  priorYearEbitda: 10400000,
  yearsInBusiness: 22,
  totalExistingDebt: 21500000,
  actualAnnualDebtService: 5900000,
  maintenanceCapex: 4200000,
  cashOnHand: 3100000,
  availableLiquidity: 4500000,
  industrySector: 'Trucking',
  equipmentType: 'Vehicles/Fleet',
  equipmentCondition: 'New',
  equipmentCost: 6600000,
  // downPayment: stated only as 10% of the quote, so expected blank (P1-18).
  financingType: 'TRAC',
  usefulLife: 7,
  loanTerm: 60,
  essentialUse: true,
};

// ---- 01. Credit application ----

const creditApplication = page({
  title: 'Ridgeline Freight — Credit Application',
  letterhead: {
    name: 'COMMERCIAL EQUIPMENT FINANCE APPLICATION',
    meta: 'Received 2 October 2026 &nbsp;&middot;&nbsp; File No. RFL-2610-022',
  },
  body: `
  <h2>Applicant</h2>
  <table class="kv">
    <tr><td>Legal name</td><td>Ridgeline Freight &amp; Logistics Inc.</td></tr>
    <tr><td>Entity type</td><td>Corporation (Missouri)</td></tr>
    <tr><td>Year founded</td><td>2004</td></tr>
    <tr><td>Principal business</td><td>For-hire truckload carrier. Dry van and temperature-controlled freight across the central United States.</td></tr>
    <tr><td>Fleet</td><td>182 company-owned Class 8 tractors, 465 trailers, 24 owner-operators under lease</td></tr>
    <tr><td>Other operations</td><td>A small freight brokerage desk arranges loads on third-party carriers when the fleet is at capacity. Brokerage was about 8% of FY 2025 revenue.</td></tr>
    <tr><td>Operating authority</td><td>USDOT and MC numbers on file. Satisfactory safety rating.</td></tr>
  </table>

  <h2>Request</h2>
  <table class="kv">
    <tr><td>Equipment</td><td>40 new Class 8 sleeper tractors (see dealer quote)</td></tr>
    <tr><td>Structure</td><td>TRAC lease, five years, with a terminal rental adjustment clause</td></tr>
    <tr><td>Down payment</td><td>10% of the quoted price at signing</td></tr>
    <tr><td>Purpose</td><td>Replace 2019 and 2020 model-year tractors at the end of their trade cycle</td></tr>
    <tr><td>Expected useful life</td><td>7 years in linehaul service</td></tr>
  </table>
  <p>The tractors will run the company's core contracted lanes and are required to serve
  existing shipper commitments.</p>

  <h2>Existing Obligations</h2>
  <p>Total funded debt, consisting of equipment notes on the current fleet and a revolving
  line of credit, is ${usd(21500000)}. Annual debt service on that debt is ${usd(5900000)}.
  Undrawn availability under the revolving line was ${usd(4500000)} at the application date.</p>

  <h2>Financial Summary</h2>
  <p class="note">Prepared by management from reviewed statements.</p>
  <table>
    <thead><tr><th>(in dollars)</th><th>FY 2025</th><th>FY 2024</th></tr></thead>
    <tbody>
      <tr><td>Operating revenue</td><td>58,600,000</td><td>61,200,000</td></tr>
      <tr><td>Operating income</td><td>2,350,000</td><td>4,100,000</td></tr>
      <tr><td>Depreciation and amortization</td><td>6,750,000</td><td>6,300,000</td></tr>
      <tr class="total"><td>EBITDA</td><td>9,100,000</td><td>10,400,000</td></tr>
      <tr><td>Maintenance capital expenditures</td><td>4,200,000</td><td>3,900,000</td></tr>
      <tr><td>Cash and cash equivalents at year end</td><td>3,100,000</td><td>2,850,000</td></tr>
    </tbody>
  </table>

  <h2>Certification</h2>
  <p style="margin-top:22px">_______________________________<br>
  Darnell Whitcomb, Chief Financial Officer<br>
  Ridgeline Freight &amp; Logistics Inc.</p>
  `,
});

// ---- 02. Dealer quote ----

const dealerQuote = page({
  title: 'Ridgeline Freight — Dealer Quote',
  letterhead: {
    name: 'PRAIRIE STATES TRUCK CENTER',
    meta: 'Fleet Sales Quotation &nbsp;&middot;&nbsp; Quote Q-26-8841 &nbsp;&middot;&nbsp; 29 September 2026',
  },
  body: `
  <h1>Quotation</h1>
  <table class="kv">
    <tr><td>Customer</td><td>Ridgeline Freight &amp; Logistics Inc.</td></tr>
    <tr><td>Units</td><td>40 &times; 2027 model-year Class 8 sleeper tractor, new</td></tr>
  </table>
  <table>
    <thead><tr><th>Item</th><th>Amount</th></tr></thead>
    <tbody>
      <tr><td>Unit price (each)</td><td>165,000</td></tr>
      <tr><td>Units</td><td>40</td></tr>
      <tr class="total"><td>Total, 40 units</td><td>6,600,000</td></tr>
    </tbody>
  </table>
  <p class="note">Price excludes federal excise tax, registration and title. Delivery in two
  tranches of 20 units, November and December 2026.</p>
  `,
});

module.exports = {
  scenario: 'ridgeline-freight-trucking',
  assetClass: 'equipment',
  moduleKey: 'equipment_finance',
  description:
    'Two documents for a truckload carrier. Tests the Trucking vs Transportation/Logistics split: "Logistics" is in the legal name and a small brokerage desk is described, but the business is an asset-based for-hire fleet. Term in years, founding year, down payment as a percentage, rating absent.',
  truth: TRUTH,
  documents: [
    { file: '01_credit-application.pdf', html: creditApplication, documentType: 'credit_application' },
    { file: '02_dealer-quote.pdf', html: dealerQuote, documentType: 'equipment_quote' },
  ],
  expectedConflicts: [],
  expectedAbsent: ['creditRating', 'downPayment'],
};
