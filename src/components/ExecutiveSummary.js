import React from 'react';
import { formatCurrency, formatPercent } from '../utils/calculations';

function generateTakeaways(inputs, metrics, riskScore, recommendation) {
  const items = [];
  const ft = inputs.financingType || 'EFA';

  // 1. Lead with the verdict
  if (riskScore.composite >= 75) {
    items.push({
      type: 'positive',
      text: `This deal scores ${riskScore.composite}/100, which is a strong screening result. It is a good candidate to move forward into underwriting.`,
    });
  } else if (riskScore.composite >= 55) {
    items.push({
      type: 'neutral',
      text: `This deal scores ${riskScore.composite}/100, which puts it in moderate territory. It is worth pursuing, but expect to need mitigants or structural adjustments before approval.`,
    });
  } else if (riskScore.composite >= 35) {
    items.push({
      type: 'caution',
      text: `This deal scores ${riskScore.composite}/100, which is borderline. It would need significant structural enhancements or additional credit support to move forward.`,
    });
  } else {
    items.push({
      type: 'negative',
      text: `This deal scores ${riskScore.composite}/100, which is below minimum credit thresholds in its current form. It is unlikely to advance without a material change in structure or borrower profile.`,
    });
  }

  // 2. Biggest strength
  const factorEntries = Object.entries(riskScore.factors).sort((a, b) => b[1] - a[1]);
  const strongest = factorEntries[0];
  const factorDescriptions = {
    dscr: 'The borrower\'s debt service coverage is the strongest part of this deal.',
    leverage: 'The borrower\'s low leverage relative to earnings is the strongest part of this deal.',
    industry: 'The borrower\'s industry carries relatively low risk, which helps the overall profile.',
    essentiality: 'The equipment being essential to operations strengthens the recovery outlook.',
    equipmentLtv: 'Strong collateral coverage is the most favorable aspect of this deal.',
    yearsInBusiness: 'The borrower\'s long operating history is a notable positive here.',
    termCoverage: 'The loan term is well within the equipment\'s useful life, which reduces residual risk.',
    arQuality: 'The receivables aging profile is strong, indicating healthy collection patterns.',
    concentration: 'Customer diversification is a notable positive — no single obligor dominates.',
    dilution: 'Low dilution indicates stable invoicing practices with minimal credits and returns.',
    inventoryQuality: 'Inventory quality — strong turnover and low obsolescence — is the deal\'s best attribute.',
    composition: 'The inventory composition skews toward finished goods, which supports higher advance rates.',
    liquidationValue: 'The appraised liquidation value provides solid collateral protection.',
  };
  if (strongest[1] >= 80) {
    items.push({
      type: 'positive',
      text: factorDescriptions[strongest[0]] || `The strongest scoring factor is ${strongest[0]}.`,
    });
  }

  // 3. Biggest weakness
  const weakest = factorEntries[factorEntries.length - 1];
  const weakDescriptions = {
    dscr: 'Debt service coverage is the weakest area here and should be the primary focus of diligence.',
    leverage: 'High leverage relative to earnings is the primary concern. It is important to understand the borrower\'s capacity to take on this additional debt.',
    industry: 'The borrower\'s industry carries above-average risk, which weighs on the overall score.',
    essentiality: 'The equipment is not classified as essential to operations, which weakens the expected recovery profile in a downside scenario.',
    equipmentLtv: 'Collateral coverage is the weakest factor here. A larger equity contribution or down payment would help strengthen the lender\'s position.',
    yearsInBusiness: 'The borrower has a limited operating track record, which adds uncertainty to the credit profile.',
    termCoverage: 'The loan term is long relative to the equipment\'s useful life, which creates residual value risk toward the end of the term.',
    arQuality: 'The receivables aging profile is concerning — a significant portion of AR is past due, which reduces the effective borrowing base.',
    concentration: 'Customer concentration is high, meaning a single obligor default could materially impact the borrowing base.',
    dilution: 'The dilution rate is elevated, suggesting frequent credits, returns, or adjustments that erode collateral value.',
    inventoryQuality: 'Inventory quality is the weakest factor — slow turnover or high obsolescence increases collateral risk.',
    composition: 'Heavy work-in-progress concentration limits liquidation value and caps advance rates.',
    liquidationValue: 'The appraised liquidation value is low, meaning recovery in a default scenario would be limited.',
  };
  if (weakest[1] < 60) {
    items.push({
      type: 'caution',
      text: weakDescriptions[weakest[0]] || `The weakest scoring factor is ${weakest[0]}.`,
    });
  }

  // 4. DSCR cushion / risk
  if (metrics.dscr >= 1.25 && metrics.dscr < 1.5) {
    const cushionPct = Math.round((1 - (1.25 / metrics.dscr)) * 100);
    items.push({
      type: 'caution',
      text: `DSCR of ${metrics.dscr.toFixed(2)}x clears the 1.25x minimum, but there is only about ${cushionPct}% of room before a decline in earnings would push it below that threshold.`,
    });
  } else if (metrics.dscr < 1.25) {
    const totalDS = metrics.existingDebtService + metrics.newAnnualDebtService;
    const ebitdaNeeded = totalDS * 1.25;
    const gap = ebitdaNeeded - inputs.ebitda;
    items.push({
      type: 'negative',
      text: `DSCR of ${metrics.dscr.toFixed(2)}x falls short of the 1.25x minimum. To reach that threshold, the borrower would need roughly ${formatCurrency(gap)} in additional annual earnings, or the deal would need to be restructured to reduce total debt service.`,
    });
  }

  // 5. EBITDA margin context (equipment only)
  if (metrics.ebitdaMargin !== undefined && metrics.ebitdaMargin > 0) {
    if (metrics.ebitdaMargin < 10) {
      items.push({
        type: 'caution',
        text: `The EBITDA margin is ${metrics.ebitdaMargin.toFixed(1)}%, which is on the thin side. There is not much room to absorb unexpected costs or a dip in revenue before cash flow is impacted.`,
      });
    } else if (metrics.ebitdaMargin >= 25) {
      items.push({
        type: 'positive',
        text: `The EBITDA margin of ${metrics.ebitdaMargin.toFixed(1)}% reflects solid operating profitability, giving the borrower a healthy cushion above their fixed costs.`,
      });
    }
  }

  // 6. LTV / equity (equipment only)
  if (metrics.ltv !== undefined && metrics.ltv > 1.0) {
    items.push({
      type: 'negative',
      text: `LTV is over 100%, meaning the financing exceeds the equipment's value. An equity contribution or additional collateral would be needed to bring this in line.`,
    });
  } else if (metrics.ltv !== undefined && (inputs.downPayment || 0) > 0 && metrics.ltv <= 0.85) {
    items.push({
      type: 'positive',
      text: `The ${formatCurrency(inputs.downPayment)} down payment brings LTV to ${formatPercent(metrics.ltv * 100)}, which gives the lender a solid collateral cushion.`,
    });
  }

  // 7. Structure note
  if (ft === 'FMV') {
    items.push({
      type: 'neutral',
      text: `This is structured as an FMV lease with an estimated ${formatCurrency(metrics.residualValue)} residual. That lowers periodic payments, but the lessor takes on residual value risk at maturity.`,
    });
  } else if (ft === 'TRAC') {
    items.push({
      type: 'neutral',
      text: `This is a TRAC lease where the lessee guarantees a ${formatCurrency(metrics.residualValue)} residual value. That shifts the residual risk to the lessee and reduces lessor exposure.`,
    });
  }

  // Return top 4 most relevant
  return items.slice(0, 4);
}

const TYPE_STYLES = {
  positive: { icon: 'text-emerald-400', bg: 'bg-emerald-500/[0.04]' },
  neutral: { icon: 'text-gold-400', bg: 'bg-gold-500/[0.04]' },
  caution: { icon: 'text-amber-400', bg: 'bg-amber-500/[0.04]' },
  negative: { icon: 'text-rose-400', bg: 'bg-rose-500/[0.04]' },
};

const TYPE_ICONS = {
  positive: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  neutral: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4M12 8h.01" />
    </svg>
  ),
  caution: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  negative: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  ),
};

export default function ExecutiveSummary({ inputs, metrics, riskScore, recommendation }) {
  const takeaways = generateTakeaways(inputs, metrics, riskScore, recommendation);

  return (
    <div className={`rounded-2xl p-5 border ${recommendation.bgClass}`}>
      <div className="flex items-center gap-2 mb-3">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          Executive Summary
        </h3>
      </div>

      <div className="space-y-2">
        {takeaways.map((item, i) => {
          const style = TYPE_STYLES[item.type];
          return (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl px-3 py-2 ${style.bg}`}>
              <span className={`mt-0.5 flex-shrink-0 ${style.icon}`}>
                {TYPE_ICONS[item.type]}
              </span>
              <p className="text-[13px] text-slate-300 leading-relaxed">{item.text}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
