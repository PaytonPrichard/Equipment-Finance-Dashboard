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
