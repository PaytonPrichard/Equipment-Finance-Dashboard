// ============================================================
// Inventory Finance — Form Schema
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
        { key: 'yearsInBusiness', label: 'Years in Business', type: 'number', placeholder: 'e.g. 10', tip: 'Operating history. Longer track records reduce risk.', half: true },
        { key: 'annualRevenue', label: 'Annual Revenue', type: 'currency', placeholder: '50,000,000', required: true, tip: 'Total annual revenue from most recent fiscal year.', half: true },
        { key: 'ebitda', label: 'EBITDA', type: 'currency', placeholder: '8,000,000', required: true, tip: 'Primary measure of cash flow for debt service.', half: true },
        { key: 'totalExistingDebt', label: 'Existing Debt', type: 'currency', placeholder: '20,000,000', tip: 'All outstanding debt. Used for leverage calculation.', half: true },
        { key: 'actualAnnualDebtService', label: 'Actual Annual DS', type: 'currency', placeholder: 'Optional', tip: 'If known, enter actual annual debt service.', half: true },
        { key: 'industrySector', label: 'Industry', type: 'select', options: INDUSTRY_OPTIONS, half: true },
        { key: 'creditRating', label: 'Credit Rating', type: 'select', options: CREDIT_OPTIONS, half: true },
      ],
    },
    {
      key: 'collateral',
      title: 'Inventory Profile',
      icon: 'package',
      fields: [
        { key: 'totalInventory', label: 'Total Inventory', type: 'currency', placeholder: '8,000,000', required: true, tip: 'Total inventory value at cost from most recent balance sheet.', half: true },
        { key: 'requestedAdvanceRate', label: 'Requested Advance Rate', type: 'percent', placeholder: '50', tip: 'Percentage of eligible inventory to advance. Typical: 50-65% for finished goods.', half: true },
        { key: 'rawMaterials', label: 'Raw Materials (%)', type: 'percent', placeholder: '30', tip: 'Percentage of total inventory that is raw materials. Typically advance 40-50%.', half: true },
        { key: 'workInProgress', label: 'Work in Progress (%)', type: 'percent', placeholder: '15', tip: 'Percentage that is WIP. Typically advance 20-30% or exclude.', half: true },
        { key: 'finishedGoods', label: 'Finished Goods (%)', type: 'percent', placeholder: '50', tip: 'Percentage that is finished goods ready for sale. Best advance rates.', half: true },
        { key: 'obsoleteInventory', label: 'Obsolete/Slow-Moving (%)', type: 'percent', placeholder: '5', tip: 'Percentage deemed obsolete or slow-moving. Excluded from borrowing base.', half: true },
        { key: 'inventoryTurnover', label: 'Inventory Turnover (x)', type: 'number', placeholder: '6', tip: 'COGS / Average Inventory. Above 6x is strong. Below 4x is concerning.', half: true },
        { key: 'averageDaysOnHand', label: 'Avg Days on Hand', type: 'number', placeholder: '60', tip: 'Average number of days inventory is held before sale.', half: true },
        { key: 'nolvPct', label: 'NOLV (%)', type: 'percent', placeholder: '55', tip: 'Net Orderly Liquidation Value as % of book value. From most recent appraisal.', half: true },
        { key: 'perishable', label: 'Perishable Inventory', type: 'boolean', tip: 'Is inventory perishable or time-sensitive? Reduces advance rates and increases monitoring.' },
      ],
    },
  ],
};
