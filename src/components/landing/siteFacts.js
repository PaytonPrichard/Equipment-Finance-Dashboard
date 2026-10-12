// ============================================================
// Every figure the marketing pages print, in one place.
//
// The landing page and the Methodology page are static: they do not load
// the scoring modules, because a visitor should not download the product to
// read about it. So the numbers are written out here, and siteFacts.test.js
// recomputes each one from the real modules, the demo data and the committed
// real-deals report. Change a breakpoint, a weight or a threshold and that
// test fails, naming the claim that is now wrong.
//
// Add a number to a page by adding it here and to the test. Never type a
// figure straight into JSX.
// ============================================================

// ---- Granite Ridge: the four-document sample deal (demoExtraction.json) ----

export const GRANITE = {
  company: 'Granite Ridge Materials LLC',
  sector: 'Mining',
  assetClass: 'Equipment finance',
  score: 78,
  verdict: 'PASS',
  mergedFields: 20,
  conflictCount: 3,
  documents: [
    { name: '01_credit-application.pdf', short: 'credit-application.pdf', type: 'Credit application', fields: 12 },
    { name: '02_financial-statements.pdf', short: 'financial-statements.pdf', type: 'Financial statements', fields: 11 },
    { name: '03_equipment-quote.pdf', short: 'equipment-quote.pdf', type: 'Equipment quote', fields: 8 },
    { name: '04_broker-email.txt', short: 'broker-email.txt', type: 'Deal sheet', fields: 18 },
  ],
  ebitdaConflict: {
    chosen: 7400000,
    chosenFrom: '02_financial-statements.pdf',
    alternative: 7900000,
    alternativeFrom: '04_broker-email.txt',
  },
  // What the merge kept, and the document it came from.
  merged: [
    { field: 'Company', value: 'Granite Ridge Materials LLC', src: 'credit-application.pdf', numeric: false },
    { field: 'Revenue', value: 38400000, src: 'financial-statements.pdf', numeric: true },
    { field: 'EBITDA', value: 7400000, src: 'financial-statements.pdf', numeric: true },
    { field: 'Equipment cost', value: 6275000, src: 'equipment-quote.pdf', numeric: true },
  ],
  // The seven factor rows, as describeFactors returns them.
  factors: [
    { key: 'dscr', label: 'DSCR', value: '2.26x', target: '≥ 1.25x', weight: 25, score: 93, met: true },
    { key: 'leverage', label: 'Leverage', value: '2.6x', target: '≤ 3.5x', weight: 20, score: 82, met: true },
    { key: 'industry', label: 'Industry', value: 'Mining (high risk)', target: 'low-risk sector', weight: 15, score: 35, met: false },
    { key: 'essentiality', label: 'Essential use', value: 'Yes', target: 'essential', weight: 10, score: 100, met: true },
    { key: 'equipmentLtv', label: 'LTV', value: '85% on cost', target: '≤ 85%', weight: 10, score: 65, met: true },
    { key: 'yearsInBusiness', label: 'Years in business', value: '16 yrs', target: '≥ 5 yrs', weight: 10, score: 91, met: true },
    { key: 'termCoverage', label: 'Term coverage', value: '58% of useful life', target: '< 80%', weight: 10, score: 79, met: true },
  ],
  // Liquidation LTV here rests on the general haircut, which is an estimate.
  // CLAUDE.md: an estimate that could change an outcome must be visible.
  liquidationLtvPct: 113,
  liquidationHaircutPct: 25,
  liquidationHaircutBasis: 'general',
};

// ---- Prairie: the statement-built demo deal (demoStatements.js) ----

export const PRAIRIE = {
  company: 'Prairie Equipment Dealers Inc.',
  document: 'FY2025 audited financials',
  judgmentCount: 13,
  built: [
    {
      key: 'ebitda',
      label: 'EBITDA',
      value: 11600000,
      terms: [
        { sign: '+', label: 'Operating income', value: 11000000, page: 4 },
        { sign: '+', label: 'Depreciation and amortization', value: 3200000, page: 6 },
        { sign: '-', label: 'Floorplan interest', value: 2600000, page: 4 },
      ],
    },
    {
      key: 'totalExistingDebt',
      label: 'Total debt',
      value: 20000000,
      terms: [
        { sign: '+', label: 'Revolver', value: 6000000, page: 14 },
        { sign: '+', label: 'Term loans and notes', value: 14000000, page: 14 },
      ],
      note: 'Floorplan payable excluded, floorplan out.',
    },
    {
      key: 'actualAnnualDebtService',
      label: 'Annual debt service',
      value: 3900000,
      terms: [
        { sign: '+', label: 'Cash interest paid', value: 4100000, page: 6 },
        { sign: '+', label: 'Current maturities', value: 2400000, page: 3 },
        { sign: '-', label: 'Floorplan interest', value: 2600000, page: 4 },
      ],
    },
  ],
  maintenanceCapex: 2800000, // depreciation as a proxy, always an estimate
  adjustedEbitda: 13400000,
  adjustedGap: 1800000,
};

// ---- Monitoring: the two funded demo facilities (demoMonitoring.js) ----

export const DRIFT = [
  { facility: 'Summit IT Solutions LLC', covenant: 'DSCR', underwrote: '5.70x', current: '2.38x', drift: '-3.32x', worse: true },
  { facility: 'Summit IT Solutions LLC', covenant: 'Leverage', underwrote: '1.6x', current: '3.4x', drift: '+1.9x', worse: true },
  { facility: 'Heartland Foods Manufacturing Co.', covenant: 'DSCR', underwrote: '3.88x', current: '5.37x', drift: '+1.49x', worse: false },
  { facility: 'Heartland Foods Manufacturing Co.', covenant: 'Leverage', underwrote: '2.0x', current: '2.2x', drift: '+0.1x', worse: true },
];

export const MONITORING_COMING = [
  'Breach alerts',
  'Borrowing base certificates',
  'Document reading after close',
  'Covenant amendments',
];

// ---- Method: equipment finance factors, score bands and limits ----

export const EQUIPMENT_FACTORS = [
  { label: 'DSCR', weight: 25, target: '≥ 1.25x' },
  { label: 'Leverage', weight: 20, target: '≤ 3.5x' },
  { label: 'Industry', weight: 15, target: 'Low-risk sector' },
  { label: 'Essential use', weight: 10, target: 'Essential' },
  { label: 'LTV', weight: 10, target: '≤ 85%' },
  { label: 'Years in business', weight: 10, target: '≥ 5 yrs' },
  { label: 'Term coverage', weight: 10, target: '< 80% of useful life' },
];

export const SCORE_BANDS = { pass: 75, flag: 35 };

// `key` is the DEFAULT_CRITERIA key the test checks `value` against.
export const LIMITS = [
  { key: 'minDscr', label: 'DSCR floor', value: 1.25, display: '1.25x', source: 'Term lenders commonly set DSCR covenants at 1.20x to 1.25x.' },
  { key: 'minDscrAR', label: 'DSCR floor, AR facilities', value: 1.1, display: '1.10x', source: 'AR facilities self-liquidate through collections, so the floor is lower.' },
  { key: 'maxLeverage', label: 'Leverage ceiling', value: 5, display: '5.0x', source: 'Tranche default. No public benchmark behind it.' },
  { key: 'maxLtv', label: 'LTV on cost', value: 90, display: '90%', source: 'At least 10% down, the John Deere Owner Trust minimum for construction and monthly-pay agricultural contracts.' },
  { key: 'maxLiquidationLtv', label: 'Liquidation LTV', value: 115, display: '115%', source: 'Standard 10% to 20% down structures sit near 100% to 115% on a forced-sale basis. Above that is thin equity.' },
  { key: 'maxTermCoverage', label: 'Term coverage', value: 80, display: '80% of useful life', source: 'Tranche default. Public ABS data does not disclose term against useful life.' },
  { key: 'minCashFlowDscr', label: 'Cash-flow DSCR floor', value: 1.15, display: '1.15x', source: 'No market standard. Set under the 1.20x to 1.25x used for plain DSCR, because this measure is stricter.' },
  { key: 'minFccr', label: 'FCCR floor', value: 1.1, display: '1.10x', source: 'A common springing covenant level in asset-based lending.' },
];

export const CASH_FLOW_STRESS = [
  'Revenue down 10%, 20% and 30%, margin held',
  'EBITDA margin down 200 bps',
  'Rates up 200 bps on floating debt',
  'Customers pay 20 days slower',
  'Combined severe: revenue down 20% and margin down 200 bps',
];

export const HAIRCUTS = [
  { type: 'Trucks and fleet', newPct: 20, newBasis: 'estimated', usedPct: 30, usedBasis: 'data' },
  { type: 'Construction equipment', newPct: 20, newBasis: 'estimated', usedPct: 30, usedBasis: 'data' },
  { type: 'Agricultural equipment', newPct: 25, newBasis: 'data', usedPct: 30, usedBasis: 'data' },
  { type: 'Every other type', newPct: 25, newBasis: 'general', usedPct: 30, usedBasis: 'general' },
];

// ---- The real-deals run (scripts/real-deals/reports/<SCORECARD_RUN>.md) ----

export const SCORECARD_RUN = '2026-10-12';

export const SCORECARD = [
  { name: 'Alta Equipment Group Inc.', filing: 'FY2025 10-K', verdict: 'FAIL', score: 73, reason: 'Cash-flow DSCR -0.14x and FCCR 0.37x, both below 1.0x. Leverage 5.3x is over the 5.0x ceiling.' },
  { name: 'Custom Truck One Source, Inc.', filing: 'FY2025 10-K', verdict: 'FAIL', score: 76, reason: 'Cash-flow DSCR 0.78x and FCCR 0.82x, both below 1.0x. EBITDA coverage alone reads 2.50x.' },
  { name: 'DXP Enterprises, Inc.', filing: 'FY2025 10-K', verdict: 'FLAG', score: 79, reason: 'Breaks under stress. Cash-flow DSCR falls to 0.94x in the combined severe case.' },
  { name: 'H&E Equipment Services, Inc.', filing: 'FY2024 10-K', verdict: 'PASS', score: 83, reason: 'No limit breached. This is the case Tranche gets wrong. See known limits.', wrong: true },
  { name: 'Hertz Global Holdings, Inc.', filing: 'FY2025 10-K', verdict: 'FAIL', score: 46, reason: 'EBITDA is negative. Earnings cannot cover debt service, and leverage is not meaningful.' },
  { name: 'Rush Enterprises, Inc.', filing: 'FY2025 10-K', verdict: 'PASS', score: 80, reason: 'No limit breached. DSCR 6.38x, leverage 2.1x.' },
  { name: 'Titan Machinery Inc.', filing: 'FY2026 10-K', verdict: 'FAIL', score: 48, reason: 'DSCR 0.13x. Leverage 36.5x.' },
  { name: 'United Rentals, Inc.', filing: 'FY2025 10-K', verdict: 'PASS', score: 83, reason: 'No limit breached. DSCR 8.32x, leverage 2.0x.' },
  { name: 'Wabash National Corporation', filing: 'FY2025 10-K', verdict: 'FAIL', score: 53, reason: 'EBITDA is negative once a non-cash litigation reversal is excluded.' },
];

// ---- Formatting ----

export const fmt = (n) => n.toLocaleString('en-US');
