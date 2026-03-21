// ============================================================
// Accounts Receivable Deal Screening — Scoring & Calculation Functions
// ============================================================

import {
  lerp,
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
  MAX_ADVANCE_RATE,
  CONCENTRATION_THRESHOLD,
  DILUTION_THRESHOLD,
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

// ------- Core Metrics -------

export function calculateMetrics(inputs, sofr = DEFAULT_SOFR) {
  const {
    annualRevenue,
    ebitda,
    totalExistingDebt,
    creditRating,
    industrySector,
    totalAROutstanding,
    // eslint-disable-next-line no-unused-vars
    arOver30 = 0, arOver60 = 0, arOver90 = 0,
    topCustomerConcentration = 0,
    dilutionRate = 0,
    ineligiblesPct = 0,
    requestedAdvanceRate = 80,
  } = inputs;

  const rateInfo = getScreeningRate(creditRating, industrySector, sofr);
  const effectiveRate = rateInfo.allInRate;

  // Eligible AR: total AR minus ineligibles (cross-aged, contras, etc.)
  const ineligibleAmount = (totalAROutstanding || 0) * (ineligiblesPct / 100);
  const eligibleAR = Math.max((totalAROutstanding || 0) - ineligibleAmount, 0);

  // Advance rate: input is percentage (0-100), convert to decimal, cap at MAX
  const advanceRate = Math.min((requestedAdvanceRate || 0) / 100, MAX_ADVANCE_RATE);

  // Borrowing base = eligible AR * advance rate
  const borrowingBase = eligibleAR * advanceRate;

  // Days Sales Outstanding = (total AR / annual revenue) * 365
  const dso = annualRevenue > 0
    ? ((totalAROutstanding || 0) / annualRevenue) * 365
    : 0;

  // Concentration risk — top customer as a % of total AR
  const concentrationRisk = topCustomerConcentration / 100;

  // Net availability (borrowing base minus any existing ABL draws, simplified)
  const netAvailability = borrowingBase;

  // Debt service: estimate annual cost of the revolver at full draw
  const newAnnualDebtService = borrowingBase * effectiveRate;
  const existingDebtService =
    (inputs.actualAnnualDebtService || 0) > 0
      ? inputs.actualAnnualDebtService
      : (totalExistingDebt || 0) * EXISTING_DEBT_SERVICE_RATE;
  const debtServiceEstimated = !((inputs.actualAnnualDebtService || 0) > 0);

  // DSCR = EBITDA / total debt service
  const totalDebtService = existingDebtService + newAnnualDebtService;
  const dscr = ebitda && totalDebtService > 0
    ? ebitda / totalDebtService
    : 0;

  // Leverage = total debt (existing + facility) / EBITDA
  const leverage = ebitda > 0
    ? ((totalExistingDebt || 0) + borrowingBase) / ebitda
    : 0;

  return {
    eligibleAR,
    borrowingBase,
    dso,
    concentrationRisk,
    dilutionRate: dilutionRate / 100,
    advanceRate,
    netAvailability,
    dscr,
    leverage,
    effectiveRate,
    rateInfo,
    newAnnualDebtService,
    existingDebtService,
    debtServiceEstimated,
    ineligibleAmount,
    totalAROutstanding: totalAROutstanding || 0,
  };
}

// ------- Risk Scoring -------

export function calculateRiskScore(inputs, metrics) {
  const factors = {};

  // DSCR (25%) — higher is better
  factors.dscr = lerp(metrics.dscr, [
    [0, 5], [0.8, 15], [1.0, 25], [1.25, 50], [1.5, 72], [2.0, 90], [3.0, 100],
  ]);

  // Leverage (15%) — lower is better
  factors.leverage = lerp(metrics.leverage, [
    [0, 100], [2.0, 90], [3.5, 72], [5.0, 48], [7.0, 22], [10.0, 5],
  ]);

  // AR Quality / Aging (20%) — based on % of AR that is current (under 30 days)
  // Form inputs are percentages (0-100), convert to decimal for scoring
  const pctOver = ((inputs.arOver30 || 0) + (inputs.arOver60 || 0) + (inputs.arOver90 || 0)) / 100;
  const pctCurrent = 1 - pctOver;
  const pctCurrentClamped = Math.max(0, Math.min(1, pctCurrent));
  factors.arQuality = lerp(pctCurrentClamped, [
    [0, 5], [0.50, 20], [0.65, 40], [0.75, 60], [0.85, 80], [0.95, 95], [1.0, 100],
  ]);

  // Concentration (15%) — lower top-customer concentration is better
  factors.concentration = lerp(metrics.concentrationRisk, [
    [0, 100], [0.10, 90], [0.20, 72], [0.25, 55], [0.35, 35], [0.50, 15], [0.75, 5],
  ]);

  // Dilution (10%) — lower dilution rate is better
  factors.dilution = lerp(metrics.dilutionRate, [
    [0, 100], [0.02, 90], [0.05, 70], [0.08, 50], [0.12, 30], [0.20, 10],
  ]);

  // Years in Business (10%) — more is better
  factors.yearsInBusiness = lerp(inputs.yearsInBusiness, [
    [0, 15], [2, 40], [5, 65], [10, 85], [20, 95], [30, 100],
  ]);

  // Industry (5%) — categorical
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'low') factors.industry = 100;
  else if (tier === 'moderate') factors.industry = 65;
  else factors.industry = 35;

  const composite = Math.round(
    factors.dscr * 0.25 +
    factors.leverage * 0.15 +
    factors.arQuality * 0.20 +
    factors.concentration * 0.15 +
    factors.dilution * 0.10 +
    factors.yearsInBusiness * 0.10 +
    factors.industry * 0.05
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

  // AR Aging Quality
  const totalAR = inputs.totalAROutstanding || 0;
  const pctOver90 = totalAR > 0 ? ((inputs.arOver90 || 0) / totalAR) * 100 : 0;
  const pctOver60 = totalAR > 0 ? (((inputs.arOver60 || 0) + (inputs.arOver90 || 0)) / totalAR) * 100 : 0;
  const pctOver30 = totalAR > 0 ? (((inputs.arOver30 || 0) + (inputs.arOver60 || 0) + (inputs.arOver90 || 0)) / totalAR) * 100 : 0;

  if (pctOver90 > 10) {
    comments.push(
      `${pctOver90.toFixed(1)}% of AR is over 90 days past due — significant collection risk. Ineligible buckets will materially reduce the borrowing base. Recommend detailed aging analysis and reserve for bad debt.`
    );
  } else if (pctOver60 > 15) {
    comments.push(
      `${pctOver60.toFixed(1)}% of AR is over 60 days — aging profile shows elevated delinquency. Monitor payment trends and consider tightening advance rate or adding dilution reserves.`
    );
  } else if (pctOver30 < 15) {
    comments.push(
      `AR aging is clean with only ${pctOver30.toFixed(1)}% past 30 days. Strong collections performance supports the requested advance rate.`
    );
  } else {
    comments.push(
      `${pctOver30.toFixed(1)}% of AR is over 30 days — moderate aging. Within acceptable range for ABL but warrants ongoing monitoring of payment velocity.`
    );
  }

  // Concentration
  if (metrics.concentrationRisk > CONCENTRATION_THRESHOLD) {
    comments.push(
      `Top customer concentration of ${(metrics.concentrationRisk * 100).toFixed(1)}% exceeds the ${(CONCENTRATION_THRESHOLD * 100).toFixed(0)}% threshold — consider concentration sublimits or credit insurance on key accounts to mitigate single-obligor risk.`
    );
  } else if (metrics.concentrationRisk > 0.15) {
    comments.push(
      `Top customer concentration of ${(metrics.concentrationRisk * 100).toFixed(1)}% is moderate. Verify creditworthiness of key obligors and consider concentration reporting covenants.`
    );
  } else {
    comments.push(
      `Customer concentration of ${(metrics.concentrationRisk * 100).toFixed(1)}% indicates a well-diversified receivables portfolio, reducing single-obligor risk.`
    );
  }

  // Dilution
  if (metrics.dilutionRate > DILUTION_THRESHOLD) {
    comments.push(
      `Dilution rate of ${(metrics.dilutionRate * 100).toFixed(1)}% exceeds the ${(DILUTION_THRESHOLD * 100).toFixed(0)}% threshold — credits, returns, and allowances are eroding collateral value. Recommend a dilution reserve equal to the trailing 12-month dilution rate applied to the borrowing base.`
    );
  } else {
    comments.push(
      `Dilution rate of ${(metrics.dilutionRate * 100).toFixed(1)}% is within acceptable parameters, indicating stable invoicing practices and low return/credit activity.`
    );
  }

  // Advance Rate
  if (metrics.advanceRate > 0.82) {
    comments.push(
      `Advance rate of ${(metrics.advanceRate * 100).toFixed(0)}% is at the upper end of the typical 75–85% range for AR facilities. Ensure dilution reserves and ineligibles are adequately addressed before approving.`
    );
  } else if (metrics.advanceRate < 0.70) {
    comments.push(
      `Conservative advance rate of ${(metrics.advanceRate * 100).toFixed(0)}% provides a meaningful collateral cushion, reducing exposure in a liquidation scenario.`
    );
  }

  // DSCR
  if (metrics.dscr > 2.0) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x provides strong debt service coverage relative to the projected facility cost.`
    );
  } else if (metrics.dscr >= 1.25) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x indicates adequate coverage, though the revolving nature of the facility means actual utilization may vary.`
    );
  } else if (metrics.dscr > 0) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x is below typical ABL minimums — assess whether borrower has alternative liquidity sources or if the facility is self-liquidating through AR collections.`
    );
  }

  // DSO
  if (metrics.dso > 75) {
    comments.push(
      `DSO of ${metrics.dso.toFixed(0)} days is elevated, suggesting slow collections or extended payment terms. Investigate whether terms are market-standard for the industry.`
    );
  } else if (metrics.dso < 35) {
    comments.push(
      `DSO of ${metrics.dso.toFixed(0)} days indicates rapid collections and strong cash conversion, supporting collateral liquidity.`
    );
  }

  // Industry
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'high') {
    comments.push(
      `${inputs.industrySector} sector carries cyclical risk; consider more frequent borrowing base certificates and field exams.`
    );
  }

  return comments.slice(0, 6);
}

// ------- Suggested Structure -------

export function getSuggestedStructure(inputs, metrics, compositeScore, sofr = DEFAULT_SOFR) {
  const suggestions = {};

  // Rate
  suggestions.rateInfo = metrics.rateInfo;
  suggestions.screeningRate = metrics.effectiveRate;

  // Indicative range: +/- 50 bps from screening rate
  suggestions.rateRange = [
    Math.max(metrics.effectiveRate - 0.005, sofr + 0.005),
    metrics.effectiveRate + 0.005,
  ];

  // Facility structure — always revolving for AR
  suggestions.structureType = 'Revolving Credit Facility';

  if (compositeScore >= 75) {
    suggestions.structure =
      'Senior secured revolving credit facility backed by eligible accounts receivable. Standard ABL structure with monthly borrowing base certificates. Recommend 12-month term with annual renewal subject to field exam and portfolio review.';
  } else if (compositeScore >= 55) {
    suggestions.structure =
      'Revolving ABL facility with enhanced monitoring. Recommend bi-weekly borrowing base certificates, quarterly field exams, and concentration sublimits on top obligors. Consider a 12-month initial term with tighter covenants.';
  } else if (compositeScore >= 35) {
    suggestions.structure =
      'Revolving facility with reduced advance rate and enhanced controls. Require weekly borrowing base reporting, quarterly field exams, lockbox/dominion of funds provisions, and springing fixed charge coverage covenant.';
  } else {
    suggestions.structure =
      'Credit profile is weak for a standard ABL facility. If proceeding, structure as an over-collateralized revolver with daily dominion, reduced advance rate (65-70%), monthly field exams, and personal guarantee from principal(s).';
  }

  // Advance rate recommendation
  if (compositeScore >= 75 && metrics.dilutionRate <= DILUTION_THRESHOLD && metrics.concentrationRisk <= CONCENTRATION_THRESHOLD) {
    suggestions.advanceRate = '80–85% of eligible AR';
  } else if (compositeScore >= 55) {
    suggestions.advanceRate = '75–80% of eligible AR';
  } else if (compositeScore >= 35) {
    suggestions.advanceRate = '70–75% of eligible AR with dilution reserve';
  } else {
    suggestions.advanceRate = '65–70% of eligible AR with dilution and concentration reserves';
  }

  // Reporting requirements
  suggestions.reportingRequirements = [];
  if (compositeScore >= 75) {
    suggestions.reportingRequirements.push('Monthly borrowing base certificate');
    suggestions.reportingRequirements.push('Monthly AR aging schedule');
    suggestions.reportingRequirements.push('Annual field exam');
    suggestions.reportingRequirements.push('Annual audited financial statements');
  } else if (compositeScore >= 55) {
    suggestions.reportingRequirements.push('Bi-weekly borrowing base certificate');
    suggestions.reportingRequirements.push('Monthly AR aging schedule with roll-forward');
    suggestions.reportingRequirements.push('Semi-annual field exam');
    suggestions.reportingRequirements.push('Quarterly unaudited financials + annual audit');
    suggestions.reportingRequirements.push('Monthly dilution and concentration reporting');
  } else {
    suggestions.reportingRequirements.push('Weekly borrowing base certificate');
    suggestions.reportingRequirements.push('Weekly AR aging schedule');
    suggestions.reportingRequirements.push('Quarterly field exam');
    suggestions.reportingRequirements.push('Monthly unaudited financials + annual audit');
    suggestions.reportingRequirements.push('Daily cash dominion / lockbox');
    suggestions.reportingRequirements.push('Monthly dilution, concentration, and dispute reporting');
  }

  // Enhancements
  suggestions.enhancements = [];
  if (compositeScore < 55) {
    suggestions.enhancements.push('Personal guarantee from principal(s)');
  }
  if (metrics.concentrationRisk > CONCENTRATION_THRESHOLD) {
    suggestions.enhancements.push(
      `Concentration sublimit: cap advances against top obligor at ${(CONCENTRATION_THRESHOLD * 100).toFixed(0)}% of eligible AR`
    );
  }
  if (metrics.dilutionRate > DILUTION_THRESHOLD) {
    suggestions.enhancements.push(
      `Dilution reserve: hold back ${Math.ceil(metrics.dilutionRate * 100)}% of borrowing base as dilution cushion`
    );
  }
  if (metrics.dscr < 1.5) {
    suggestions.enhancements.push(
      'Springing fixed charge coverage ratio (minimum 1.10x) triggered when availability falls below threshold'
    );
  }
  if (metrics.leverage > 4.0) {
    suggestions.enhancements.push(
      'Maximum total leverage covenant of 4.0x with step-down schedule'
    );
  }
  if (compositeScore < 75 && compositeScore >= 35) {
    suggestions.enhancements.push(
      'Cash dominion / lockbox arrangement to ensure AR collections flow to the lender'
    );
  }
  if (inputs.existingABLFacility) {
    suggestions.enhancements.push(
      'Intercreditor / payoff of existing ABL facility required at closing'
    );
  }
  if (metrics.dso > 60) {
    suggestions.enhancements.push(
      'Eligibility criteria: exclude invoices > 90 days from invoice date (cross-aging provision)'
    );
  }

  // Facility sizing
  suggestions.facilitySize = metrics.borrowingBase;
  const maxSuggested = (inputs.ebitda || 0) * 3;
  if (metrics.borrowingBase > maxSuggested && maxSuggested > 0) {
    suggestions.sizingFlag = `Borrowing base of ${formatCurrency(metrics.borrowingBase)} is large relative to borrower's ${formatCurrency(inputs.ebitda)} EBITDA (${(metrics.borrowingBase / inputs.ebitda).toFixed(1)}x). Typical ABL facilities are self-liquidating, but assess whether borrower can manage facility costs at full utilization.`;
  }

  return suggestions;
}

// ------- Stress Testing -------

export function runStressTest(inputs, sofr = DEFAULT_SOFR) {
  const scenarios = [
    { label: 'Base Case', ebitdaDecline: 0, agingStress: 0, dilutionStress: 0 },
    { label: 'Mild Stress', ebitdaDecline: 0.10, agingStress: 0.10, dilutionStress: 0.02 },
    { label: 'Moderate Stress', ebitdaDecline: 0.20, agingStress: 0.20, dilutionStress: 0.04 },
    { label: 'Severe Stress', ebitdaDecline: 0.30, agingStress: 0.30, dilutionStress: 0.06 },
  ];

  return scenarios.map((scenario) => {
    const totalAR = inputs.totalAROutstanding || 0;
    // Stress aging: shift a portion of current AR into over-30
    const agingShift = totalAR * scenario.agingStress;
    const stressedArOver30 = (inputs.arOver30 || 0) + agingShift;

    // Stress dilution: add percentage points
    const stressedDilution = (inputs.dilutionRate || 0) + scenario.dilutionStress * 100;

    const stressed = {
      ...inputs,
      ebitda: (inputs.ebitda || 0) * (1 - scenario.ebitdaDecline),
      arOver30: stressedArOver30,
      dilutionRate: stressedDilution,
      // Increase ineligibles under stress as aged AR becomes ineligible
      ineligiblesPct: Math.min(
        (inputs.ineligiblesPct || 0) + scenario.agingStress * 15,
        60
      ),
    };

    const m = calculateMetrics(stressed, sofr);
    const rs = calculateRiskScore(stressed, m);

    return {
      label: scenario.label,
      decline: scenario.ebitdaDecline,
      ebitda: stressed.ebitda,
      dscr: m.dscr,
      leverage: m.leverage,
      borrowingBase: m.borrowingBase,
      eligibleAR: m.eligibleAR,
      score: rs.composite,
    };
  });
}

// ------- Validation -------

export function isInputValid(inputs) {
  return (
    (inputs.totalAROutstanding || 0) > 0 &&
    (inputs.annualRevenue || 0) > 0 &&
    (inputs.ebitda || 0) > 0
  );
}

// ------- Export Summary -------

export function generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, sofr = DEFAULT_SOFR) {
  const lines = [];
  lines.push('ACCOUNTS RECEIVABLE ABL FACILITY SCREENING');
  lines.push('PRELIMINARY ASSESSMENT');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Company:          ${inputs.companyName || 'N/A'}`);
  lines.push(`Industry:         ${inputs.industrySector}`);
  lines.push(`Credit Rating:    ${inputs.creditRating}`);
  lines.push(`Years in Business:${inputs.yearsInBusiness > 0 ? ' ' + inputs.yearsInBusiness : ' N/A'}`);
  lines.push(`Annual Revenue:   ${formatCurrencyFull(inputs.annualRevenue)}`);
  lines.push(`EBITDA:           ${formatCurrencyFull(inputs.ebitda)}`);
  lines.push(`Existing Debt:    ${formatCurrencyFull(inputs.totalExistingDebt)}`);
  lines.push(`Existing ABL:     ${inputs.existingABLFacility ? 'Yes' : 'No'}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('RECEIVABLES PROFILE');
  lines.push('-'.repeat(60));
  lines.push(`Total AR:         ${formatCurrencyFull(inputs.totalAROutstanding)}`);
  lines.push(`AR Under 30:      ${formatCurrencyFull(inputs.arUnder30)}`);
  lines.push(`AR 30-60 Days:    ${formatCurrencyFull(inputs.arOver30)}`);
  lines.push(`AR 60-90 Days:    ${formatCurrencyFull(inputs.arOver60)}`);
  lines.push(`AR Over 90 Days:  ${formatCurrencyFull(inputs.arOver90)}`);
  lines.push(`Ineligibles:      ${formatPercent(inputs.ineligiblesPct)}`);
  lines.push(`Eligible AR:      ${formatCurrencyFull(metrics.eligibleAR)}`);
  lines.push(`Advance Rate:     ${formatPercent(metrics.advanceRate * 100)}`);
  lines.push(`Borrowing Base:   ${formatCurrencyFull(metrics.borrowingBase)}`);
  lines.push(`DSO:              ${metrics.dso.toFixed(0)} days`);
  lines.push(`Top Cust. Conc.:  ${formatPercent(metrics.concentrationRisk * 100)}`);
  lines.push(`Dilution Rate:    ${formatPercent(metrics.dilutionRate * 100)}`);
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
  lines.push(`DSCR:             ${formatRatio(metrics.dscr)}  (min 1.10x for ABL)`);
  lines.push(`Leverage:         ${formatRatio(metrics.leverage)}  (target <4.0x)`);
  lines.push(`Effective Rate:   ${(metrics.effectiveRate * 100).toFixed(2)}%`);
  lines.push(`Est. Annual Cost: ${formatCurrencyFull(metrics.newAnnualDebtService)} (at full draw)`);
  lines.push(`Exist. Debt Svc:  ${formatCurrencyFull(metrics.existingDebtService)}${metrics.debtServiceEstimated ? ' (estimated)' : ''}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('FACILITY STRUCTURE');
  lines.push('-'.repeat(60));
  if (structure) {
    lines.push(`Type:             ${structure.structureType}`);
    lines.push(`Advance Rate:     ${structure.advanceRate}`);
    lines.push(`Facility Size:    ${formatCurrencyFull(structure.facilitySize || metrics.borrowingBase)}`);
    lines.push('');
    lines.push(structure.structure);
    if (structure.reportingRequirements && structure.reportingRequirements.length > 0) {
      lines.push('');
      lines.push('Reporting Requirements:');
      structure.reportingRequirements.forEach((r) => lines.push(`  - ${r}`));
    }
    if (structure.enhancements && structure.enhancements.length > 0) {
      lines.push('');
      lines.push('Suggested Enhancements:');
      structure.enhancements.forEach((e) => lines.push(`  - ${e}`));
    }
    if (structure.sizingFlag) {
      lines.push('');
      lines.push(`NOTE: ${structure.sizingFlag}`);
    }
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
    const flag = s.dscr < 1.0 ? ' ** BELOW 1.0x **' : s.dscr < 1.1 ? ' * Below ABL min *' : '';
    lines.push(
      `${s.label.padEnd(22)} EBITDA: ${formatCurrency(s.ebitda).padEnd(8)}  DSCR: ${s.dscr.toFixed(2)}x  BB: ${formatCurrency(s.borrowingBase)}${flag}`
    );
  });
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('DISCLAIMER: Preliminary screening only. Not a credit decision.');
  lines.push('Final terms subject to full underwriting, field exam, credit');
  lines.push('committee approval, and documentation.');
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
    actualannualdebtservice: 'actualAnnualDebtService',
    industrysector: 'industrySector', industry: 'industrySector',
    creditrating: 'creditRating', credit: 'creditRating',
    totalaroutstanding: 'totalAROutstanding', totalar: 'totalAROutstanding', ar: 'totalAROutstanding',
    arunder30: 'arUnder30',
    arover30: 'arOver30',
    arover60: 'arOver60',
    arover90: 'arOver90',
    topcustomerconcentration: 'topCustomerConcentration', concentration: 'topCustomerConcentration',
    dilutionrate: 'dilutionRate', dilution: 'dilutionRate',
    ineligiblespct: 'ineligiblesPct', ineligibles: 'ineligiblesPct',
    requestedadvancerate: 'requestedAdvanceRate', advancerate: 'requestedAdvanceRate',
    existingablfacility: 'existingABLFacility', existingabl: 'existingABLFacility',
  };

  const numericFields = new Set([
    'yearsInBusiness', 'annualRevenue', 'ebitda', 'totalExistingDebt',
    'actualAnnualDebtService', 'totalAROutstanding', 'arUnder30',
    'arOver30', 'arOver60', 'arOver90', 'topCustomerConcentration',
    'dilutionRate', 'ineligiblesPct', 'requestedAdvanceRate',
  ]);

  const booleanFields = new Set(['existingABLFacility']);

  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const values = line.split(',').map(v => v.trim());
    const inputs = {
      companyName: '',
      yearsInBusiness: 0, annualRevenue: 0, ebitda: 0, totalExistingDebt: 0,
      actualAnnualDebtService: 0,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      totalAROutstanding: 0, arUnder30: 0, arOver30: 0, arOver60: 0, arOver90: 0,
      topCustomerConcentration: 0, dilutionRate: 0, ineligiblesPct: 0,
      requestedAdvanceRate: 0.80, existingABLFacility: false,
    };

    headers.forEach((h, i) => {
      const field = fieldMap[h];
      if (!field || i >= values.length) return;
      const val = values[i];
      if (booleanFields.has(field)) {
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
