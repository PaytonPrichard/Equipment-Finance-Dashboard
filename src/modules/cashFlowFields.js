// Cash-flow coverage inputs, shared by every module's form schema.
// The metrics they feed live in src/utils/cashFlowMetrics.ts.
//
// Type 'nullable-number' keeps a blank as blank. Every other numeric field
// on the form stores a blank as 0, and these metrics must be able to tell
// "not provided" from "zero".

export const MAINTENANCE_CAPEX_FIELD = {
  key: 'maintenanceCapex', label: 'Maintenance Capex', type: 'currency', placeholder: 'Optional', half: true,
  tip: 'Annual capex to keep existing assets running. Used in cash-flow DSCR and FCCR. Left blank, those metrics show as not provided.',
};

export const CASH_FLOW_FIELDS = [
  {
    key: 'cashTaxes', label: 'Cash Taxes', type: 'nullable-number', prefix: '$', placeholder: 'Optional', half: true,
    tip: 'Income taxes paid in cash over the year. Enter 0 if none.',
  },
  {
    key: 'workingCapitalIncrease', label: 'Increase in Working Capital', type: 'nullable-number', prefix: '$', allowNegative: true, placeholder: 'Optional', half: true,
    tip: 'Cash absorbed by receivables and inventory, net of payables, over the year. Negative if cash was released.',
  },
  {
    key: 'leasePayments', label: 'Rent & Lease Payments', type: 'nullable-number', prefix: '$', placeholder: 'Optional', half: true,
    tip: 'Annual rent and operating lease payments. Counted as a fixed charge in FCCR. Enter 0 if none.',
  },
  {
    key: 'floatingRateDebtPct', label: 'Floating Share of Existing Debt', type: 'nullable-number', suffix: '%', max: 100, placeholder: 'Optional', half: true,
    tip: 'Percent of existing debt that floats with SOFR. Used in the rate shock.',
  },
];

export const CASH_FLOW_INITIAL_INPUTS = {
  cashTaxes: null,
  workingCapitalIncrease: null,
  leasePayments: null,
  floatingRateDebtPct: null,
};

// CSV header aliases (lowercased, alphanumerics only) for batch upload.
export const CASH_FLOW_CSV_ALIASES = {
  cashtaxes: 'cashTaxes', taxespaid: 'cashTaxes', taxes: 'cashTaxes',
  increaseinworkingcapital: 'workingCapitalIncrease', workingcapitalincrease: 'workingCapitalIncrease', changeinworkingcapital: 'workingCapitalIncrease',
  leasepayments: 'leasePayments', rent: 'leasePayments', rentandleasepayments: 'leasePayments',
  floatingratedebtpct: 'floatingRateDebtPct', floatingdebtpct: 'floatingRateDebtPct', floatingshare: 'floatingRateDebtPct',
};

/** A CSV cell for a cash-flow field: blank stays null, never 0. */
export function parseCashFlowCell(val) {
  const cleaned = String(val ?? '').replace(/[^0-9.-]/g, '');
  if (cleaned === '' || cleaned === '-') return null;
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n : null;
}
