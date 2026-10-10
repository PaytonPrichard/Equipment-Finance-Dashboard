// Display helpers for statement-built figures, shared by the form and the
// committee memo.

export const BUILT_FIELD_LABELS = {
  annualRevenue: 'Revenue',
  ebitda: 'EBITDA',
  totalExistingDebt: 'Total debt',
  actualAnnualDebtService: 'Annual debt service',
  maintenanceCapex: 'Maintenance capex',
  cashTaxes: 'Cash taxes',
  workingCapitalIncrease: 'Working capital increase',
  leasePayments: 'Rent',
};

export function money(v) {
  if (v === null || v === undefined) return '';
  const sign = v < 0 ? '-' : '';
  const a = Math.abs(v);
  if (a >= 1e6) return `${sign}$${(a / 1e6).toFixed(1)}M`;
  if (a >= 1e3) return `${sign}$${Math.round(a / 1e3)}K`;
  return `${sign}$${Math.round(a)}`;
}

function sourceText(source) {
  if (!source) return '';
  const parts = [source.document, source.page != null && source.page !== '' ? `p. ${source.page}` : null].filter(Boolean);
  return parts.join(', ');
}

/** "Operating income $10.0M (10-K, p. 54) + D&A $5.0M" */
export function formulaWithValues(derivation) {
  if (!derivation?.terms?.length) return '';
  return derivation.terms.map((t, i) => {
    const src = sourceText(t.source);
    const piece = `${t.label} ${money(t.value)}${src ? ` (${src})` : ''}`;
    if (i === 0) return t.sign === '+' ? piece : `${piece}, sign reversed`;
    return `${t.sign} ${piece}`;
  }).join(' ');
}

// What each treatment does to EBITDA, debt and debt service. Presentation
// copy lives here, the rules themselves in src/lib/borrowerBuild.ts.
export const TREATMENT_COPY = {
  financeLeases: {
    label: 'Finance leases',
    options: {
      in: { label: 'Debt', detail: 'Lease liabilities count as debt. Lease principal and interest count as debt service.' },
      out: { label: 'Rent', detail: 'Lease cost deducted in EBITDA. Liabilities excluded from debt.' },
    },
  },
  operatingLeases: {
    label: 'Operating leases',
    options: {
      out: { label: 'Rent', detail: 'Rent stays an operating expense. Lease liabilities excluded from debt.' },
      in: { label: 'Debt', detail: 'Rent added back to EBITDA. Lease liabilities count as debt, rent as debt service.' },
    },
  },
  floorplan: {
    label: 'Floorplan (dealers)',
    options: {
      out: { label: 'Inventory financing', detail: 'Interest deducted in EBITDA. Floorplan payable excluded from debt and debt service.' },
      in: { label: 'Debt', detail: 'Interest added back to EBITDA. Payable counts as debt, interest as debt service.' },
    },
  },
  captiveFleet: {
    label: 'Captive fleet debt',
    options: {
      corporate: { label: 'Corporate level', detail: 'EBITDA after vehicle depreciation and interest. Vehicle debt excluded.' },
      consolidated: { label: 'Consolidated', detail: 'EBITDA before vehicle costs. Vehicle debt and its maturities included.' },
    },
  },
};
