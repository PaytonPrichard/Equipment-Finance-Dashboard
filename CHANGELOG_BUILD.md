# Build changelog

## 2026-10-07: Real-deals harness (Workstream B)

**What changed.** Added `scripts/real-deals/`, a harness that pulls borrower financials from SEC EDGAR XBRL, combines them with Joel's hypothetical deal terms, and runs them through the real equipment finance scoring code. It writes a dated report that compares Tranche's verdict with Joel's expectation, written beforehand. Fixtures are set up for DXP Enterprises, Titan Machinery, H&E Equipment Services and Hertz. XBRL figures are fetched. Manual figures, deal terms and expectations are still empty.

**Why.** To test the credit logic on real numbers, with every figure traceable to a filing.

**What Joel decided.**
- Equipment finance module only for now.
- Companies: DXP, Titan Machinery, H&E (FY2024, last 10-K before the Herc acquisition), Hertz.
- SEC User-Agent: `Tranche joelpeter617@gmail.com`.

**Open decisions for Joel.** Hertz unit of analysis (Corporate EBITDA with non-vehicle debt, or consolidated). Titan: count non-interest-bearing floorplan as debt or not. Maintenance capex: leave null (the stress test imputes 3% of revenue, flagged in the report) or use total capex as a conservative proxy.

**Backlog found while building (not fixed).**
1. EBITDA ≤ 0 makes leverage read 0.0x, which scores 100. The DSCR gate is also skipped when DSCR ≤ 0. A loss-making borrower gets full leverage points. (`calculateMetrics`, `evaluateScreening`.)
2. Stress FCCR leaves out the new loan when `actualAnnualDebtService` is supplied. `calculateMetrics` treats that field as existing debt service and adds the new loan. `runStressTest` treats it as total. Confirmed on the DXP smoke test: FCCR printed 2.38x, but 2.23x once the new loan is included. Belongs with Workstream A.
3. `runStressTest` silently imputes maintenance capex at 3% of revenue. This conflicts with the no-silent-imputation rule.
4. SOFR: the spec says 4.50%, but code `DEFAULT_SOFR` is 4.25%. One of them needs updating.
5. The stress table shows leverage crossing the 5.0x ceiling at -30% EBITDA but gives no stressed verdict. Consider showing pass/flag/fail per scenario.
