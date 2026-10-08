# Build changelog

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
