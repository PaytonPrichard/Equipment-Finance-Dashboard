// Statement line items for the demo (?demo=1). Fictional borrowers, so the
// sources are fictional too. Every figure ties out: the line items build
// exactly the numbers the deal shows.
//
// Two uses:
// - PRAIRIE: the "Try a deal built from statements" example. An equipment
//   dealer with floorplan, judgments left for the visitor to confirm.
// - HEARTLAND: a funded pipeline deal, built from statements, every judgment
//   confirmed by the demo analyst, firm rules kept from when it was saved.

import { buildBorrowerInputs, DEFAULT_TREATMENT_RULES } from '../lib/borrowerBuild';

const li = (value, document, page) => ({ value, source: { document, page }, origin: 'typed' });

const PRAIRIE_DOC = 'FY2025 audited financials';

// Built: revenue 180.0M. EBITDA 11.0 + 3.2 - 2.6 floorplan interest = 11.6M.
// Debt 6.0 + 14.0 = 20.0M (floorplan payable 48.0M left out). Debt service
// 4.1 interest paid - 2.6 floorplan + 2.4 current maturities = 3.9M.
export const PRAIRIE_FINANCIALS = {
  fiscalYearEnd: '2025-12-31',
  show: { floorplan: true },
  lineItems: {
    revenue: li(180000000, PRAIRIE_DOC, 4),
    operatingIncome: li(11000000, PRAIRIE_DOC, 4),
    rentExpense: li(1400000, PRAIRIE_DOC, 18),
    floorplanInterest: li(2600000, PRAIRIE_DOC, 4),
    depreciationAmortization: li(3200000, PRAIRIE_DOC, 6),
    amortizationOfIntangibles: li(400000, PRAIRIE_DOC, 6),
    interestPaid: li(4100000, PRAIRIE_DOC, 6),
    incomeTaxesPaid: li(1100000, PRAIRIE_DOC, 6),
    capitalExpenditures: li(3800000, PRAIRIE_DOC, 6),
    workingCapitalChange: li(-1500000, PRAIRIE_DOC, 6),
    revolver: li(6000000, PRAIRIE_DOC, 14),
    termLoansAndNotes: li(14000000, PRAIRIE_DOC, 14),
    currentMaturities: li(2400000, PRAIRIE_DOC, 3),
    floorplanPayable: li(48000000, PRAIRIE_DOC, 3),
  },
  // The dealer's own figure, from its lender presentation. The bridge is
  // left for the visitor to review: one line is the borrower's projection.
  adjustedEbitda: {
    value: 13400000,
    label: 'Adjusted EBITDA',
    source: { document: 'Lender presentation', page: 9 },
    addBacks: [
      { label: 'Stock-based compensation', amount: 600000, source: { document: 'Lender presentation', page: 9 }, decision: null },
      { label: 'Dealer management system conversion', amount: 800000, source: { document: 'Lender presentation', page: 9 }, decision: null },
      { label: 'Pro forma EBITDA of store acquired in November', amount: 500000, source: { document: 'Lender presentation', page: 9 }, decision: null },
    ],
  },
};

const HEARTLAND_DOC = 'FY2025 audited financials';

// Built to match the deal as it was screened: revenue 72.0M, EBITDA
// 8.7 + 2.8 = 11.5M, debt 4.0 + 18.0 = 22.0M. Debt service 1.3 + 1.4 = 2.7M.
const HEARTLAND_LINES = {
  fiscalYearEnd: '2025-12-31',
  lineItems: {
    revenue: li(72000000, HEARTLAND_DOC, 5),
    operatingIncome: li(8700000, HEARTLAND_DOC, 5),
    rentExpense: li(800000, HEARTLAND_DOC, 21),
    depreciationAmortization: li(2800000, HEARTLAND_DOC, 7),
    amortizationOfIntangibles: li(300000, HEARTLAND_DOC, 7),
    interestPaid: li(1300000, HEARTLAND_DOC, 7),
    incomeTaxesPaid: li(1600000, HEARTLAND_DOC, 7),
    capitalExpenditures: li(3100000, HEARTLAND_DOC, 7),
    workingCapitalChange: li(-500000, HEARTLAND_DOC, 7),
    revolver: li(4000000, HEARTLAND_DOC, 15),
    termLoansAndNotes: li(18000000, HEARTLAND_DOC, 15),
    currentMaturities: li(1400000, HEARTLAND_DOC, 4),
  },
};

/** Every proposal confirmed as proposed, by the demo analyst. */
function confirmedAsProposed(financials, by, at) {
  const { judgments } = buildBorrowerInputs(financials, DEFAULT_TREATMENT_RULES);
  return {
    ...financials,
    judgments: Object.fromEntries(judgments.map((j) => [j.id, { proposed: j.proposed, confirmed: j.value, by, at }])),
    firmRules: { ...DEFAULT_TREATMENT_RULES },
  };
}

export function heartlandFinancials(by, at) {
  return confirmedAsProposed(HEARTLAND_LINES, by, at);
}
