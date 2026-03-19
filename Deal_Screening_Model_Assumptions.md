# Equipment Finance Deal Screening Model
## Assumptions, Methodology & Knowledge Base

---

## 1. Purpose & Scope

This dashboard is a **preliminary screening tool** for equipment finance deals. It is designed to help a deal team quickly assess whether a proposed transaction is worth advancing to formal underwriting. It does **not** replace credit committee review, full underwriting, or legal documentation.

The model produces a composite risk score (0-100), financial metrics, commentary, stress tests, and structural recommendations based on borrower financials, equipment details, and deal terms.

---

## 2. Market Rate Assumptions

| Parameter | Value | Rationale |
|-----------|-------|-----------|
| **SOFR Base Rate** | 4.50% | Reflects current secured overnight financing rate. Must be updated periodically to track market. |
| **Base Credit Spread** | +200 bps | Starting spread over SOFR before credit/industry adjustments. Represents a middle-market equipment finance baseline. |
| **Existing Debt Service Rate** | 8.00% blended | When actual debt service is unknown, existing debt is assumed to carry an 8% annual cost (interest + principal). This is a conservative middle-market estimate. |

### Credit Rating Spread Adjustments

| Rating | Spread Adjustment | Resulting Range |
|--------|-------------------|-----------------|
| Strong | -75 bps | SOFR + 125 bps |
| Adequate | +0 bps | SOFR + 200 bps |
| Not Rated | +100 bps | SOFR + 300 bps |
| Weak | +200 bps | SOFR + 400 bps |

**Assumption:** Credit ratings are self-reported or assessed qualitatively. "Strong" approximates investment-grade equivalents. "Weak" reflects below-average credit profiles. These are screening estimates, not formal credit grades.

### Industry Risk Tier Spread Adjustments

| Tier | Industries | Spread Adjustment |
|------|-----------|-------------------|
| **Low Risk** | Healthcare, Infrastructure, Manufacturing | -25 bps |
| **Moderate Risk** | Transportation/Logistics, Energy, Rail, Other | +0 bps |
| **High Risk** | Construction, Marine, Mining, Aviation, Agriculture | +75 bps |

**Assumption:** Industry tiers reflect cyclicality and historical default rates in equipment finance. Low-risk industries have stable demand; high-risk industries are subject to commodity prices, regulatory shifts, or seasonal volatility.

---

## 3. Equipment Valuation Assumptions

### Used Equipment Discount
- Used equipment is valued at **85% of stated cost** (15% haircut)
- New equipment is valued at face cost
- **Rationale:** Used equipment has uncertain condition, higher maintenance risk, and less predictable residual value. The 15% discount is a conservative screening-level assumption; formal underwriting should use an independent appraisal.

### Equipment Type Defaults

| Equipment Type | Useful Life Range (yrs) | Suggested Structure | Typical Down Payment |
|----------------|------------------------|--------------------|--------------------|
| Heavy Machinery | 10-20 | EFA | 15% |
| Vehicles/Fleet | 5-8 | TRAC | 10% |
| Rail Cars | 25-35 | EFA | 10% |
| Marine Vessels | 15-25 | EFA | 15% |
| Aircraft/Helicopters | 12-20 | FMV | 20% |
| Medical Equipment | 7-12 | FMV | 10% |
| IT/Data Center | 3-7 | FMV | 10% |
| Construction Equipment | 8-15 | EFA | 15% |
| Energy/Power Generation | 15-25 | EFA | 15% |
| Other | 5-15 | EFA | 10% |

**Assumption:** Useful life ranges are based on general industry expectations for well-maintained equipment. Actual useful life depends on usage intensity, maintenance, and operating environment.

---

## 4. Financing Structure Assumptions

### EFA (Equipment Finance Agreement)
- Borrower takes ownership of equipment
- Fully amortizing payments (no residual)
- First-priority lien on financed equipment
- Net financed = Equipment Cost - Down Payment

### FMV (Fair Market Value Lease)
- Lessee has option to purchase at fair market value, return, or renew at term end
- Lower periodic payments because a **residual value** is excluded from amortization
- Lessor bears residual value risk
- Residual percentages by equipment type:

| Equipment Type | FMV Residual % of Cost |
|----------------|----------------------|
| Vehicles/Fleet | 25% |
| Aircraft/Helicopters | 20% |
| Rail Cars | 20% |
| Heavy Machinery | 15% |
| Marine Vessels | 15% |
| Construction Equipment | 15% |
| Energy/Power Generation | 12% |
| Medical Equipment | 10% |
| IT/Data Center | 5% |
| Other | 10% |

**Assumption:** Residual values reflect general remarketing expectations. IT/Data Center equipment depreciates fastest due to technological obsolescence. Vehicles retain value relatively well due to active secondary markets.

### TRAC (Terminal Rental Adjustment Clause) Lease
- Only available for **Vehicles/Fleet** and **Rail Cars**
- Lessee guarantees a terminal residual value
- If disposition proceeds differ from guarantee, a rental adjustment applies
- Residual: 20% for Vehicles/Fleet, 15% for Rail Cars

---

## 5. Key Financial Metrics & Thresholds

### DSCR (Debt Service Coverage Ratio)
- **Formula:** EBITDA / (Existing Annual Debt Service + New Annual Debt Service)
- Existing debt service: uses actual if provided, otherwise estimated at 8% of total existing debt

| DSCR | Assessment |
|------|-----------|
| > 2.00x | Excellent -- strong coverage cushion |
| 1.50x - 2.00x | Good -- comfortable coverage |
| 1.25x - 1.50x | Adequate -- limited margin |
| < 1.25x | Weak -- below typical minimum threshold |

**Assumption:** 1.25x is the minimum DSCR threshold for most equipment finance. Below this, the borrower may struggle to service total debt obligations. The 8% estimate for unknown existing debt service is conservative; actual rates could be higher or lower.

### Leverage (Total Debt / EBITDA)
- **Formula:** (Total Existing Debt + Net Financed Amount) / EBITDA

| Leverage | Assessment |
|----------|-----------|
| < 2.0x | Excellent -- significant balance sheet capacity |
| 2.0x - 3.5x | Good -- moderate leverage |
| 3.5x - 5.0x | Adequate -- approaching limits |
| > 5.0x | Weak -- elevated, may be unfeasible |

**Assumption:** Leverage measures total indebtedness relative to cash flow. These thresholds are typical for middle-market commercial lending. Asset-heavy industries (rail, infrastructure) may tolerate higher leverage due to collateral value.

### LTV (Loan-to-Value)
- **Formula:** Net Financed Amount / Equipment Value
- Equipment value = cost (new) or cost * 0.85 (used)

| LTV | Assessment |
|-----|-----------|
| <= 75% | Excellent -- strong collateral cushion |
| 75% - 85% | Good |
| 85% - 100% | Adequate |
| > 100% | Weak -- financed amount exceeds equipment value |

**Assumption:** LTV above 100% means the lender has negative equity from day one. Down payments directly reduce LTV and are a primary structural mitigant.

### Term-to-Useful-Life Coverage
- **Formula:** (Loan Term in Years / Equipment Useful Life in Years) * 100

| Coverage | Assessment |
|----------|-----------|
| < 60% | Excellent -- significant remaining useful life at payoff |
| 60% - 80% | Good |
| > 80% | Weak -- elevated residual value risk |

**Assumption:** If the loan term exceeds 80% of useful life, the equipment may have little remaining value at maturity, increasing loss-given-default risk.

### Revenue Concentration
- **Formula:** (Equipment Cost / Annual Revenue) * 100

| Concentration | Assessment |
|---------------|-----------|
| < 15% | Excellent -- small relative to operations |
| 15% - 25% | Good |
| > 25% | Weak -- large exposure relative to borrower size |

**Assumption:** A single equipment purchase exceeding 25% of revenue represents a concentrated bet. If the equipment underperforms or the business contracts, the payment burden becomes disproportionate.

### Additional Metrics (Informational)
- **EBITDA Margin** = EBITDA / Revenue (measures profitability)
- **Debt Yield** = EBITDA / Net Financed Amount (measures cash flow relative to new debt)

---

## 6. Composite Risk Scoring Model

The composite score (0-100) is a **weighted average** of seven factor scores. Each factor is scored 0-100 using linear interpolation between defined breakpoints, then weighted:

| Factor | Weight | What It Measures | Scoring Direction |
|--------|--------|------------------|-------------------|
| **DSCR** | 25% | Ability to service all debt | Higher is better |
| **Leverage** | 20% | Total indebtedness vs. cash flow | Lower is better |
| **Industry Risk** | 15% | Sector cyclicality & default history | Categorical (Low=100, Moderate=65, High=35) |
| **Essentiality** | 10% | Whether equipment is critical to operations | Yes=100, No=30 |
| **Equipment/LTV** | 10% | Collateral coverage + condition bonus | Lower LTV is better; +8 pts for new equipment |
| **Years in Business** | 10% | Operating track record | More years is better |
| **Term Coverage** | 10% | Loan term vs. equipment useful life | Lower ratio is better |

### DSCR Scoring Breakpoints (25% weight)
| DSCR | Score |
|------|-------|
| 0.0x | 5 |
| 0.8x | 15 |
| 1.0x | 25 |
| 1.25x | 50 |
| 1.5x | 72 |
| 2.0x | 90 |
| 3.0x+ | 100 |

### Leverage Scoring Breakpoints (20% weight)
| Leverage | Score |
|----------|-------|
| 0.0x | 100 |
| 2.0x | 90 |
| 3.5x | 72 |
| 5.0x | 48 |
| 7.0x | 22 |
| 10.0x+ | 5 |

### Equipment/LTV Scoring Breakpoints (10% weight)
| LTV | Score |
|-----|-------|
| 0% | 95 |
| 60% | 90 |
| 75% | 78 |
| 85% | 65 |
| 100% | 45 |
| 120%+ | 20 |

*New equipment adds +8 bonus points (capped at 100).*

### Years in Business Breakpoints (10% weight)
| Years | Score |
|-------|-------|
| 0 | 15 |
| 2 | 40 |
| 5 | 65 |
| 10 | 85 |
| 20 | 95 |
| 30+ | 100 |

### Term Coverage Breakpoints (10% weight)
| Coverage % | Score |
|------------|-------|
| 0% | 100 |
| 40% | 95 |
| 60% | 78 |
| 80% | 45 |
| 100% | 15 |

### Score Interpretation

| Score Range | Category | Recommendation |
|-------------|----------|----------------|
| 75-100 | **Strong Prospect** | Recommend advancing to underwriting |
| 55-74 | **Moderate Prospect** | Worth pursuing with identified mitigants |
| 35-54 | **Borderline** | Requires additional diligence or structural enhancements |
| 0-34 | **Weak Prospect** | Likely does not meet credit thresholds |

**Key Assumption:** The weighting reflects equipment finance industry norms where debt service coverage is the single most important predictor of repayment, followed by overall leverage. Industry and essentiality capture qualitative risk that financial ratios alone miss.

---

## 7. Stress Testing Methodology

The model applies EBITDA decline scenarios to simulate borrower cash flow deterioration:

| Scenario | EBITDA Decline | Purpose |
|----------|---------------|---------|
| Base Case | 0% | Current state |
| Mild Stress | -10% | Normal business volatility |
| Moderate Stress | -20% | Recessionary conditions |
| Severe Stress | -30% | Significant downturn / industry shock |

For each scenario, the model recalculates DSCR, leverage, and the composite risk score. This shows how much cushion exists before the deal "breaks" (e.g., DSCR falls below 1.0x).

**Assumption:** Only EBITDA is stressed. Revenue, debt levels, and deal terms remain constant. In reality, distressed borrowers may also face rising costs, lost customers, or covenant triggers.

---

## 8. Structural Enhancement Triggers

The model recommends deal enhancements based on metric thresholds:

| Condition | Enhancement Suggested |
|-----------|-----------------------|
| Score < 55 | Personal guarantee from principal(s) |
| Term > 80% of useful life | Reduce term below 80% |
| DSCR < 1.5x | Cash sweep or step-up payments to accelerate deleveraging |
| Leverage > 4.0x | Additional collateral or cross-collateralization |
| Score 35-74 | Maintenance reserve account |
| Revenue concentration > 25% | Phased funding or reduced deal size |
| LTV > 90% with no down payment | Require 10-15% equity contribution |
| Deal size > 3x EBITDA | Sizing flag -- assess borrower capacity |

---

## 9. Comparable Deal Matching

Historical deals are matched to the current deal using a similarity score:

| Match Criteria | Max Points |
|----------------|------------|
| Same industry sector | 30 |
| Same equipment type | 20 |
| Revenue within 2x | 15 (within 5x = 7) |
| EBITDA within 2x | 10 (within 4x = 5) |
| Equipment cost within 2x | 10 (within 4x = 5) |
| Same credit rating | 10 |
| Same financing structure | 5 |

Deals scoring >= 20 points of similarity are shown as comparables, sorted by match strength. Historical outcomes (Performing, Paid Off, Watchlist, Defaulted) provide precedent context.

**Assumption:** Past deal performance is directional, not predictive. Market conditions, management quality, and specific circumstances vary.

---

## 10. Amortization Calculation

Monthly payments are calculated using the standard fixed-rate amortization formula:

```
Payment = Principal * [r(1+r)^n] / [(1+r)^n - 1]

Where:
  r = annual rate / 12 (monthly rate)
  n = term in months
  Principal = net financed amount (for EFA) or net financed minus residual (for FMV/TRAC)
```

The amortization schedule produces annual summaries showing principal, interest, total payment, and ending balance for each year.

---

## 11. Due Diligence Checklist Logic

The checklist is dynamically generated based on the deal's risk profile. Items are triggered by specific conditions:

| Trigger | Checklist Item Generated |
|---------|------------------------|
| Always | 3 years audited/reviewed financial statements |
| DSCR < 1.5x | Request trailing quarterly EBITDA |
| DSCR < 1.25x | Ask management for cash flow improvement plan |
| Leverage > 3.5x | Full debt schedule with maturities and covenants |
| Leverage > 5.0x | Deleveraging plan |
| Estimated debt service | Confirm actual annual debt service |
| Revenue concentration > 15% | Customer concentration breakdown |
| Used equipment | Independent equipment appraisal |
| New equipment | Validate vendor quote competitiveness |
| Term/life > 70% | Maintenance program details |
| < 5 years in business | Personal financial statement + business plan |
| High-risk industry | Industry cycle position and pipeline |
| Not essential use | Confirm alternatives and recovery risk |
| FMV lease | Remarketing outlook assessment |
| TRAC lease | Validate residual assumption (NADA, Black Book) |
| LTV > 90%, no down payment | Ask about equity contribution |
| Score < 55 | Guarantee availability |
| Always | Insurance confirmation |
| Certain equipment types | Environmental/regulatory compliance |

---

## 12. What the Model Does NOT Do

- **Does not predict default.** The score reflects screening-level risk assessment, not a statistically validated probability of default.
- **Does not consider management quality,** contract backlog, customer relationships, or qualitative business factors beyond industry and years in operation.
- **Does not model interest rate changes** over the life of the deal (rates are fixed at screening).
- **Does not account for cross-collateralization,** guarantees, or other structural mitigants already in place.
- **Does not replace appraisals.** Equipment values are estimated, not appraised.
- **Does not consider tax implications** of different financing structures (e.g., Section 179, MACRS depreciation, true lease vs. finance lease classification).

---

## 13. Key Assumptions Summary

1. SOFR of 4.50% -- must be updated to reflect current market conditions
2. Base spread of 200 bps represents middle-market equipment finance
3. 8% blended rate for estimating unknown existing debt service
4. 15% haircut on used equipment values
5. Industry risk tiers are static -- do not adjust for current cycle position
6. Credit ratings are qualitative self-assessments, not formal agency ratings
7. Residual value percentages are conservative screening estimates
8. DSCR is the single most important factor (25% weight)
9. Stress testing only adjusts EBITDA, holding all else constant
10. The 0-100 scoring scale uses linear interpolation between expert-set breakpoints, not statistically calibrated curves
11. Historical comparable matching is proximity-based, not predictive
12. All rates shown are screening-level indicative rates, not commitments

---

*This document describes the model as built. All assumptions should be reviewed and validated against your institution's credit policy, current market conditions, and regulatory requirements before relying on any output for credit decisions.*

*Last updated: March 17, 2026*
