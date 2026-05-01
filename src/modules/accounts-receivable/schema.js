// ============================================================
// Accounts Receivable — Form Schema
// ============================================================

import { INDUSTRY_OPTIONS, CREDIT_OPTIONS } from './constants';

export const FORM_SCHEMA = {
  sections: [
    {
      key: 'borrower',
      title: 'Borrower Profile',
      icon: 'user',
      fields: [
        { key: 'companyName', label: 'Company Name', type: 'company-search', tip: 'Start typing to search the company database.' },
        { key: 'annualRevenue', label: 'Annual Revenue', type: 'currency', placeholder: '50,000,000', required: true, tip: 'Total annual revenue from most recent fiscal year.', half: true },
        { key: 'priorYearRevenue', label: 'Prior Year Revenue', type: 'currency', placeholder: 'Optional', tip: 'Revenue from the prior fiscal year. Used to compute year-over-year growth trend.', half: true },
        { key: 'ebitda', label: 'EBITDA', type: 'currency', placeholder: '8,000,000', required: true, tip: 'Primary measure of cash flow for debt service.', half: true },
        { key: 'priorYearEbitda', label: 'Prior Year EBITDA', type: 'currency', placeholder: 'Optional', tip: 'EBITDA from the prior fiscal year. Used to compute margin trend in basis points.', half: true },
        { key: 'yearsInBusiness', label: 'Years in Business', type: 'number', placeholder: 'e.g. 10', tip: 'Operating history. Longer track records reduce risk.', half: true },
        { key: 'totalExistingDebt', label: 'Existing Debt', type: 'currency', placeholder: '20,000,000', tip: 'All outstanding debt. Used for leverage calculation.', half: true },
        { key: 'actualAnnualDebtService', label: 'Actual Annual DS', type: 'currency', placeholder: 'Optional', tip: 'If known, enter actual annual debt service.', half: true },
        { key: 'maintenanceCapex', label: 'Maintenance Capex', type: 'currency', placeholder: 'Optional', tip: 'Annual maintenance capex used in FCCR. Defaults to 3% of revenue if blank. Note: our FCCR excludes taxes and dividends from fixed charges.', half: true },
        { key: 'cashOnHand', label: 'Cash on Hand', type: 'currency', placeholder: 'Optional', tip: 'Unrestricted cash and equivalents from the most recent balance sheet.', half: true },
        { key: 'availableLiquidity', label: 'Other Available Liquidity', type: 'currency', placeholder: 'Optional', tip: 'Undrawn revolver capacity and other immediately accessible liquidity.', half: true },
        { key: 'industrySector', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS, half: true },
        { key: 'creditRating', label: 'Credit Rating', type: 'select', options: CREDIT_OPTIONS, half: true },
      ],
    },
    {
      key: 'collateral',
      title: 'Receivables Profile',
      icon: 'file-text',
      fields: [
        { key: 'totalAROutstanding', label: 'Total AR Outstanding', type: 'currency', placeholder: '12,000,000', required: true, tip: 'Total accounts receivable balance as of most recent reporting date.', half: true },
        { key: 'requestedAdvanceRate', label: 'Requested Advance Rate', type: 'percent', placeholder: '80', tip: 'Percentage of eligible AR to advance. Typical: 80-85%.', half: true },
        { key: 'arUnder30', label: 'AR 0-30 Days (%)', type: 'percent', placeholder: '65', required: true, tip: 'Percentage of total AR that is current (under 30 days).', half: true },
        { key: 'arOver30', label: 'AR 31-60 Days (%)', type: 'percent', placeholder: '20', tip: 'Percentage of AR that is 31-60 days past due.', half: true },
        { key: 'arOver60', label: 'AR 61-90 Days (%)', type: 'percent', placeholder: '10', tip: 'Percentage of AR that is 61-90 days past due.', half: true },
        { key: 'arOver90', label: 'AR 90+ Days (%)', type: 'percent', placeholder: '5', tip: 'Percentage past 90 days. Typically ineligible for borrowing base.', half: true },
        { key: 'topCustomerConcentration', label: 'Top Customer (%)', type: 'percent', placeholder: '15', tip: 'Revenue or AR concentration from the single largest customer. Above 25% is elevated risk.', half: true },
        { key: 'dilutionRate', label: 'Dilution Rate (%)', type: 'percent', placeholder: '3', tip: 'Credits, returns, and adjustments as a percentage of gross billings. Above 5% is concerning.', half: true },
        { key: 'ineligiblesPct', label: 'Ineligibles (%)', type: 'percent', placeholder: '15', tip: 'Percentage of AR deemed ineligible (cross-aged, contra, government, foreign, intercompany).', half: true },
        { key: 'existingABLFacility', label: 'Existing ABL Facility', type: 'boolean', tip: 'Does the borrower currently have an ABL revolving credit facility?' },
      ],
    },
  ],
};
