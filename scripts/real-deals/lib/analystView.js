// ============================================================
// What an analyst wants next to a verdict, and what would change it.
//
// Everything here is arithmetic on the cited figures or on Tranche's
// own metrics, inverted against the firm's thresholds. Nothing is
// estimated. Where no arithmetic can fix the problem (negative EBITDA),
// the text says so plainly.
//
// Prototype for the app's verdict panel and memo (AUDIT P1-16).
// ============================================================

const money = (n) =>
  n == null ? 'n/a' : `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
const pct = (r) => `${(r * 100).toFixed(0)}%`;

/** Five-year maturity wall from maturityY1..Y5 figures. Null years stay null. */
function maturityWall(value) {
  return [1, 2, 3, 4, 5].map((y) => ({ year: y, amount: value(`maturityY${y}`) }));
}

/**
 * Liquidity against one year of obligations, before the new loan.
 * cashAfterYear assumes this year's cash flow repeats: liquidity plus
 * (EBITDA - maintenance capex) minus existing debt service.
 */
function liquidityRunway({ cash, availability, ebitda, maintenanceCapex, debtService }) {
  if (cash == null) return null;
  const liquidity = cash + (availability || 0);
  const monthsOfDebtService = debtService > 0 ? liquidity / (debtService / 12) : null;
  const cashFlow = ebitda != null ? ebitda - (maintenanceCapex || 0) : null;
  const cashAfterYear = cashFlow != null && debtService != null ? liquidity + cashFlow - debtService : null;
  return { liquidity, monthsOfDebtService, cashFlow, cashAfterYear };
}

/**
 * For each threshold: if breached, what would have to change to clear it.
 * If cleared, how much room there is. Uses the same metrics and criteria
 * as the verdict.
 */
function whatWouldChange(inputs, metrics, risk, factors, criteria) {
  const changes = [];
  const headroom = [];
  const ebitda = inputs.ebitda;
  const totalDs = (metrics.existingDebtService || 0) + (metrics.newAnnualDebtService || 0);
  const debt = (inputs.totalExistingDebt || 0) + (metrics.netFinanced || 0);

  if (!(ebitda > 0)) {
    changes.push(`EBITDA is ${money(ebitda)}. No change to this loan's terms fixes coverage or leverage. Not a cash-flow credit at these numbers. It would need a collateral-based structure or outside support (guarantor, sponsor equity).`);
  } else {
    // DSCR
    const floor = criteria.minDscr;
    if (metrics.dscr < floor) {
      const needEbitda = floor * totalDs;
      changes.push(`DSCR ${metrics.dscr.toFixed(2)}x vs ${floor}x floor: EBITDA would need to reach ${money(needEbitda)} (+${pct(needEbitda / ebitda - 1)}), or total debt service fall to ${money(ebitda / floor)} from ${money(totalDs)}.`);
      if ((metrics.existingDebtService || 0) * floor > ebitda) {
        changes.push(`Fails before this loan: existing debt service alone needs EBITDA of ${money((metrics.existingDebtService || 0) * floor)}. Restructuring the new loan cannot fix it.`);
      }
    } else {
      headroom.push(`EBITDA can fall ${pct(1 - (floor * totalDs) / ebitda)} before DSCR reaches the ${floor}x floor.`);
    }
    // Leverage
    const cap = criteria.maxLeverage;
    if (metrics.leverage > cap) {
      changes.push(`Leverage ${metrics.leverage.toFixed(1)}x vs ${cap}x ceiling: EBITDA would need to reach ${money(debt / cap)} (+${pct(debt / cap / ebitda - 1)}), or debt fall to ${money(cap * ebitda)} from ${money(debt)}.`);
      if ((inputs.totalExistingDebt || 0) > cap * ebitda) {
        changes.push(`Over the ceiling before this loan: existing debt of ${money(inputs.totalExistingDebt)} is already ${((inputs.totalExistingDebt || 0) / ebitda).toFixed(1)}x EBITDA.`);
      }
    } else {
      headroom.push(`EBITDA can fall ${pct(1 - debt / (cap * ebitda))} before leverage reaches the ${cap}x ceiling.`);
    }
  }

  // LTV (percent in criteria, ratio in metrics)
  if (criteria.maxLtv > 0 && metrics.ltv * 100 > criteria.maxLtv) {
    const maxFinanced = (criteria.maxLtv / 100) * metrics.equipmentValue;
    changes.push(`LTV ${pct(metrics.ltv)} vs ${criteria.maxLtv}% limit: a down payment of ${money(inputs.equipmentCost - maxFinanced)} clears it.`);
  }

  // Term coverage
  if (criteria.maxTermCoverage > 0 && metrics.termCoverage > criteria.maxTermCoverage) {
    const maxMonths = Math.floor((criteria.maxTermCoverage / 100) * inputs.usefulLife * 12);
    changes.push(`Term is ${metrics.termCoverage.toFixed(0)}% of useful life vs ${criteria.maxTermCoverage}% limit: a term of ${maxMonths} months or less clears it.`);
  }

  // Composite score: where the points are lost.
  if (risk.composite < criteria.passScore) {
    const drags = factors
      .map((f) => ({ label: f.label, lost: f.weight * (100 - f.score) }))
      .sort((a, b) => b.lost - a.lost)
      .slice(0, 3)
      .map((d) => `${d.label} (-${d.lost.toFixed(1)})`);
    changes.push(`Score ${risk.composite} vs ${criteria.passScore} to pass: ${criteria.passScore - risk.composite} points short. Most points lost on ${drags.join(', ')}.`);
  }

  return { changes, headroom };
}

module.exports = { maturityWall, liquidityRunway, whatWouldChange, money };
