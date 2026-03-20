// ============================================================
// Inventory Finance Deal Screening — Scoring & Calculation Functions
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
  MAX_ADVANCE_RATE_RAW,
  MAX_ADVANCE_RATE_FINISHED,
  MAX_ADVANCE_RATE_WIP,
  OBSOLESCENCE_THRESHOLD,
  MIN_TURNOVER,
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
    totalInventory,
    rawMaterials,
    workInProgress,
    finishedGoods,
    obsoleteInventory,
    inventoryTurnover,
    averageDaysOnHand,
    requestedAdvanceRate,
    nolvPct,
    perishable,
  } = inputs;

  const rateInfo = getScreeningRate(creditRating, industrySector, sofr);
  const rate = rateInfo.allInRate;

  // --- Inventory composition ---
  const totalInv = totalInventory || 0;
  const raw = rawMaterials || 0;
  const wip = workInProgress || 0;
  const finished = finishedGoods || 0;
  const obsolete = obsoleteInventory || 0;

  // Composition percentages (of total)
  const compositionMix = {
    rawPct: totalInv > 0 ? raw / totalInv : 0,
    wipPct: totalInv > 0 ? wip / totalInv : 0,
    finishedPct: totalInv > 0 ? finished / totalInv : 0,
    obsoletePct: totalInv > 0 ? obsolete / totalInv : 0,
  };

  // Obsolescence rate
  const obsolescenceRate = totalInv > 0 ? obsolete / totalInv : 0;

  // --- Eligible inventory ---
  // Exclude obsolete inventory entirely.
  // WIP gets a haircut — only the portion within WIP advance rate is eligible.
  const eligibleRaw = raw;
  const eligibleWip = wip * MAX_ADVANCE_RATE_WIP / MAX_ADVANCE_RATE_FINISHED; // haircut WIP relative to finished
  const eligibleFinished = finished;
  const eligibleInventory = Math.max(totalInv - obsolete - (wip - eligibleWip), 0);

  // --- Blended advance rate based on composition ---
  // Each category has its own max advance rate; blend by eligible amounts.
  const rawContribution = raw * MAX_ADVANCE_RATE_RAW;
  const wipContribution = wip * MAX_ADVANCE_RATE_WIP;
  const finishedContribution = finished * MAX_ADVANCE_RATE_FINISHED;
  const totalEligibleValue = rawContribution + wipContribution + finishedContribution;
  const totalNonObsolete = raw + wip + finished;
  const blendedAdvanceRate = totalNonObsolete > 0
    ? totalEligibleValue / totalNonObsolete
    : 0;

  // Apply NOLV cap if provided — advance rate cannot exceed NOLV %
  const nolv = (nolvPct || 0) > 0 ? nolvPct : 1.0;
  const effectiveAdvanceRate = Math.min(blendedAdvanceRate, nolv);

  // Apply perishable discount — perishable goods get 15% haircut on advance rate
  const finalAdvanceRate = perishable
    ? effectiveAdvanceRate * 0.85
    : effectiveAdvanceRate;

  // Cap at requested advance rate if specified
  const appliedAdvanceRate = (requestedAdvanceRate || 0) > 0
    ? Math.min(finalAdvanceRate, requestedAdvanceRate)
    : finalAdvanceRate;

  // Borrowing base
  const borrowingBase = eligibleInventory * appliedAdvanceRate;

  // --- Turnover & days ---
  // Use provided turnover, or calculate from COGS estimate (revenue * 0.65 as proxy)
  const estimatedCOGS = annualRevenue * 0.65;
  const turnoverRatio = (inventoryTurnover || 0) > 0
    ? inventoryTurnover
    : (totalInv > 0 ? estimatedCOGS / totalInv : 0);

  const daysOnHand = (averageDaysOnHand || 0) > 0
    ? averageDaysOnHand
    : (turnoverRatio > 0 ? 365 / turnoverRatio : 0);

  // --- Debt service & credit metrics ---
  // For revolving facilities, annual debt service = borrowing base * rate (interest only)
  const newAnnualDebtService = borrowingBase * rate;
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
    ebitda > 0 ? ((totalExistingDebt || 0) + borrowingBase) / ebitda : 0;

  const effectiveRate = rate;

  return {
    eligibleInventory,
    borrowingBase,
    turnoverRatio,
    daysOnHand,
    obsolescenceRate,
    compositionMix,
    blendedAdvanceRate,
    appliedAdvanceRate,
    dscr,
    leverage,
    effectiveRate,
    rate,
    rateInfo,
    newAnnualDebtService,
    existingDebtService,
    debtServiceEstimated,
  };
}

// ------- Risk Scoring -------

export function calculateRiskScore(inputs, metrics) {
  const factors = {};

  // DSCR (20%) — higher is better
  factors.dscr = lerp(metrics.dscr, [
    [0, 5], [0.8, 15], [1.0, 25], [1.25, 50], [1.5, 72], [2.0, 90], [3.0, 100],
  ]);

  // Leverage (15%) — lower is better
  factors.leverage = lerp(metrics.leverage, [
    [0, 100], [2.0, 90], [3.5, 72], [5.0, 48], [7.0, 22], [10.0, 5],
  ]);

  // Inventory Quality (20%) — based on turnover and obsolescence
  // Turnover component (0-100): 6x+ is strong, <4x is concerning
  const turnoverScore = lerp(metrics.turnoverRatio, [
    [0, 5], [2, 15], [4, 45], [6, 75], [8, 90], [12, 100],
  ]);
  // Obsolescence component (0-100): lower is better
  const obsolescenceScore = lerp(metrics.obsolescenceRate, [
    [0, 100], [0.05, 80], [0.10, 55], [0.15, 30], [0.25, 10], [0.40, 0],
  ]);
  factors.inventoryQuality = Math.round(turnoverScore * 0.6 + obsolescenceScore * 0.4);

  // Composition (15%) — penalize high WIP concentration
  // Finished goods are best (most liquid), WIP is worst
  const wipPct = metrics.compositionMix.wipPct;
  const finishedPct = metrics.compositionMix.finishedPct;
  factors.composition = lerp(wipPct, [
    [0, 90], [0.10, 80], [0.20, 65], [0.35, 45], [0.50, 25], [0.70, 10],
  ]);
  // Bonus for high finished goods percentage
  if (finishedPct > 0.60) {
    factors.composition = Math.min(100, factors.composition + 10);
  }

  // Liquidation Value (10%) — NOLV percentage; higher is better
  const nolv = (inputs.nolvPct || 0) > 0 ? inputs.nolvPct : 0.50; // assume 50% if not provided
  factors.liquidationValue = lerp(nolv, [
    [0, 5], [0.20, 20], [0.40, 50], [0.55, 70], [0.70, 88], [0.85, 100],
  ]);

  // Years in Business (10%) — more is better
  factors.yearsInBusiness = lerp(inputs.yearsInBusiness, [
    [0, 15], [2, 40], [5, 65], [10, 85], [20, 95], [30, 100],
  ]);

  // Industry (10%) — categorical
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'low') factors.industry = 100;
  else if (tier === 'moderate') factors.industry = 65;
  else factors.industry = 35;

  const composite = Math.round(
    factors.dscr * 0.20 +
    factors.leverage * 0.15 +
    factors.inventoryQuality * 0.20 +
    factors.composition * 0.15 +
    factors.liquidationValue * 0.10 +
    factors.yearsInBusiness * 0.10 +
    factors.industry * 0.10
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
      `DSCR of ${metrics.dscr.toFixed(2)}x provides strong debt service coverage, well above typical minimum thresholds for inventory ABL facilities.`
    );
  } else if (metrics.dscr >= 1.5) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x indicates comfortable coverage cushion for total debt service obligations on the revolving facility.`
    );
  } else if (metrics.dscr >= 1.25) {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x is adequate but offers limited margin; recommend periodic borrowing base certificate reviews.`
    );
  } else {
    comments.push(
      `DSCR of ${metrics.dscr.toFixed(2)}x falls below typical minimum thresholds — borrower may struggle to service total debt obligations under full utilization.`
    );
  }

  // Turnover analysis
  if (metrics.turnoverRatio >= 8) {
    comments.push(
      `Inventory turnover of ${metrics.turnoverRatio.toFixed(1)}x is excellent — rapid conversion to cash reduces collateral risk and supports higher advance rates.`
    );
  } else if (metrics.turnoverRatio >= MIN_TURNOVER) {
    comments.push(
      `Inventory turnover of ${metrics.turnoverRatio.toFixed(1)}x is acceptable. Average days on hand of ${Math.round(metrics.daysOnHand)} days is within normal range for the sector.`
    );
  } else if (metrics.turnoverRatio >= 2) {
    comments.push(
      `Inventory turnover of ${metrics.turnoverRatio.toFixed(1)}x is below the ${MIN_TURNOVER.toFixed(1)}x minimum threshold — slow-moving inventory increases collateral risk and may warrant reduced advance rates or more frequent field exams.`
    );
  } else {
    comments.push(
      `Inventory turnover of ${metrics.turnoverRatio.toFixed(1)}x is critically low (${Math.round(metrics.daysOnHand)} days on hand). Significant risk of value deterioration; consider whether inventory-backed facility is appropriate.`
    );
  }

  // Composition risk
  const wipPct = metrics.compositionMix.wipPct;
  if (wipPct > 0.35) {
    comments.push(
      `Work-in-progress represents ${(wipPct * 100).toFixed(0)}% of total inventory — elevated WIP concentration limits liquidation value and caps advance rates at ${(MAX_ADVANCE_RATE_WIP * 100).toFixed(0)}% for that component.`
    );
  } else if (wipPct > 0.20) {
    comments.push(
      `WIP at ${(wipPct * 100).toFixed(0)}% of inventory is moderate; blended advance rate reflects the lower WIP cap of ${(MAX_ADVANCE_RATE_WIP * 100).toFixed(0)}%.`
    );
  }

  if (metrics.compositionMix.finishedPct > 0.60) {
    comments.push(
      `Finished goods comprise ${(metrics.compositionMix.finishedPct * 100).toFixed(0)}% of inventory — high liquidity supports stronger borrowing base and advance rates up to ${(MAX_ADVANCE_RATE_FINISHED * 100).toFixed(0)}%.`
    );
  }

  // Obsolescence concerns
  if (metrics.obsolescenceRate > OBSOLESCENCE_THRESHOLD) {
    comments.push(
      `Obsolete inventory at ${(metrics.obsolescenceRate * 100).toFixed(1)}% exceeds the ${(OBSOLESCENCE_THRESHOLD * 100).toFixed(0)}% threshold — recommend excluding obsolete stock from borrowing base and requiring quarterly inventory aging reports.`
    );
  } else if (metrics.obsolescenceRate > 0.05) {
    comments.push(
      `Obsolescence rate of ${(metrics.obsolescenceRate * 100).toFixed(1)}% is within acceptable range but should be monitored with periodic aging analysis.`
    );
  }

  // Liquidation value
  const nolv = (inputs.nolvPct || 0) > 0 ? inputs.nolvPct : null;
  if (nolv !== null) {
    if (nolv >= 0.65) {
      comments.push(
        `Net orderly liquidation value of ${(nolv * 100).toFixed(0)}% is strong — collateral recovery expectations support the proposed advance rate.`
      );
    } else if (nolv >= 0.45) {
      comments.push(
        `NOLV of ${(nolv * 100).toFixed(0)}% is within typical range for this inventory type; advance rate appropriately capped at NOLV.`
      );
    } else {
      comments.push(
        `NOLV of ${(nolv * 100).toFixed(0)}% is below average — low liquidation recovery increases loss severity in default; consider reducing advance rate or requiring additional collateral.`
      );
    }
  }

  // Perishable flag
  if (inputs.perishable) {
    comments.push(
      `Perishable inventory classification applies a 15% haircut to advance rates — shorter shelf life increases liquidation risk and requires accelerated monitoring.`
    );
  }

  // Industry
  const tier = INDUSTRY_RISK_TIER[inputs.industrySector] || 'moderate';
  if (tier === 'high') {
    comments.push(
      `${inputs.industrySector} sector carries cyclical/operational risk; consider tighter borrowing base covenants and more frequent field examinations.`
    );
  } else if (tier === 'low') {
    comments.push(
      `${inputs.industrySector} sector provides relatively stable demand characteristics, supporting inventory collateral value.`
    );
  }

  return comments.slice(0, 6);
}

// ------- Suggested Structure -------

export function getSuggestedStructure(inputs, metrics, compositeScore, sofr = DEFAULT_SOFR) {
  const suggestions = {};

  // Rate
  suggestions.rateInfo = metrics.rateInfo;
  suggestions.screeningRate = metrics.rate;

  // Indicative range: +/- 50 bps from screening rate
  suggestions.rateRange = [
    Math.max(metrics.rate - 0.005, sofr + 0.005),
    metrics.rate + 0.005,
  ];

  // Facility type — revolving credit facility with inventory sublimits
  suggestions.facilityType = 'Revolving Credit Facility';
  suggestions.structureType = 'Inventory ABL Revolver';

  // Borrowing base
  suggestions.maxCommitment = metrics.borrowingBase;
  suggestions.advanceRate = metrics.appliedAdvanceRate;

  // Sublimits by inventory category
  const raw = inputs.rawMaterials || 0;
  const wip = inputs.workInProgress || 0;
  const finished = inputs.finishedGoods || 0;
  suggestions.sublimits = {
    rawMaterials: { amount: raw * MAX_ADVANCE_RATE_RAW, advanceRate: MAX_ADVANCE_RATE_RAW },
    workInProgress: { amount: wip * MAX_ADVANCE_RATE_WIP, advanceRate: MAX_ADVANCE_RATE_WIP },
    finishedGoods: { amount: finished * MAX_ADVANCE_RATE_FINISHED, advanceRate: MAX_ADVANCE_RATE_FINISHED },
  };

  // Structure description
  if (compositeScore >= 75) {
    suggestions.structure =
      'Senior secured revolving credit facility backed by first-priority lien on all inventory. Borrowing base determined by eligible inventory categories with standard advance rates. Monthly borrowing base certificates with quarterly field exams.';
  } else if (compositeScore >= 55) {
    suggestions.structure =
      'Senior secured revolving credit facility with inventory borrowing base. Recommend monthly borrowing base reporting, semi-annual field exams, and quarterly inventory appraisals. Consider dominion-of-funds arrangement with springing cash dominion trigger.';
  } else if (compositeScore >= 35) {
    suggestions.structure =
      'Revolving facility with tightened inventory borrowing base — recommend reduced advance rates, monthly field exams during initial period, and full cash dominion. Weekly borrowing base certificates may be required.';
  } else {
    suggestions.structure =
      'Inventory ABL facility presents significant risk. If proceeding, structure with full cash dominion, weekly borrowing base certificates, monthly field exams, and reduced advance rates below standard caps. Personal guarantee recommended.';
  }

  // Field exam frequency
  if (compositeScore >= 75) {
    suggestions.fieldExamFrequency = 'Quarterly';
  } else if (compositeScore >= 55) {
    suggestions.fieldExamFrequency = 'Semi-annually, with quarterly appraisals';
  } else {
    suggestions.fieldExamFrequency = 'Monthly during initial 6-month period, then quarterly';
  }

  // Reporting requirements
  suggestions.reportingFrequency = compositeScore >= 55 ? 'Monthly' : 'Weekly';
  suggestions.reportingRequirements = [
    `${suggestions.reportingFrequency} borrowing base certificates`,
    'Perpetual inventory or cycle count reports',
    'Quarterly inventory aging analysis',
    'Annual third-party inventory appraisal',
  ];
  if (metrics.obsolescenceRate > OBSOLESCENCE_THRESHOLD) {
    suggestions.reportingRequirements.push('Monthly obsolescence / slow-moving inventory report');
  }
  if (inputs.perishable) {
    suggestions.reportingRequirements.push('Weekly shelf-life / expiration tracking report');
  }

  // Enhancements
  suggestions.enhancements = [];
  if (compositeScore < 55) {
    suggestions.enhancements.push('Personal guarantee from principal(s)');
  }
  if (metrics.dscr < 1.5) {
    suggestions.enhancements.push(
      'Minimum DSCR covenant of 1.25x tested quarterly'
    );
  }
  if (metrics.leverage > 4.0) {
    suggestions.enhancements.push(
      'Maximum leverage covenant or cross-collateralization with accounts receivable'
    );
  }
  if (metrics.turnoverRatio < MIN_TURNOVER) {
    suggestions.enhancements.push(
      'Inventory turnover covenant — require minimum ' + MIN_TURNOVER.toFixed(1) + 'x annual turnover'
    );
  }
  if (metrics.obsolescenceRate > OBSOLESCENCE_THRESHOLD) {
    suggestions.enhancements.push(
      'Mandatory inventory disposition plan for obsolete stock exceeding ' + (OBSOLESCENCE_THRESHOLD * 100).toFixed(0) + '% threshold'
    );
  }
  if (inputs.perishable) {
    suggestions.enhancements.push(
      'Accelerated monitoring and reduced advance rates for perishable inventory'
    );
  }
  if (compositeScore < 75 && compositeScore >= 35) {
    suggestions.enhancements.push(
      'Springing cash dominion with trigger based on excess availability falling below 15% of commitment'
    );
  }
  if (compositeScore < 35) {
    suggestions.enhancements.push(
      'Full cash dominion with lockbox arrangement'
    );
  }

  // Deal sizing flag
  const maxSuggested = (inputs.ebitda || 0) * 3;
  if (metrics.borrowingBase > maxSuggested && maxSuggested > 0) {
    suggestions.sizingFlag = `Borrowing base of ${formatCurrency(metrics.borrowingBase)} appears large relative to borrower's ${formatCurrency(inputs.ebitda)} EBITDA (${(metrics.borrowingBase / inputs.ebitda).toFixed(1)}x). Assess whether the borrower can absorb this level of revolving exposure.`;
  }

  return suggestions;
}

// ------- Stress Testing -------

export function runStressTest(inputs, sofr = DEFAULT_SOFR) {
  const scenarios = [
    { label: 'Base Case', ebitdaDecline: 0, obsolescenceIncrease: 0, turnoverDecline: 0 },
    { label: 'Mild Stress', ebitdaDecline: 0.10, obsolescenceIncrease: 0.05, turnoverDecline: 0.15 },
    { label: 'Moderate Stress', ebitdaDecline: 0.20, obsolescenceIncrease: 0.10, turnoverDecline: 0.25 },
    { label: 'Severe Stress', ebitdaDecline: 0.30, obsolescenceIncrease: 0.15, turnoverDecline: 0.40 },
  ];

  return scenarios.map((scenario) => {
    const stressedObsolete = Math.min(
      (inputs.obsoleteInventory || 0) + (inputs.totalInventory || 0) * scenario.obsolescenceIncrease,
      inputs.totalInventory || 0
    );
    const stressedTurnover = (inputs.inventoryTurnover || 0) > 0
      ? inputs.inventoryTurnover * (1 - scenario.turnoverDecline)
      : 0;

    const stressed = {
      ...inputs,
      ebitda: (inputs.ebitda || 0) * (1 - scenario.ebitdaDecline),
      obsoleteInventory: stressedObsolete,
      inventoryTurnover: stressedTurnover,
    };

    const m = calculateMetrics(stressed, sofr);
    const rs = calculateRiskScore(stressed, m);

    return {
      label: scenario.label,
      ebitdaDecline: scenario.ebitdaDecline,
      obsolescenceIncrease: scenario.obsolescenceIncrease,
      turnoverDecline: scenario.turnoverDecline,
      ebitda: stressed.ebitda,
      borrowingBase: m.borrowingBase,
      dscr: m.dscr,
      leverage: m.leverage,
      obsolescenceRate: m.obsolescenceRate,
      turnoverRatio: m.turnoverRatio,
      score: rs.composite,
    };
  });
}

// ------- Validation -------

export function isInputValid(inputs) {
  return (
    (inputs.totalInventory || 0) > 0 &&
    (inputs.annualRevenue || 0) > 0 &&
    (inputs.ebitda || 0) > 0
  );
}

// ------- Export Summary -------

export function generateExportSummary(inputs, metrics, riskScore, recommendation, commentary, structure, sofr = DEFAULT_SOFR) {
  const lines = [];
  lines.push('INVENTORY FINANCE DEAL SCREENING');
  lines.push('PRELIMINARY ASSESSMENT — ABL REVOLVING FACILITY');
  lines.push('='.repeat(60));
  lines.push('');
  lines.push(`Company:          ${inputs.companyName || 'N/A'}`);
  lines.push(`Industry:         ${inputs.industrySector}`);
  lines.push(`Credit Rating:    ${inputs.creditRating}`);
  lines.push(`Years in Business:${inputs.yearsInBusiness > 0 ? ' ' + inputs.yearsInBusiness : ' N/A'}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('INVENTORY PROFILE');
  lines.push('-'.repeat(60));
  lines.push(`Total Inventory:  ${formatCurrencyFull(inputs.totalInventory)}`);
  lines.push(`  Raw Materials:  ${formatCurrencyFull(inputs.rawMaterials)} (${(metrics.compositionMix.rawPct * 100).toFixed(1)}%)`);
  lines.push(`  Work-in-Progress: ${formatCurrencyFull(inputs.workInProgress)} (${(metrics.compositionMix.wipPct * 100).toFixed(1)}%)`);
  lines.push(`  Finished Goods: ${formatCurrencyFull(inputs.finishedGoods)} (${(metrics.compositionMix.finishedPct * 100).toFixed(1)}%)`);
  lines.push(`  Obsolete:       ${formatCurrencyFull(inputs.obsoleteInventory)} (${(metrics.obsolescenceRate * 100).toFixed(1)}%)`);
  lines.push(`Perishable:       ${inputs.perishable ? 'Yes' : 'No'}`);
  lines.push(`Turnover Ratio:   ${metrics.turnoverRatio.toFixed(1)}x`);
  lines.push(`Days on Hand:     ${Math.round(metrics.daysOnHand)} days`);
  if ((inputs.nolvPct || 0) > 0) {
    lines.push(`NOLV %:           ${(inputs.nolvPct * 100).toFixed(0)}%`);
  }
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('BORROWING BASE');
  lines.push('-'.repeat(60));
  lines.push(`Eligible Inventory: ${formatCurrencyFull(metrics.eligibleInventory)}`);
  lines.push(`Blended Adv. Rate:  ${(metrics.appliedAdvanceRate * 100).toFixed(1)}%`);
  lines.push(`Borrowing Base:     ${formatCurrencyFull(metrics.borrowingBase)}`);
  if (structure && structure.sublimits) {
    lines.push(`  Raw Materials:    ${formatCurrencyFull(structure.sublimits.rawMaterials.amount)} @ ${(structure.sublimits.rawMaterials.advanceRate * 100).toFixed(0)}%`);
    lines.push(`  WIP:              ${formatCurrencyFull(structure.sublimits.workInProgress.amount)} @ ${(structure.sublimits.workInProgress.advanceRate * 100).toFixed(0)}%`);
    lines.push(`  Finished Goods:   ${formatCurrencyFull(structure.sublimits.finishedGoods.amount)} @ ${(structure.sublimits.finishedGoods.advanceRate * 100).toFixed(0)}%`);
  }
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('SCREENING RESULT');
  lines.push('-'.repeat(60));
  lines.push(`Risk Score:       ${riskScore.composite}/100 — ${recommendation.category}`);
  lines.push(`Recommendation:   ${recommendation.detail}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('KEY METRICS');
  lines.push('-'.repeat(60));
  lines.push(`DSCR:             ${formatRatio(metrics.dscr)}  (min 1.25x)`);
  lines.push(`Leverage:         ${formatRatio(metrics.leverage)}  (target <3.5x)`);
  lines.push(`Turnover:         ${metrics.turnoverRatio.toFixed(1)}x  (min ${MIN_TURNOVER.toFixed(1)}x)`);
  lines.push(`Obsolescence:     ${formatPercent(metrics.obsolescenceRate * 100)}  (threshold ${formatPercent(OBSOLESCENCE_THRESHOLD * 100)})`);
  lines.push(`Screening Rate:   ${(metrics.rate * 100).toFixed(2)}%`);
  lines.push(`Annual DS (Est):  ${formatCurrencyFull(metrics.newAnnualDebtService)} (interest only at full draw)`);
  lines.push(`Existing DS:      ${formatCurrencyFull(metrics.existingDebtService)}${metrics.debtServiceEstimated ? ' (estimated)' : ''}`);
  lines.push('');
  lines.push('-'.repeat(60));
  lines.push('FACILITY STRUCTURE');
  lines.push('-'.repeat(60));
  if (structure) {
    lines.push(`Type:             ${structure.structureType}`);
    lines.push(`Field Exams:      ${structure.fieldExamFrequency}`);
    lines.push(`Reporting:        ${structure.reportingFrequency} borrowing base certificates`);
    lines.push('');
    lines.push(structure.structure);
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
    lines.push(
      `${s.label.padEnd(22)} EBITDA: ${formatCurrency(s.ebitda).padEnd(8)}  BB: ${formatCurrency(s.borrowingBase).padEnd(8)}  DSCR: ${s.dscr.toFixed(2)}x  Obsol: ${(s.obsolescenceRate * 100).toFixed(1)}%${flag}`
    );
  });
  if (structure && structure.enhancements && structure.enhancements.length > 0) {
    lines.push('');
    lines.push('-'.repeat(60));
    lines.push('SUGGESTED ENHANCEMENTS');
    lines.push('-'.repeat(60));
    structure.enhancements.forEach((e) => lines.push(`- ${e}`));
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
    totalinventory: 'totalInventory', inventory: 'totalInventory',
    rawmaterials: 'rawMaterials', raw: 'rawMaterials',
    workinprogress: 'workInProgress', wip: 'workInProgress',
    finishedgoods: 'finishedGoods', finished: 'finishedGoods',
    obsoleteinventory: 'obsoleteInventory', obsolete: 'obsoleteInventory',
    inventoryturnover: 'inventoryTurnover', turnover: 'inventoryTurnover',
    averagedaysonhand: 'averageDaysOnHand', daysonhand: 'averageDaysOnHand',
    requestedadvancerate: 'requestedAdvanceRate', advancerate: 'requestedAdvanceRate',
    nolvpct: 'nolvPct', nolv: 'nolvPct',
    perishable: 'perishable',
  };

  const numericFields = new Set([
    'yearsInBusiness', 'annualRevenue', 'ebitda', 'totalExistingDebt',
    'totalInventory', 'rawMaterials', 'workInProgress', 'finishedGoods',
    'obsoleteInventory', 'inventoryTurnover', 'averageDaysOnHand',
    'requestedAdvanceRate', 'nolvPct',
  ]);

  return lines.slice(1).filter(l => l.trim()).map((line, idx) => {
    const values = line.split(',').map(v => v.trim());
    const deal = {
      companyName: '',
      yearsInBusiness: 0, annualRevenue: 0, ebitda: 0, totalExistingDebt: 0,
      actualAnnualDebtService: 0,
      industrySector: 'Manufacturing', creditRating: 'Adequate',
      totalInventory: 0, rawMaterials: 0, workInProgress: 0, finishedGoods: 0,
      obsoleteInventory: 0, inventoryTurnover: 0, averageDaysOnHand: 0,
      requestedAdvanceRate: 0, nolvPct: 0, perishable: false,
    };

    headers.forEach((h, i) => {
      const field = fieldMap[h];
      if (!field || i >= values.length) return;
      const val = values[i];
      if (field === 'perishable') {
        deal[field] = ['true', 'yes', '1', 'y'].includes(val.toLowerCase());
      } else if (numericFields.has(field)) {
        deal[field] = parseFloat(val.replace(/[^0-9.-]/g, '')) || 0;
      } else {
        deal[field] = val;
      }
    });

    return { id: `CSV-${String(idx + 1).padStart(3, '0')}`, inputs: deal };
  });
}
