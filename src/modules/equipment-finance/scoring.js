// ============================================================
// Equipment Finance Deal Screening — Scoring & Calculation Functions
// ============================================================

import {
  lerp,
  calculateMonthlyPayment,
  generateAmortizationSchedule,
  formatCurrency,
  formatCurrencyFull,
  formatPercent,
  formatRatio,
} from '../../utils/format';

import {
  DEFAULT_SOFR,
  EXISTING_DEBT_SERVICE_RATE,
  BASE_SPREAD_BPS,
  CREDIT_SPREAD_BPS,
  INDUSTRY_RISK_TIER,
  TIER_SPREAD_BPS,
  FMV_RESIDUAL_PCT,
  TRAC_RESIDUAL_PCT,
  FINANCING_TYPES,
} from './constants';

// ------- Rate Calculation -------

export function getScreeningRate(creditRating, industrySector, sofr = DEFAULT_SOFR) {
  const tier = INDUSTRY_RISK_TIER[industrySector] || 'moderate';
  const creditBps = CREDIT_SPREAD_BPS[creditRating] || 0;
  const industryBps = TIER_SPREAD_BPS[tier] || 0;
  const totalSpread = BASE_SPREAD_BPS + creditBps + industryBps;

  return {
    sofr,
    baseSpread: BASE_SPREAD_BPS,
    creditAdj: creditBps,
    industryAdj: industryBps,
    totalSpread,
    allInRate: sofr + totalSpread / 10000,
  };
}

// ------- Residual Value -------

export function getResidualValue(financingType, equipmentType, equipmentCost) {
  if (financingType === 'FMV') {
    return equipmentCost * (FMV_RESIDUAL_PCT[equipmentType] || 0.10);
  }
  if (financingType === 'TRAC') {
    return equipmentCost * (TRAC_RESIDUAL_PCT[equipmentType] || 0.15);
  }
  return 0; // EFA — fully amortizing
}

// ------- Core Metrics -------

export function calculateMetrics(inputs, sofr = DEFAULT_SOFR) {
  const {
    annualRevenue,
    ebitda,
    totalExistingDebt,
    creditRating,
    industrySector,
    equipmentCondition,
    equipmentCost,
    downPayment = 0,
    financingType = 'EFA',
    equipmentType,
    usefulLife,
    loanTerm,
  } = inputs;

  const rateInfo = getScreeningRate(creditRating, industrySector, sofr);
  const rate = rateInfo.allInRate;

  // Net amount financed after equity / down payment
  const netFinanced = Math.max((equipmentCost || 0) - (downPayment || 0), 0);

  // Residual reduces periodic payments for FMV / TRAC
  const residualValue = getResidualValue(
    financingType,
    equipmentType,
    equipmentCost || 0
  );
  const financedPrincipal =
    financingType === 'EFA'
      ? netFinanced
      : Math.max(netFinanced - residualValue, 0);

  const monthlyPayment = calculateMonthlyPayment(
    financedPrincipal,
    rate,
    loanTerm
  );
  const newAnnualDebtService = monthlyPayment * 12;
  // Use actual debt service if provided, otherwise estimate
  const existingDebtService =
    (inputs.actualAnnualDebtService || 0) > 0
      ? inputs.actualAnnualDebtService
      : (totalExistingDebt || 0) * EXISTING_DEBT_SERVICE_RATE;
  const debtServiceEstimated = !((inputs.actualAnnualDebtService || 0) > 0);

  const dscr =
    ebitda && existingDebtService + newAnnualDebtService > 0
      ? ebitda / (existingDebtService + newAnnualDebtService)
      : 0;

  const leverage =
    ebitda > 0 ? ((totalExistingDebt || 0) + netFinanced) / ebitda : 0;

  // Equipment value — used equipment discounted 15%
  const equipmentValue =
    equipmentCondition === 'Used'
      ? (equipmentCost || 0) * 0.85
      : equipmentCost || 0;

  // LTV now uses net financed (after down payment) vs equipment value
  const ltv = equipmentValue > 0 ? netFinanced / equipmentValue : 0;

  const termYears = (loanTerm || 0) / 12;
  const termCoverage = usefulLife > 0 ? (termYears / usefulLife) * 100 : 0;

  const revenueConcentration =
    annualRevenue > 0 ? ((equipmentCost || 0) / annualRevenue) * 100 : 0;

  // Profitability & debt yield
  const ebitdaMargin = annualRevenue > 0 ? (ebitda / annualRevenue) * 100 : 0;
  const debtYield = netFinanced > 0 ? (ebitda / netFinanced) * 100 : 0;

  return {
    dscr,
    leverage,
    ltv,
    termCoverage,
    revenueConcentration,
    ebitdaMargin,
    debtYield,
    rate,
    rateInfo,
    newAnnualDebtService,
    existingDebtService,
    monthlyPayment,
    netFinanced,
    financedPrincipal,
    residualValue,
    equipmentValue,
    debtServiceEstimated,
  };
}

// ------- Risk Scoring -------

export function calculateRiskScore(inputs, metrics) {
  const factors = {};

  // DSCR (25%) — higher is better
  factors.dscr = lerp(metrics.dscr, [
    [0, 5], [0.8, 15], [1.0, 25], [1.25, 50], [1.5, 72], [2.0, 90], [3.0, 100],
  ]);

  // Leverage (20%) — lower is better
  factors.leverage = lerp(metrics.leverage, [
    [0, 100], [2.0, 90], [3.5, 72], [5.0, 48], [7.0, 22], [10.0, 5],
  ]);

  // Industry (15%) — categorical, stays discrete
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'low') factors.industry = 100;
  else if (tier === 'moderate') factors.industry = 65;
  else factors.industry = 35;

  // Essentiality (10%) — binary
  factors.essentiality = inputs.essentialUse ? 100 : 30;

  // Equipment condition & LTV (10%) — lower LTV is better, new equipment gets a bonus
  const conditionBonus = inputs.equipmentCondition === 'New' ? 12 : 0;
  factors.equipmentLtv = Math.min(100, conditionBonus + lerp(metrics.ltv, [
    [0, 95], [0.60, 90], [0.75, 78], [0.85, 65], [1.0, 45], [1.2, 20],
  ]));

  // Years in business (10%) — more is better
  factors.yearsInBusiness = lerp(inputs.yearsInBusiness, [
    [0, 15], [2, 40], [5, 65], [10, 85], [20, 95], [30, 100],
  ]);

  // Term coverage (10%) — lower is better
  factors.termCoverage = lerp(metrics.termCoverage, [
    [0, 100], [40, 95], [60, 78], [80, 45], [100, 15],
  ]);

  const composite = Math.round(
    factors.dscr * 0.25 +
      factors.leverage * 0.2 +
      factors.industry * 0.15 +
      factors.essentiality * 0.1 +
      factors.equipmentLtv * 0.1 +
      factors.yearsInBusiness * 0.1 +
      factors.termCoverage * 0.1
  );

  return { composite, factors };
}

// ------- Recommendation -------

export function getRecommendation(compositeScore) {
  if (compositeScore >= 75)
    return {
      category: 'Strong Prospect',
      detail: 'Recommend advancing to underwriting',
      colorClass: 'emerald',
      bgClass: 'bg-emerald-500/10 border-emerald-500/30',
      textClass: 'text-emerald-400',
      badgeBg: 'bg-emerald-500/20',
    };
  if (compositeScore >= 55)
    return {
      category: 'Moderate Prospect',
      detail: 'Worth pursuing with identified mitigants',
      colorClass: 'lime',
      bgClass: 'bg-lime-500/10 border-lime-500/30',
      textClass: 'text-lime-400',
      badgeBg: 'bg-lime-500/20',
    };
  if (compositeScore >= 35)
    return {
      category: 'Borderline',
      detail: 'Requires additional diligence or structural enhancements',
      colorClass: 'amber',
      bgClass: 'bg-amber-500/10 border-amber-500/30',
      textClass: 'text-amber-400',
      badgeBg: 'bg-amber-500/20',
    };
  return {
    category: 'Weak Prospect',
    detail: 'Likely does not meet credit thresholds',
    colorClass: 'rose',
    bgClass: 'bg-rose-500/10 border-rose-500/30',
    textClass: 'text-rose-400',
    badgeBg: 'bg-rose-500/20',
  };
}

// ------- Commentary -------

export function generateCommentary(inputs, metrics, riskScore) {
  const comments = [];

  // DSCR
  if (metrics.dscr > 2.0) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x provides strong debt service coverage, well above typical minimum thresholds.`
    );
  } else if (metrics.dscr >= 1.5) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x indicates comfortable coverage cushion for total debt service obligations.`
    );
  } else if (metrics.dscr >= 1.25) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x is adequate but offers limited margin; recommend interest rate sensitivity analysis.`
    );
  } else {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x falls below typical minimum thresholds — borrower may struggle to service total debt obligations.`
    );
  }

  // Leverage
  if (metrics.leverage > 5.0) {
    comments.push(
      `Total leverage of ${metrics.leverage.toFixed(1)}x EBITDA is elevated; assess whether asset-backed structure adequately mitigates credit risk.`
    );
  } else if (metrics.leverage > 3.5) {
    comments.push(
      `Leverage of ${metrics.leverage.toFixed(1)}x EBITDA is moderate; structure should reflect seniority and collateral position.`
    );
  } else if (metrics.leverage <= 2.0) {
    comments.push(
      `Low leverage of ${metrics.leverage.toFixed(1)}x EBITDA indicates significant balance sheet capacity for additional debt.`
    );
  }

  // Industry
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'high') {
    comments.push(
      `${inputs.industrySector} sector carries cyclical/operational risk; consider shorter tenor, step-up payments, or additional credit support.`
    );
  } else if (tier === 'low') {
    comments.push(
      `${inputs.industrySector} sector provides relatively stable demand characteristics, supporting credit profile.`
    );
  }

  // LTV
  if (metrics.ltv > 1.0) {
    comments.push(
      `LTV of ${(metrics.ltv * 100).toFixed(0)}% exceeds equipment value — additional equity contribution or collateral should be considered.`
    );
  } else if (metrics.ltv <= 0.75) {
    comments.push(
      `LTV of ${(metrics.ltv * 100).toFixed(0)}% provides strong collateral cushion, reducing loss-given-default risk.`
    );
  }

  // Financing type
  const ft = inputs.financingType || 'EFA';
  if (ft === 'FMV' && metrics.residualValue > 0) {
    comments.push(
      `FMV lease structure reduces periodic payments by ${formatCurrency(metrics.residualValue)} (estimated residual). Lessor retains residual value risk — assess remarketing outlook for ${inputs.equipmentType}.`
    );
  } else if (ft === 'TRAC') {
    comments.push(
      `TRAC lease with lessee-guaranteed residual of ${formatCurrency(metrics.residualValue)}. Residual guarantee mitigates lessor risk but shifts value risk to lessee.`
    );
  }

  // Term coverage
  if (metrics.termCoverage > 80) {
    comments.push(
      `Loan term covers ${metrics.termCoverage.toFixed(0)}% of equipment useful life — residual value risk is elevated. Consider shorter term or residual value guarantee.`
    );
  }

  // Revenue concentration
  if (metrics.revenueConcentration > 25) {
    comments.push(
      `Equipment cost represents ${metrics.revenueConcentration.toFixed(1)}% of annual revenue — relatively concentrated exposure for the borrower's operations.`
    );
  }

  // Essential use
  if (inputs.essentialUse) {
    comments.push(
      `Essential-use classification strengthens the credit profile under the essential-use doctrine; equipment is critical to borrower's revenue generation.`
    );
  } else {
    comments.push(
      `Non-essential equipment may present higher recovery risk in a default scenario; consider additional collateral coverage.`
    );
  }

  return comments.slice(0, 5);
}

// ------- Suggested Structure -------

export function getSuggestedStructure(inputs, metrics, compositeScore, sofr = DEFAULT_SOFR) {
  const suggestions = {};
  const ft = inputs.financingType || 'EFA';

  // Rate — use the same rate that drove DSCR calculation
  suggestions.rateInfo = metrics.rateInfo;
  suggestions.screeningRate = metrics.rate;

  // Indicative range: +/- 50 bps from screening rate
  suggestions.rateRange = [
    Math.max(metrics.rate - 0.005, sofr + 0.005),
    metrics.rate + 0.005,
  ];

  // Structure recommendation based on financing type
  if (ft === 'FMV') {
    suggestions.structure =
      'Fair Market Value lease — lessee has option to purchase at FMV, return, or renew at end of term. Lower periodic payments due to residual value assumption. Lessor bears residual risk; ensure remarketing channel for this equipment type.';
    suggestions.structureType = 'FMV Lease';
  } else if (ft === 'TRAC') {
    suggestions.structure =
      'TRAC lease — lessee guarantees a terminal residual value. If disposition proceeds differ from guaranteed amount, a rental adjustment (refund or additional charge) is applied. Commonly used for over-the-road vehicles and fleet assets.';
    suggestions.structureType = 'TRAC Lease';
  } else {
    // EFA — recommend based on deal profile
    if (inputs.essentialUse && metrics.termCoverage < 80) {
      suggestions.structure =
        'Equipment Finance Agreement (EFA) recommended — borrower takes ownership, fully amortizing payments. Essential-use asset with favorable term-to-useful-life coverage supports lender recovery profile.';
    } else if (metrics.termCoverage >= 80) {
      suggestions.structure =
        'EFA with first-priority equipment lien. Consider adding residual value guarantee given elevated term-to-useful-life ratio, or evaluate an FMV lease to shift residual risk.';
    } else {
      suggestions.structure =
        'Standard EFA with first-priority lien on financed equipment. Fully amortizing, fixed-rate structure appropriate for this credit profile.';
    }
    suggestions.structureType = 'EFA';
  }

  // Enhancements
  suggestions.enhancements = [];
  if (compositeScore < 55) {
    suggestions.enhancements.push('Personal guarantee from principal(s)');
  }
  if (metrics.termCoverage > 80) {
    suggestions.enhancements.push(
      'Reduce term to under 80% of equipment useful life'
    );
  }
  if (metrics.dscr < 1.5) {
    suggestions.enhancements.push(
      'Cash sweep or step-up payment structure to accelerate deleveraging'
    );
  }
  if (metrics.leverage > 4.0) {
    suggestions.enhancements.push(
      'Additional collateral or cross-collateralization with other assets'
    );
  }
  if (compositeScore < 75 && compositeScore >= 35) {
    suggestions.enhancements.push(
      'Maintenance reserve account for equipment upkeep'
    );
  }
  if (metrics.revenueConcentration > 25) {
    suggestions.enhancements.push(
      'Consider phased funding or reduced deal size relative to borrower capacity'
    );
  }
  if (metrics.ltv > 0.9 && (inputs.downPayment || 0) === 0) {
    suggestions.enhancements.push(
      'Require minimum 10–15% equity contribution / down payment to reduce LTV'
    );
  }

  // Deal sizing flag
  const maxSuggested = (inputs.ebitda || 0) * 3;
  if ((inputs.equipmentCost || 0) > maxSuggested && maxSuggested > 0) {
    suggestions.sizingFlag = `Deal size of ${formatCurrency(inputs.equipmentCost)} appears large relative to borrower's ${formatCurrency(inputs.ebitda)} EBITDA (${(inputs.equipmentCost / inputs.ebitda).toFixed(1)}x). Assess whether the borrower can absorb this level of incremental debt.`;
  }

  return suggestions;
}

// ------- Stress Testing -------

export function runStressTest(inputs, sofr = DEFAULT_SOFR) {
  const declines = [0, 0.10, 0.20, 0.30];
  const labels = ['Base Case', 'Mild Stress (-10%)', 'Moderate (-20%)', 'Severe (-30%)'];

  return declines.map((pct, i) => {
    const stressed = {
      ...inputs,
      ebitda: (inputs.ebitda || 0) * (1 - pct),
    };
    const m = calculateMetrics(stressed, sofr);
    const rs = calculateRiskScore(stressed, m);
    return {
      label: labels[i],
      decline: pct,
      ebitda: stressed.ebitda,
      dscr: m.dscr,
      leverage: m.leverage,
      score: rs.composite,
    };
  });
}

// ------- Export Summary -------

export function generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, sofr = DEFAULT_SOFR) {
  const ft = inputs.financingType || 'EFA';
  const lines = [];
  lines.push('EQUIPMENT FINANCE DEAL SCREENING');
  lines.push('PRELIMINARY ASSESSMENT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Company:          ${inputs.companyName || 'N/A'}`);
  lines.push(`Industry:         ${inputs.industrySector}`);
  lines.push(`Credit Rating:    ${inputs.creditRating}`);
  lines.push(`Years in Business:${inputs.yearsInBusiness > 0 ? ' ' + inputs.yearsInBusiness : ' N/A'}`);
  lines.push(`Equipment:        ${inputs.equipmentType} (${inputs.equipmentCondition})`);
  lines.push(`Structure:        ${FINANCING_TYPES[ft]?.fullName || ft}`);
  lines.push(`Equipment Cost:   ${formatCurrencyFull(inputs.equipmentCost)}`);
  lines.push(`Down Payment:     ${formatCurrencyFull(inputs.downPayment || 0)}`);
  lines.push(`Net Financed:     ${formatCurrencyFull(metrics.netFinanced)}`);
  lines.push(`Term:             ${inputs.loanTerm} months (${(inputs.loanTerm / 12).toFixed(1)} years)`);
  lines.push(`Useful Life:      ${inputs.usefulLife} years`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('SCREENING RESULT');
  lines.push('-'.repeat(60));
  lines.push(`Risk Score:       ${riskScore.composite}/100 - ${recommendation.category}`);
  lines.push(`Recommendation:   ${recommendation.detail}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('KEY METRICS');
  lines.push('-'.repeat(60));
  lines.push(`DSCR:             ${formatRatio(metrics.dscr)}  (min 1.25x)`);
  lines.push(`Leverage:         ${formatRatio(metrics.leverage)}  (target <3.5x)`);
  lines.push(`LTV:              ${formatPercent(metrics.ltv * 100)}  (target <85%)`);
  lines.push(`Term / Life:      ${formatPercent(metrics.termCoverage)}  (target <60%)`);
  lines.push(`Rev. Conc.:       ${formatPercent(metrics.revenueConcentration)}  (target <15%)`);
  lines.push(`EBITDA Margin:    ${formatPercent(metrics.ebitdaMargin)}`);
  lines.push(`Debt Yield:       ${formatPercent(metrics.debtYield)}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('DEBT SERVICE');
  lines.push('-'.repeat(60));
  lines.push(`Screening Rate:   ${(metrics.rate * 100).toFixed(2)}%`);
  lines.push(`Monthly Payment:  ${formatCurrencyFull(metrics.monthlyPayment)}`);
  lines.push(`Annual DS (New):  ${formatCurrencyFull(metrics.newAnnualDebtService)}`);
  lines.push(`Annual DS (Exist):${formatCurrencyFull(metrics.existingDebtService)}${metrics.debtServiceEstimated ? ' (estimated)' : ''}`);
  if (metrics.residualValue > 0) {
    lines.push(`Residual Value:   ${formatCurrencyFull(metrics.residualValue)} (${ft})`);
  }
  const amort = generateAmortizationSchedule(metrics.financedPrincipal, metrics.rate, inputs.loanTerm);
  if (amort && amort.totalInterest > 0) {
    lines.push(`Total Interest:   ${formatCurrencyFull(amort.totalInterest)}`);
    lines.push(`Total Cost:       ${formatCurrencyFull(amort.totalCost)}`);
  }
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('ASSESSMENT NOTES');
  lines.push('-'.repeat(60));
  commentary.forEach((c, i) => lines.push(`${i + 1}. ${c}`));
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('STRESS TEST');
  lines.push('-'.repeat(60));
  const stress = runStressTest(inputs, sofr);
  stress.forEach((s) => {
    const flag = s.dscr < 1.0 ? ' ** BELOW 1.0x **' : s.dscr < 1.25 ? ' * Below min *' : '';
    lines.push(`${s.label.padEnd(22)} EBITDA: ${formatCurrency(s.ebitda).padEnd(8)}  DSCR: ${s.dscr.toFixed(2)}x${flag}`);
  });
  if (structure && structure.enhancements && structure.enhancements.length > 0) {
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('SUGGESTED ENHANCEMENTS');
    lines.push('-'.repeat(60));
    structure.enhancements.forEach((e, i) => lines.push(`- ${e}`));
  }
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('DISCLAIMER: Preliminary screening only. Not a credit decision.');
  lines.push('Final terms subject to full underwriting, credit committee');
  lines.push('approval, and documentation.');
  lines.push(`Generated: ${new Date().toLocaleDateString()}`);
  return lines.join('\n');
}

// ------- CSV Parsing -------

export function parseCsvDeals(csvText) {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/[^a-z0-9]/g, ''));

  const fieldMap = {
    companyname: 'companyName', company: 'companyName', name: 'companyName',
    yearsinbusiness: 'yearsInBusiness', years: 'yearsInBusiness',
    annualrevenue: 'annualRevenue', revenue: 'annualRevenue',
    ebitda: 'ebitda',
    totalexistingdebt: 'totalExistingDebt', existingdebt: 'totalExistingDebt', debt: 'totalExistingDebt',
    industrysector: 'industrySector', industry: 'industrySector',
    creditrating: 'creditRating', credit: 'creditRating',
    equipmenttype: 'equipmentType',
    equipmentcondition: 'equipmentCondition', condition: 'equipmentCondition',
    equipmentcost: 'equipmentCost', cost: 'equipmentCost',
    downpayment: 'downPayment',
    financingtype: 'financingType', structure: 'financingType',
    usefullife: 'usefulLife',
    loanterm: 'loanTerm', term: 'loanTerm',
    essentialuse: 'essentialUse', essential: 'essentialUse',
  };

  const numericFields = new Set([
    'yearsInBusiness', 'annualRevenue', 'ebitda', 'totalExistingDebt',
    'equipmentCost', 'downPayment', 'usefulLife', 'loanTerm',
  ]);

  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const values = line.split(',').map(v => v.trim());
    const inputs = {
      companyName: '',
      yearsInBusiness: 0, annualRevenue: 0, ebitda: 0, totalExistingDebt: 0,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      equipmentType: 'Heavy Machinery', equipmentCondition: 'New',
      equipmentCost: 0, downPayment: 0, financingType: 'EFA',
      usefulLife: 10, loanTerm: 60, essentialUse: true,
    };

    headers.forEach((h, i) => {
      const field = fieldMap[h];
      if (!field || i >= values.length) return;
      const val = values[i];
      if (field === 'essentialUse') {
        inputs[field] = ['true', 'yes', '1', 'y'].includes(val.toLowerCase());
      } else if (numericFields.has(field)) {
        inputs[field] = parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
      } else {
        inputs[field] = val;
      }
    });

    return { id: `CSV-${String(idx + 1).padStart(3, '0')}`, inputs };
  });
}

// ------- Validation -------

export function isInputValid(inputs) {
  return (
    (inputs.ebitda || 0) > 0 &&
    (inputs.equipmentCost || 0) > 0 &&
    (inputs.loanTerm || 0) > 0 &&
    (inputs.usefulLife || 0) > 0 &&
    (inputs.annualRevenue || 0) > 0
  );
}
