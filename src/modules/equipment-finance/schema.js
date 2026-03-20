// ============================================================
// Equipment Finance — Form Schema
// Defines the field layout for the schema-driven DealInputForm
// ============================================================

import { INDUSTRY_OPTIONS, EQUIPMENT_OPTIONS, CREDIT_OPTIONS, FINANCING_TYPES, TRAC_ELIGIBLE_TYPES, EQUIPMENT_DEFAULTS } from './constants';

export const FORM_SCHEMA = {
  sections: [
    {
      key: 'borrower',
      title: 'Borrower Profile',
      icon: 'user',
      fields: [
        { key: 'companyName', label: 'Company Name', type: 'company-search', tip: 'Start typing to search the company database. Select a match to auto-populate borrower financials.' },
        { key: 'yearsInBusiness', label: 'Years in Business', type: 'number', placeholder: 'e.g. 10', tip: 'How long the borrower has been operating. Longer track records reduce risk.', half: true },
        { key: 'annualRevenue', label: 'Annual Revenue', type: 'currency', placeholder: '50,000,000', required: true, tip: 'Total annual revenue from most recent fiscal year.', half: true },
        { key: 'ebitda', label: 'EBITDA', type: 'currency', placeholder: '8,000,000', required: true, tip: 'Earnings Before Interest, Taxes, Depreciation & Amortization. Primary measure of cash flow for debt service.', half: true },
        { key: 'totalExistingDebt', label: 'Existing Debt', type: 'currency', placeholder: '20,000,000', tip: 'All outstanding debt (loans, leases, lines). Used for leverage and existing debt service estimates.', half: true },
        { key: 'actualAnnualDebtService', label: 'Actual Annual DS', type: 'currency', placeholder: 'Optional', tip: 'If known, enter actual annual debt service. Otherwise we estimate at 8% of total existing debt.', half: true },
        { key: 'industrySector', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS, tip: 'Affects risk tier and rate. Healthcare & Infrastructure = low risk. Construction, Mining & Aviation = higher risk.', half: true },
        { key: 'creditRating', label: 'Credit Rating', type: 'select', options: CREDIT_OPTIONS, tip: 'Borrower credit quality. Strong = investment-grade equivalent. Adequate = middle market. Weak = below average.', half: true },
      ],
    },
    {
      key: 'collateral',
      title: 'Equipment & Deal',
      icon: 'settings',
      fields: [
        { key: 'equipmentType', label: 'Equipment Type', type: 'select', options: EQUIPMENT_OPTIONS, half: true },
        { key: 'equipmentCondition', label: 'Condition', type: 'toggle', options: ['New', 'Used'], half: true },
        { key: 'equipmentCost', label: 'Equipment Cost', type: 'currency', placeholder: '5,000,000', required: true, tip: 'Total purchase price of the equipment.', half: true },
        { key: 'downPayment', label: 'Down Payment', type: 'currency', placeholder: '500,000', tip: 'Upfront equity. Reduces financed amount and LTV. Typical: 10-20% of cost.', half: true },
        { key: 'financingType', label: 'Financing Structure', type: 'financing-type', options: FINANCING_TYPES, tracEligible: TRAC_ELIGIBLE_TYPES },
        { key: 'usefulLife', label: 'Useful Life (Yrs)', type: 'number', placeholder: '15', required: true, tip: 'Expected economic useful life. Term should generally not exceed 80%.', half: true },
        { key: 'loanTerm', label: 'Term (Months)', type: 'number', placeholder: '84', required: true, tip: 'Loan or lease duration. Compared against useful life.', half: true },
        { key: 'essentialUse', label: 'Essential-Use Equipment', type: 'boolean', tip: 'Is this equipment critical to core revenue? Essential-use assets have stronger recovery profiles.' },
      ],
    },
  ],
  equipmentDefaults: EQUIPMENT_DEFAULTS,
};
