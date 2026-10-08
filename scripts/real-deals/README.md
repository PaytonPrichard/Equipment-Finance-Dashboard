# Real-deals harness

Runs public-company financials through Tranche's equipment finance scoring and compares the verdict to Joel's expectation, written in advance.

## Workflow

1. **Fetch.** `npm run real-deals:fetch` fills every XBRL-tagged figure from SEC EDGAR companyfacts, with tag, accession number and filing URL. Re-running is safe. Manual figures are never touched.
2. **Read the manual figures.** Each `manual` figure has a note that says what to read and why XBRL can't supply it. Fill in `value`, `cite` (page, statement or note) and `readBy`.
3. **Set the deal terms.** `assumptions` holds the hypothetical deal. A 10-K describes the borrower, not the equipment loan. Every value needs a `why`.
4. **Read the analyst sheet.** `npm run real-deals:sheet` writes `sheets/<date>.md`: sourced figures and plain ratios, with no Tranche score on it.
5. **Write the expectation.** Set `expected.verdict` (pass, flag or fail), a one-line `reason` and `writtenOn`, then commit. The commit history then shows the expectation came before the result.
6. **Run.** `npm run real-deals` writes `reports/<date>.md`. A case missing any figure, term or expectation shows as BLOCKED and is not scored.
7. **Discuss mismatches.** Decide whether the model or the expectation is wrong. Record the answer in the fixture's `discussion` field.

## Rules

- Every number traces to a source. If it can't be found, it stays null, and the case stays blocked.
- Estimates and judgment calls go in `caveats`, or in a build's `estimate` text, which adds a caveat automatically. Caveats print at the top of the report. Anything uncertain that could change a verdict has to be visible there.
- Third-party PDFs (rating agency presales) go in `sources/`. That folder is gitignored and never committed.
- **Point in time.** Every input, ratings included, is as of the 10-K filing date. Anything that happened later goes in the fixture `hindsight` list. The report prints it after the result, and scoring never uses it. If you read hindsight before writing an expectation, say so in `hindsight`.

## Treatment rules (same for every company)

Companies put the same items in different places. The rules don't move. Each fixture's `builds` maps its own figures onto them.

- **EBITDA** = operating income + D&A by default. D&A comes from the cash-flow statement and includes fleet depreciation and finance-lease amortization.
- **Pairing.** EBITDA and debt must agree on every item. Finance-lease amortization is in D&A, so finance-lease liabilities are in debt. Operating leases are out of both, because rent stays in EBITDA as an expense.
- **Floorplan** (dealers) is inventory financing. Floorplan interest is deducted in EBITDA, and the floorplan payable is left out of debt and debt service. This follows auto-dealer convention. Check it against the company's own credit agreement where possible.
- **Captive fleet debt** (car rental) is analyzed at the corporate level. EBITDA is after vehicle depreciation and vehicle interest, and debt is non-vehicle only.
- **Debt service** = cash interest paid + principal due in twelve months, on the same debt that's counted in leverage.
- **Maintenance capex** = depreciation, as a proxy, always flagged as an estimate. It excludes anything already deducted in EBITDA.
- **Years in business** = fiscal-year-end year minus founding year, quoted from Item 1.

## Known limits

- companyfacts omits dimensioned facts. Rental fleet depreciation, floorplan payables and individual note tranches usually need a manual read.
- For each FYE, the fetcher takes the value from the earliest 10-K that reports it. That's the number an analyst had at the time, before any restatement.
- SEC User-Agent and rate limit: see `lib/edgar.js`.
