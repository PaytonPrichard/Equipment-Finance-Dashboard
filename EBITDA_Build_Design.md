# EBITDA, Debt and Debt Service Build (Design)

Status: approved for build. All section 16 decisions settled 2026-10-08. Owner: Joel. Last updated: 2026-10-08.

Today an analyst types EBITDA, total debt and debt service as three single numbers. This design has Tranche build them from the line items on the borrower's financial statements. The analyst uploads the statement pages, Tranche does the arithmetic, proposes the judgment calls, and the analyst confirms them and submits.

Inputs to this design: the real-deals prototype on branch `real-deals` (`scripts/real-deals/lib/derive.js`, `lib/analystView.js`, the treatment rules in `scripts/real-deals/README.md`), AUDIT P0-7, P1-14, P1-16 and P2-9 on that branch, and the cash-flow inputs added on `cashflow-stress`.

## 1. Why

The real-deals harness ran public filings through Tranche and found three problems a typed-in EBITDA hides.

- **Definitions vary by company.** Floorplan interest sits above operating income at one dealer and below it at another. Rental companies put fleet depreciation in its own line. Car rental companies carry vehicle debt that funds the fleet. The same "EBITDA" means different things.
- **EBITDA and debt must pair.** If finance-lease amortization is added back in EBITDA, finance-lease liabilities belong in debt. An analyst can enter an EBITDA that doesn't match the debt they entered, and nothing catches it.
- **Extraction picks Adjusted EBITDA.** `server-lib/extract.js` tells the model to "use the stated adjusted EBITDA" when only net income plus add-backs is shown. Add-backs are the borrower's own story. Nothing on the screen says which number was used.

## 2. Requirements (approved by Joel, 2026-10-07)

1. **Three EBITDA sources, always labeled.** Built from line items. Stated Adjusted EBITDA, with its add-back bridge listed line by line. Or stated only. Built and stated are compared, and any unexplained gap is a caveat.
2. **Missing required inputs show an error. Missing optional inputs show a visible caveat** in the screening view, the verdict and the memo. (CLAUDE.md rule, added on `real-deals`.)
3. **Treatment rules are firm-level defaults with a per-deal override.** Floorplan, finance leases, captive fleet debt.
4. **Arithmetic is automatic. Judgment calls are proposed by Tranche and confirmed by the analyst.**
5. **Extraction takes financial statement pages only**, never whole filings. `MAX_OUTPUT_TOKENS` (2048 today) goes up to fit the extra fields.
6. **New inputs: a five-year debt maturity schedule and undrawn availability.** The verdict will need them (real-deals AUDIT P1-16).

## 3. Scope

In scope:
- A shared borrower-financials layer that builds `ebitda`, `totalExistingDebt`, `actualAnnualDebtService`, `maintenanceCapex`, `cashTaxes`, `workingCapitalIncrease` and `leasePayments` from line items, for all three asset classes.
- Firm treatment rules, per-deal overrides, and the judgment-call confirmation step.
- Extraction of statement line items, with source page citations.
- The maturity schedule and undrawn availability inputs.
- A "How the numbers were built" section in the screening view and the memo.

Not in scope:
- Whole filings, XBRL fetch in the app, or any web lookup. The harness does that; the app takes documents the analyst uploads.
- Projections or forecasts. One fiscal year in, plus the prior year for trend.
- Judging the quality of add-backs. Tranche lists them and the analyst accepts or rejects each one. It does not opine.
- The "what would change this" panel itself (P1-16). This design only adds the inputs it needs. It ships after.

## 4. Where it sits

```
documents ──extract──▶ line items ──build──▶ scoring inputs ──▶ module scoring ──▶ verdict, memo
              (cited)     (confirmed)   (formula shown)        (unchanged)
                               ▲
                 firm treatment rules + per-deal overrides
```

The build is a **pre-scoring layer**. It writes the same flat fields the modules already read (`ebitda`, `totalExistingDebt` and so on). The module contract does not change, and no module learns about line items. This keeps the CLAUDE.md rule: no asset-class behavior in shared code, and no line-item logic in modules.

One shared function, used by the client, the server and the real-deals harness:

```
buildBorrowerInputs(financials, treatment) ->
  { inputs, derivations, judgments, caveats, errors }
```

- `inputs`: the scalar fields above.
- `derivations`: for each field, the formula and the line items behind it, with citations. The screening view and memo print these.
- `judgments`: proposed calls awaiting confirmation (section 9).
- `caveats`: optional inputs missing, estimates used, unexplained gaps.
- `errors`: required inputs missing. Scoring does not run while any exist.

`derive.js` on `real-deals` is the prototype. The app version replaces it, and the harness imports the app version, so the harness tests the code that ships.

**Server authority.** When a deal carries `financials`, `api/score-deal.js` reruns `buildBorrowerInputs` and ignores client-sent values for the built fields. Same rule as the score today (AUDIT P0-1). The build goes into the `_scoring.cjs` bundle.

## 5. Data model

No table changes for the deal. Everything lives inside the existing `pipeline_deals.inputs` JSON.

```
inputs.financials = {
  fiscalYearEnd: '2025-12-31',
  lineItems: {
    operatingIncome:  { value, source: { document, page }, origin: 'extracted' | 'typed' },
    depreciationAmortization: { ... },
    ...
  },
  ebitdaSource: 'built' | 'adjusted' | 'stated',
  statedEbitda:   { value, label, source },          // as the company names it
  adjustedEbitda: { value, source, addBacks: [
    { label, amount, source, decision: 'accepted' | 'rejected' | null }
  ]},
  treatmentOverrides: { floorplan: { rule, reason, by, at }, ... },
  judgments: { <id>: { proposed, confirmed, by, at } },
  maturities: { y1, y2, y3, y4, y5 },               // principal due per year
}
```

Firm defaults go in the existing `organizations.org_settings` JSON, under `treatmentRules`. Admins edit them in Settings. A per-deal override needs a reason and writes an `audit_log` entry, like every other deal write.

Saved deals without `financials` keep working exactly as now: typed scalars, no build. Nothing migrates.

## 6. Line items

Required lines are the minimum to build EBITDA, debt and debt service. Without them the analyst gets an error, or must switch EBITDA to "stated only" (which adds a caveat, section 7).

| Line item | Statement | Required | Feeds |
|---|---|---|---|
| Revenue | Income statement | Yes | revenue, margin |
| Operating income | Income statement | Yes (built EBITDA) | EBITDA |
| Depreciation and amortization | Cash flow statement | Yes (built EBITDA) | EBITDA |
| Floorplan interest | Income statement or note | If floorplan exists | EBITDA (treatment) |
| Vehicle depreciation, vehicle interest | Income statement | If captive fleet | EBITDA (treatment) |
| Rent / operating lease cost | Lease note | Optional | FCCR |
| Cash interest paid | Cash flow supplemental | Yes | Debt service |
| Income taxes paid | Cash flow supplemental | Optional | Cash-flow DSCR, FCCR |
| Capital expenditures | Cash flow statement | Optional | Maintenance capex (judgment) |
| Change in working capital lines | Cash flow statement | Optional | Working capital |
| Cash and equivalents | Balance sheet | Optional | Liquidity |
| Revolver, term loans, notes | Balance sheet / debt note | Yes | Debt |
| Current maturities of long-term debt | Balance sheet | Yes | Debt service |
| Finance lease liabilities | Balance sheet / lease note | If any | Debt (treatment) |
| Floorplan payable | Balance sheet | If any | Debt (treatment) |
| Vehicle / fleet debt | Balance sheet / debt note | If any | Debt (treatment) |
| Maturities, years 1 to 5 | Debt note | Optional | Maturity wall (P1-16) |
| Undrawn availability | Liquidity section / debt note | Optional | Liquidity runway (P1-16) |

"If any" lines are required only once Tranche or the analyst says the item exists. For example, if the balance sheet shows a floorplan payable, floorplan interest becomes required.

## 7. EBITDA: three sources

| Source | Value | Label everywhere it appears |
|---|---|---|
| **Built** | Operating income + D&A, then the treatment adjustments (section 8) | "EBITDA, built from statements" |
| **Adjusted** | Company's reported EBITDA + the add-backs the analyst accepted | "Adjusted EBITDA, company-stated, N of M add-backs accepted" |
| **Stated only** | One number from a document, no build possible | "EBITDA, stated, not built" plus a caveat |

**Which one scores.** The analyst picks, and the pick is a judgment call (section 9). Tranche proposes Built whenever the required lines exist.

**The comparison.** When both Built and a stated figure exist, Tranche shows them side by side:

```
Built EBITDA                    $41.2M
Company Adjusted EBITDA         $47.9M
  Gap                           $6.7M
  Explained by listed add-backs $5.9M   (stock comp 3.1, restructuring 1.8, other 1.0)
  Unexplained                   $0.8M   ◀ caveat if over the firm's tolerance
```

The unexplained gap becomes a caveat when it is over the firm tolerance (default 5%, section 16). The tolerance is printed beside the gap so the analyst sees the rule being applied.

**Add-backs.** Each line of the bridge is listed with its amount and page. The analyst marks each one accepted or rejected. Undecided add-backs are excluded and counted in a caveat ("2 add-backs not reviewed"). This is the one place Tranche shows a number the borrower chose, so every piece of it is visible.

**Extraction change.** The `ebitda` field description stops asking for Adjusted EBITDA. Extraction returns operating income and D&A as line items, and a stated EBITDA with the company's own label, separately.

## 8. Treatment rules and pairing

The rules from `scripts/real-deals/README.md` become the firm defaults. The principle is that **EBITDA and debt must agree on every item**: whatever is excluded from one is excluded from the other.

| Item | Default | EBITDA | Debt | Debt service |
|---|---|---|---|---|
| Finance leases | In | D&A includes lease amortization | Lease liabilities included | Lease principal in current maturities |
| Operating leases | Out | Rent stays an expense | Excluded | Excluded (in FCCR as rent) |
| Floorplan (dealers) | Out | Floorplan interest deducted | Floorplan payable excluded | Floorplan interest and principal excluded |
| Captive fleet debt (car rental) | Corporate level | After vehicle depreciation and vehicle interest | Non-vehicle debt only | Non-vehicle interest and maturities only |

Each rule has its alternative. For example, floorplan "In" treats the floorplan as debt: its interest is added back and its payable counts. A per-deal override switches the whole row at once, so the pairing cannot break.

### Exact formulas at default treatments (confirmed by Joel, 2026-10-09)

**EBITDA (built)** = operating income + D&A, then:
- Floorplan out: subtract floorplan interest, only if it is reported below operating income. If it sits inside operating expenses it is already deducted.
- Captive fleet at corporate level: subtract vehicle depreciation (it sits inside D&A). Subtract vehicle interest if it is reported below operating income.
- Finance leases in: no adjustment. Lease amortization stays in D&A.

**Debt** = revolver + term loans and notes (including current portion) + finance-lease liabilities. Floorplan payable and vehicle debt are excluded.

**Debt service** = cash interest paid on the debt above + principal due within 12 months on the debt above. Floorplan and vehicle interest are subtracted from interest paid when the company reports them inside it. Revolver balances are not principal due.

Where each item sits (above or below operating income, inside or outside interest paid) is a judgment call: Tranche proposes it from the statement, the analyst confirms. An override flips the whole row (EBITDA, debt, debt service) together. The `credit-reviewer` agent reviews these once coded.

**Debt service** = cash interest paid + current maturities, on the same debt that counts in leverage. Revolver balances are not amortizing principal, so they count for interest, not in current maturities, unless the analyst marks a revolver maturing within twelve months (a judgment call).

## 9. Arithmetic versus judgment

**Automatic, never asked:** sums, sign handling, applying a treatment rule once chosen, pairing EBITDA and debt, current-year versus prior-year columns once the year is chosen.

**Judgment calls, proposed by Tranche, confirmed by the analyst:**

| Judgment | Tranche proposes | Why it needs a person |
|---|---|---|
| Fiscal year and column | Most recent full year | Restated or partial-year columns |
| Which EBITDA scores | Built, if the lines exist | Firms differ on Adjusted |
| Each add-back | Undecided | Credit judgment on quality |
| Floorplan / fleet / finance lease present | From balance sheet lines | Labels vary by company |
| Treatment override for this deal | Firm default | Credit agreement may differ |
| Maintenance capex | See below | No statement reports it |
| Revolver maturing in 12 months | No | Needs the debt note |
| Non-recurring items in operating income | None | Company labels are not reliable |

**Maintenance capex.** Companies don't report it. Tranche proposes one of three, labeled as an estimate wherever it shows:
1. A figure the borrower states, if any document gives one.
2. Depreciation as a proxy. This is the real-deals rule, and it is common in practice.
3. Total capex as an upper bound.

It never fills in a percentage of revenue. That 3% default is already removed on `cashflow-stress`.

**Flow.** The deal scores live while judgments are pending, so the analyst sees the effect of each one. Pending judgments show as caveats ("Proposed, not confirmed: depreciation used as maintenance capex"). **Saving to the pipeline requires every judgment to be confirmed.** That is the "submit" step.

## 10. Missing inputs

- **Required missing:** an error on the form, naming the line and what it feeds ("Cash interest paid is missing. Needed for debt service."). Scoring does not run. Matches `derive.js` blockers.
- **Optional missing:** a caveat in three places. On the screening view, next to the metric. In the verdict, as a note that does not change the outcome. In the memo, in the notes under the verdict and in the build section. The cash-flow work on `cashflow-stress` already does this for taxes, capex, working capital and rent. This design extends it to every optional line.
- **Estimates and pending judgments:** caveats in the same three places, labeled "estimate" or "proposed, not confirmed".

## 11. Extraction

- **Statement pages only.** The upload step asks for financial statement pages. A document over a page limit (Q6) is rejected with a message asking for the statement pages. This keeps cost bounded and stops a 200-page 10-K from going to the model.
- **New fields:** the section 6 line items, each with the page it came from. The add-back bridge comes back as a list of label, amount, page.
- **Copy, never compute.** Extraction returns stated figures only. It does no arithmetic. This also fixes AUDIT P1-18 (the down payment the model computed wrong). Every sum happens in `buildBorrowerInputs`, where it is shown and tested.
- **`MAX_OUTPUT_TOKENS`:** 2048 to 4096. **Cost:** output tokens per statement document roughly double. Input tokens fall if whole filings stop being uploaded. I'll measure both on the sample corpus (`scripts/score-extraction.js`) before shipping, and add the result here.
- **Merge:** line items use the existing precedence table in `src/lib/extractionMerge.ts`, with financial statements first. A disagreement between documents is shown, as now.

## 12. Screen and memo

**New Deal form.** Borrower Profile gets a "Build from statements" mode beside today's typed mode.
1. **Line items:** a table of value, document, page and origin (extracted or typed). Missing required lines are marked in red.
2. **Treatment:** the four rows from section 8, showing the firm default. Override needs a reason.
3. **EBITDA source:** Built / Adjusted / Stated, the comparison, and the add-back list with accept and reject.
4. **Judgments:** pending calls with Tranche's proposal and a confirm button each.
5. **Result:** each built input with its formula, e.g. "EBITDA $41.2M = operating income $28.4M (p. 54) + D&A $12.8M (p. 58)".

**Memo.** A new "How the numbers were built" section: the source of EBITDA and its label, the formulas with page citations, the treatment rules applied (and any override with its reason), accepted and rejected add-backs, and every caveat. This extends section 12 of the methodology doc ("the memo names its sources").

## 13. Maturity schedule and undrawn availability

- **Maturities, years 1 to 5:** principal due each year, from the debt note. Stored as five numbers. Feeds the maturity wall in P1-16, and later a refinancing-risk gate.
- **Undrawn availability:** committed, undrawn capacity under existing facilities. Today `availableLiquidity` mixes this with "other immediately accessible liquidity". See Q5.

Neither changes the verdict in this design. P1-16 decides how they are used.

## 14. Testing

- **Unit:** `buildBorrowerInputs` against hand-checked numbers for each treatment rule and each EBITDA source, including negative EBITDA (real-deals P0-7).
- **Regression on real filings:** every fixture in `scripts/real-deals/fixtures/` must produce the same inputs through `buildBorrowerInputs` as through today's `derive.js`, and any difference is explained in the fixture. The harness becomes the app's acceptance test.
- **Extraction:** extend `test-deal-sheets/EXPECTED.json` with line items for the three sample borrowers, graded by `scripts/score-extraction.js`.

## 15. Rollout

1. **Build layer and typed line items.** `buildBorrowerInputs`, treatment rules in org settings, the form's build mode with typed lines, judgments, and the memo section. No extraction changes. Usable on its own.
2. **Extraction of line items.** New fields, statement-pages-only upload, the token limit, the cost measurement.
3. **P1-16 panel.** "What would change this", headroom, liquidity runway and the maturity wall, using the new inputs.

Each phase merges and deploys on its own.

## 16. Decisions for Joel (recommended default in bold)

1. **Which EBITDA scores when both exist?** Decided 2026-10-08: built by default. The analyst can switch to Adjusted, and the label and comparison follow it into the memo.
2. **Unexplained-gap tolerance between built and stated EBITDA.** Decided 2026-10-08: 5% of built EBITDA, firm-configurable. Below that, the gap is shown but not a caveat. The tolerance is printed next to the gap wherever it appears (screening view, memo), e.g. "Unexplained $0.8M, 1.9% of built. Caveat above 5%, your policy." The user never has to look it up.
3. **Save without all judgments confirmed?** Decided 2026-10-08: no. Scoring runs live with caveats, but Save to Pipeline needs every judgment confirmed first.
4. **Maintenance capex proposal.** Decided 2026-10-08: borrower-stated if any, else depreciation as proxy, labeled an estimate. Total capex as upper bound is offered, not proposed.
5. **Undrawn availability.** Decided 2026-10-08: split today's `availableLiquidity` into "undrawn committed availability" and "other liquidity". The verdict leans only on committed capacity. Saved deals keep their old value as "other liquidity" until re-entered; it is not assumed to be committed.
6. **Page limit for statement uploads.** Decided 2026-10-08: 15 pages per document.
7. **Who can change firm treatment rules?** Decided 2026-10-08: admins only. Per-deal overrides by any analyst, with a reason and an audit entry.
8. **Typed mode stays?** Decided 2026-10-08: yes. Typed EBITDA is labeled "stated, not built", with a caveat.
