# Build changelog

## 2026-10-07: Real-deals harness (Workstream B)

**What changed.** Added `scripts/real-deals/`, a harness that pulls borrower financials from SEC EDGAR XBRL, combines them with Joel's hypothetical deal terms, and runs them through the real equipment finance scoring code. It writes a dated report that compares Tranche's verdict with Joel's expectation, written beforehand. Fixtures are set up for DXP Enterprises, Titan Machinery, H&E Equipment Services and Hertz. XBRL figures are fetched. Manual figures, deal terms and expectations are still empty.

**Why.** To test the credit logic on real numbers, with every figure traceable to a filing.

**What Joel decided.**
- Equipment finance module only for now.
- Companies: DXP, Titan Machinery, H&E (FY2024, last 10-K before the Herc acquisition), Hertz.
- SEC User-Agent: `Tranche joelpeter617@gmail.com`.
- Hertz: corporate view, GAAP-built EBITDA. Company-adjusted EBITDA must appear in the caveats (it does, with citation).
- Manual reads with citations for figures XBRL can't supply. No statement scraping yet.
- Maintenance capex: no flat 3%. Depreciation as a proxy, always labeled as an estimate.
- Credit rating mapping: IG = Strong, BB = Adequate, B or below = Weak, unrated = Not Rated.
- New rule: any estimated or uncertain input that could change an outcome must be visible to the analyst (report, screening view, memo). Added to CLAUDE.md.
- Bugs found while building go in AUDIT.md (P0-7, P1-13 to P1-16, P2-7 to P2-10), not here.

## 2026-10-07: Cash-flow stress test (Workstream A)

**What changed**
- New shared metrics for all three asset classes (`src/utils/cashFlowMetrics.ts`): cash-flow DSCR and FCCR, computed from new optional inputs (cash taxes, increase in working capital, rent and lease payments, floating share of existing debt).
- New cash-flow stress table: revenue -10/-20/-30%, margin -200 bps, rates +200 bps, customers paying 20 days slower, and a combined severe case (revenue -20% and margin -200 bps).
- Verdict: cash-flow DSCR below 1.15x or FCCR below 1.10x flags; below 1.0x fails; either below 1.0x in the combined severe case flags. Missing inputs add a note and never move the verdict.
- Screening view: two new metric cards, the cash-flow stress panel, and notes in the verdict box. Committee memo: both metrics in Key Metrics, a Cash-Flow Stress section, and the notes.
- Floors and every scenario setting are editable in Screening Policy.
- Spec updated: `Deal_Screening_Model_Assumptions.md` sections 5, 7, 13, 14.

**Fixed along the way**
- FCCR used to fill a blank maintenance capex with 3% of revenue. Removed. Blank now reads "not provided".
- FCCR and liquidity months dropped the new facility's debt service whenever actual debt service was entered, overstating both. Granite Ridge's FCCR read 2.40x. The same old formula with the new loan's $955K included gives about 1.70x.

**What Joel decided**
- FCCR uses the EBITDAR form: rent added back and counted once as a fixed charge.
- Any missing input means "not provided", named. No imputation, including the old capex default.
- No separate scheduled-principal input: debt service already includes principal.
- Rate shock hits the floating revolver plus an optional floating share of existing debt; blank share is disclosed, not assumed.
- Revenue declines hold margin; separate margin and combined scenarios. All scenario settings flexible with these defaults.
- Slower collections default 20 days (worst case), not 10.
- Floors 1.15x cash-flow DSCR and 1.10x FCCR, configurable, and visible to the user on the cards, the panel and the policy screen.
- Composite score unchanged. The new metrics act through the verdict only.

**Known and not done here:** moved to `AUDIT.md` (P0-8, P1-17, P2-10). Numbered after the real-deals branch's items so both merge cleanly. Also fixes real-deals' P1-13 (stress FCCR drops the new loan).

## 2026-10-07: Recommendation follows the verdict (AUDIT P0-8)

**What changed**
- One shared recommendation (`src/lib/recommendation.ts`), led by the verdict, then the score. Used by the Screening Result box, the executive summary, the score badges, the memo banner, batch screening and deal comparison.
- PASS keeps the score category ("Strong Prospect, recommend advancing"). FLAG reads "Advance with Conditions" and lists every condition, numbered, word for word from the verdict. FAIL reads "Does Not Meet Policy" and lists the failed criteria.
- The memo's reasons box now has headings: "Fails policy" and "Conditions to advance".

**Why:** a deal scoring 80 that broke a gate showed FLAG and, directly below, "Strong Prospect. Recommend advancing to underwriting."

**What Joel decided:** verdict first. FLAG may say "Advance with Conditions" only if the conditions are listed so nobody has to guess what they are.

**Not done here:** saying what would clear each condition (e.g. how much EBITDA or how much less loan) is real-deals' AUDIT P1-16, after this branch merges.

## 2026-10-09: Real-deals ratings, analyst view, P0-7 (Workstream B)

**What changed.** Credit ratings recorded for all four cases. Analyst sheet and report gained liquidity runway, a five-year maturity wall, "what would change this" and headroom (AUDIT P1-16 prototype). A `hindsight` field records events after the screen date, printed after the result and never scored. Merged main (Workstream A's cash-flow work) into `real-deals`.

**What Joel decided.**
- Point in time: ratings and every input as of the 10-K filing date. Later rating actions go in hindsight.
- Ratings: DXP Weak (S&P B, Moody's B1, from its 10-K). Titan Not Rated (no S&P rating found, Moody's not checked). Hertz Weak (B- before the Aug 2026 cut to CCC+). H&E Weak, his conservative assumption because no free source exists.
- Moody's skipped.
- Negative EBITDA: leverage is shown as NM and the verdict FAILs with one reason naming EBITDA. In the score, NM leverage counts as worst case (the curve floor, weight kept). Joel first approved dropping the factor, then switched to the floor after a credit review showed dropping it let a loss-maker outscore a marginally profitable borrower.
- FAIL means outside the firm's policy on something structure can't fix at these numbers, and every FAIL says what would have to change. Tranche never decides. It applies the firm's policy. Hard blocks only for non-credit rules (sanctions, legal limits), firm-configured.
- Expected verdicts: DXP pass (would also accept flag), H&E flag (maturity wall, change of control), Titan fail, Hertz fail with a path (not blind).
- First run: DXP and Titan match. H&E mismatches (Tranche PASS) because Tranche can't see debt maturing inside the loan term or a pending change of control (AUDIT P1-21, P1-22).
- Verdicts are a recommended next action, not a probability.
- Cash-flow inputs (cash taxes, rent, working capital) added to all four cases from the filings. DXP now FLAGs (acceptable). H&E now FLAGs (match), but through capex held flat under stress, not through Joel's reasons.
- Joel's call: in cash-flow stress, maintenance capex scales with revenue instead of staying flat. Handed to Workstream A, which owns `src/utils/cashFlowMetrics.ts`. After it lands, H&E may go back to PASS until P1-21 and P1-22 exist.
- Push: today's harness work ships with Workstream A's next change, not on its own.
- Five more cases (URI, CTOS, ALTG, RUSHA, WNC), researched by parallel agents with cited R-page figures, tags checked by the fetcher, key figures spot-checked.
- Joel's calls: Wabash EBITDA excludes a $418.6M non-cash litigation reversal (same logic as releases counting 0). Custom Truck years in business = 4, from the 2021 merger. Rush floorplan included in debt, because its interest is not disclosed. Ratings as of filing date, later actions in hindsight.
- Debt service rule (Joel): scheduled principal only. Renewing facilities (revolvers, AR securitizations) go to the maturity wall as refinancing risk.
- Custom Truck mismatch: Joel agrees the model is right. EBITDA coverage hides fleet reinvestment for rental businesses.


## 2026-10-09: EBITDA build Phase 1, step 1 (Workstream A)

**What changed**
- New shared pre-scoring layer `src/lib/borrowerBuild.ts`: `buildBorrowerInputs(financials, rules)` builds revenue, EBITDA, total debt, debt service, maintenance capex, cash taxes, working capital increase and rent from statement line items. Returns inputs, the formula and cited lines behind each, judgments, caveats and errors. No UI, no scoring change, not yet in the server bundle.
- Firm treatment rules (`DEFAULT_TREATMENT_RULES`) with per-deal overrides that need a reason. Each override flips EBITDA, debt and debt service together.
- Three EBITDA sources (built, adjusted, stated), labeled, with the built-versus-company gap split into add-backs, treatment and unexplained, against the 5% firm tolerance.
- 53 hand-checked tests (`src/lib/borrowerBuild.test.ts`). Regression against the real-deals `derive()` snapshots waits for `real-deals` to merge.
- Reviewed by the credit-reviewer agent. Fixed: missing interest lines in debt service are errors; unreviewed bridge deductions stay in EBITDA; debt labels say "total" and "including current portion"; pretax-start wording.

**What Joel decided**
- No operating income line: built EBITDA starts from pretax income + interest expense, as a judgment.
- Maintenance capex proxy = D&A less amortization of intangibles (optional line; Tranche does the subtraction), less fleet depreciation and finance lease amortization under every treatment, since those assets are debt-funded. Missing lines mean full D&A with an "overstates capex" caveat.
- Working capital release and net tax refund both count as 0, with a note.
- Optional current finance lease liabilities line, added to debt service under finance leases in; caveat if missing.
- Adjusted or stated EBITDA: the analyst says per treatment row whether the company figure is before or after the item, and Tranche moves it onto the deal's treatment basis.
- Current maturities: a judgment per item (finance leases, vehicle debt, floorplan) on whether the line already includes it, proposed "no".
- Gap comparison counts treatment differences as explained, not unexplained.

## 2026-10-09: EBITDA build Phase 1, step 2: firm treatment rules (Workstream A)

**What changed**
- Settings, Screening Policy: a Treatment Rules card. Four rows (finance leases, operating leases, floorplan, captive fleet) with what each choice does to EBITDA, debt and debt service, plus the EBITDA gap tolerance. Admins edit. Everyone else sees it read-only.
- Saved to `organizations.org_settings.treatmentRules`. The save re-reads the stored settings and changes only that key, so it never writes over other unsaved edits or another admin's save. Every change writes an `audit_log` row (entity `org`, old and new rules).
- `validateTreatmentRules` merges stored rules over the defaults and drops anything invalid. It runs on save and on every read, so a malformed value cannot reach scoring.
- `setTreatmentOverride` for per-deal overrides: needs a reason, records who and when, and choosing the firm rule clears the override. The form uses it in step 3.
- Tests: card read-only vs admin, save and notice, validator, override helper.

**What Joel decided**
- Analysts see firm rules read-only in Settings, and meet them on the New Deal screen in step 3.
- Saved deals keep the rules they were built with. After a save, Settings says so. A "rescore every deal with current rules" action comes with the server rerun in step 4, for occasional use.
- Per-deal overrides are audited when the deal is saved.

## 2026-10-09: Maintenance capex scales with revenue in cash-flow stress (Workstream A)

**What changed**
- In the revenue-decline and combined severe scenarios, maintenance capex now falls by the same percentage as revenue. Margin, rate and slower-collections scenarios keep revenue, so capex is unchanged. Cash taxes and rent are still held. `src/utils/cashFlowMetrics.ts`, assumption line, and `Deal_Screening_Model_Assumptions.md` section 7 updated.
- Real-deals run: H&E moves FLAG to PASS (combined severe cash-flow DSCR 0.43x to 1.46x). It flagged only because capex was held at $423M while revenue fell. DXP still FLAGs (0.91x to 0.94x). Hertz and Titan do not move. H&E is now a mismatch against Joel's FLAG expectation.
- EBITDA build regression extended to cash taxes, rent and working capital on all four fixtures. Matches derive() except where the build floors a working-capital release (Hertz, Titan) or a net tax refund (Titan) at 0, by Joel's rule.

**What Joel decided** (relayed through Workstream B): capex scales with revenue in every revenue scenario, all sectors.

**Open:** the module stress tables (EBITDA -10/-20/-30% per module) still hold capex in their FCCR column. Whether those declines are revenue or margin declines decides if capex should scale there too.

## 2026-10-09: Public equipment ABS benchmarks and industry tiers (Workstream B)

**What changed.** Pulled pool and loss data from the three equipment ABS programs with public prospectuses (John Deere Owner Trust 2026-B, CNH Equipment Trust 2026-B, Daimler Trucks Retail Trust 2024-1 plus 10-D reports). Results in `scripts/real-deals/benchmarks/abs-2026-10.md`. New Trucking sector (high risk), split out of Transportation/Logistics. Agriculture moved from high to moderate. Applied in all three modules, server validation, extraction, form tip and spec doc, with tests.

**What Joel decided.**
- Recorded his loss ranking before the data: trucks, construction, agriculture (worst first). Data supports trucks worst (4-6x the losses of ag/construction pools at the same vintage). Construction vs agriculture is not separable from public data.
- Tiers: option 2 (Trucking split out at high) plus option 3 (Agriculture to moderate).
- Rush reclassified to Trucking under the end-market rule. Rerun: no verdict changes (Rush 85 to 81, still PASS; Titan 44 to 49, still FAIL).
