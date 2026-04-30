// ============================================================
// Server-side validation for Equipment Finance deal inputs
// ============================================================

const VALID_INDUSTRY_SECTORS = [
  'Manufacturing',
  'Construction',
  'Transportation/Logistics',
  'Marine',
  'Rail',
  'Energy',
  'Healthcare',
  'Infrastructure',
  'Mining',
  'Agriculture',
  'Aviation',
  'Other',
];

const VALID_CREDIT_RATINGS = ['Strong', 'Adequate', 'Weak', 'Not Rated'];

const VALID_EQUIPMENT_TYPES = [
  'Heavy Machinery',
  'Vehicles/Fleet',
  'Rail Cars',
  'Marine Vessels',
  'Aircraft/Helicopters',
  'Medical Equipment',
  'IT/Data Center',
  'Construction Equipment',
  'Energy/Power Generation',
  'Other',
];

const VALID_FINANCING_TYPES = ['EFA', 'FMV', 'TRAC'];

const VALID_EQUIPMENT_CONDITIONS = ['New', 'Used'];

/**
 * Validate deal inputs on the server side.
 * Returns { valid: true } or { valid: false, errors: [{field, message}] }
 */
function validateDealInputs(inputs) {
  const errors = [];

  if (inputs == null || typeof inputs !== 'object') {
    return { valid: false, errors: [{ field: '_root', message: 'Inputs must be a non-null object' }] };
  }

  // --- companyName (optional, but if present must be a string <= 200 chars) ---
  if (inputs.companyName !== undefined && inputs.companyName !== null && inputs.companyName !== '') {
    if (typeof inputs.companyName !== 'string') {
      errors.push({ field: 'companyName', message: 'Company name must be a string' });
    } else if (inputs.companyName.length > 200) {
      errors.push({ field: 'companyName', message: 'Company name must be at most 200 characters' });
    }
  }

  // --- yearsInBusiness ---
  if (inputs.yearsInBusiness !== undefined && inputs.yearsInBusiness !== null) {
    const yib = Number(inputs.yearsInBusiness);
    if (isNaN(yib)) {
      errors.push({ field: 'yearsInBusiness', message: 'Years in business must be a number' });
    } else if (yib < 0) {
      errors.push({ field: 'yearsInBusiness', message: 'Years in business cannot be negative' });
    } else if (yib > 200) {
      errors.push({ field: 'yearsInBusiness', message: 'Years in business cannot exceed 200' });
    }
  }

  // --- annualRevenue ---
  {
    const val = Number(inputs.annualRevenue);
    if (isNaN(val) || inputs.annualRevenue === undefined || inputs.annualRevenue === null) {
      errors.push({ field: 'annualRevenue', message: 'Annual revenue is required and must be a number' });
    } else if (val <= 0) {
      errors.push({ field: 'annualRevenue', message: 'Annual revenue must be greater than 0' });
    } else if (val > 1e12) {
      errors.push({ field: 'annualRevenue', message: 'Annual revenue cannot exceed $1 trillion' });
    }
  }

  // --- ebitda ---
  {
    const val = Number(inputs.ebitda);
    if (isNaN(val) || inputs.ebitda === undefined || inputs.ebitda === null) {
      errors.push({ field: 'ebitda', message: 'EBITDA is required and must be a number' });
    } else {
      const revenue = Number(inputs.annualRevenue);
      if (!isNaN(revenue) && revenue > 0 && Math.abs(val) > revenue) {
        errors.push({ field: 'ebitda', message: 'EBITDA absolute value cannot exceed annual revenue' });
      }
    }
  }

  // --- totalExistingDebt ---
  if (inputs.totalExistingDebt !== undefined && inputs.totalExistingDebt !== null) {
    const val = Number(inputs.totalExistingDebt);
    if (isNaN(val)) {
      errors.push({ field: 'totalExistingDebt', message: 'Total existing debt must be a number' });
    } else if (val < 0) {
      errors.push({ field: 'totalExistingDebt', message: 'Total existing debt cannot be negative' });
    }
  }

  // --- actualAnnualDebtService ---
  if (inputs.actualAnnualDebtService !== undefined && inputs.actualAnnualDebtService !== null) {
    const val = Number(inputs.actualAnnualDebtService);
    if (isNaN(val)) {
      errors.push({ field: 'actualAnnualDebtService', message: 'Actual annual debt service must be a number' });
    } else if (val < 0) {
      errors.push({ field: 'actualAnnualDebtService', message: 'Actual annual debt service cannot be negative' });
    }
  }

  // --- industrySector ---
  if (!VALID_INDUSTRY_SECTORS.includes(inputs.industrySector)) {
    errors.push({
      field: 'industrySector',
      message: `Industry sector must be one of: ${VALID_INDUSTRY_SECTORS.join(', ')}`,
    });
  }

  // --- creditRating ---
  if (!VALID_CREDIT_RATINGS.includes(inputs.creditRating)) {
    errors.push({
      field: 'creditRating',
      message: `Credit rating must be one of: ${VALID_CREDIT_RATINGS.join(', ')}`,
    });
  }

  // --- equipmentType ---
  if (!VALID_EQUIPMENT_TYPES.includes(inputs.equipmentType)) {
    errors.push({
      field: 'equipmentType',
      message: `Equipment type must be one of: ${VALID_EQUIPMENT_TYPES.join(', ')}`,
    });
  }

  // --- equipmentCondition ---
  if (!VALID_EQUIPMENT_CONDITIONS.includes(inputs.equipmentCondition)) {
    errors.push({
      field: 'equipmentCondition',
      message: 'Equipment condition must be "New" or "Used"',
    });
  }

  // --- equipmentCost ---
  {
    const val = Number(inputs.equipmentCost);
    if (isNaN(val) || inputs.equipmentCost === undefined || inputs.equipmentCost === null) {
      errors.push({ field: 'equipmentCost', message: 'Equipment cost is required and must be a number' });
    } else if (val <= 0) {
      errors.push({ field: 'equipmentCost', message: 'Equipment cost must be greater than 0' });
    }
  }

  // --- downPayment ---
  if (inputs.downPayment !== undefined && inputs.downPayment !== null) {
    const dp = Number(inputs.downPayment);
    const cost = Number(inputs.equipmentCost);
    if (isNaN(dp)) {
      errors.push({ field: 'downPayment', message: 'Down payment must be a number' });
    } else if (dp < 0) {
      errors.push({ field: 'downPayment', message: 'Down payment cannot be negative' });
    } else if (!isNaN(cost) && cost > 0 && dp >= cost) {
      errors.push({ field: 'downPayment', message: 'Down payment must be less than equipment cost' });
    }
  }

  // --- financingType ---
  if (!VALID_FINANCING_TYPES.includes(inputs.financingType)) {
    errors.push({
      field: 'financingType',
      message: `Financing type must be one of: ${VALID_FINANCING_TYPES.join(', ')}`,
    });
  }

  // --- usefulLife ---
  {
    const val = Number(inputs.usefulLife);
    if (isNaN(val) || inputs.usefulLife === undefined || inputs.usefulLife === null) {
      errors.push({ field: 'usefulLife', message: 'Useful life is required and must be a number' });
    } else if (!Number.isInteger(val)) {
      errors.push({ field: 'usefulLife', message: 'Useful life must be a whole number (integer)' });
    } else if (val <= 0) {
      errors.push({ field: 'usefulLife', message: 'Useful life must be greater than 0' });
    } else if (val > 50) {
      errors.push({ field: 'usefulLife', message: 'Useful life cannot exceed 50 years' });
    }
  }

  // --- loanTerm ---
  {
    const val = Number(inputs.loanTerm);
    if (isNaN(val) || inputs.loanTerm === undefined || inputs.loanTerm === null) {
      errors.push({ field: 'loanTerm', message: 'Loan term is required and must be a number' });
    } else if (!Number.isInteger(val)) {
      errors.push({ field: 'loanTerm', message: 'Loan term must be a whole number (integer) of months' });
    } else if (val <= 0) {
      errors.push({ field: 'loanTerm', message: 'Loan term must be greater than 0' });
    } else if (val > 360) {
      errors.push({ field: 'loanTerm', message: 'Loan term cannot exceed 360 months' });
    }
  }

  // --- essentialUse ---
  if (inputs.essentialUse !== undefined && inputs.essentialUse !== null) {
    if (typeof inputs.essentialUse !== 'boolean') {
      errors.push({ field: 'essentialUse', message: 'Essential use must be a boolean (true or false)' });
    }
  }

  return errors.length === 0
    ? { valid: true }
    : { valid: false, errors };
}

module.exports = {
  validateDealInputs,
  VALID_INDUSTRY_SECTORS,
  VALID_CREDIT_RATINGS,
  VALID_EQUIPMENT_TYPES,
  VALID_FINANCING_TYPES,
  VALID_EQUIPMENT_CONDITIONS,
};
