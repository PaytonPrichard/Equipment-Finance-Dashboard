# Real-deals harness

Runs public-company financials through Tranche's equipment finance scoring and compares the verdict to Joel's expectation, written in advance.

## Workflow

1. **Fetch.** `npm run real-deals:fetch` fills every XBRL-tagged figure from SEC EDGAR companyfacts, with tag, accession number and filing URL. Re-running is safe. Manual figures are never touched.
2. **Read the manual figures.** Each `manual` figure has a note that says what to read and why XBRL can't supply it. Fill in `value`, `cite` (page, statement or note) and `readBy`.
3. **Set the deal terms.** `assumptions` holds the hypothetical deal. A 10-K describes the borrower, not the equipment loan. Every value needs a `why`.
4. **Write the expectation.** Set `expected.verdict` (pass, flag or fail), a one-line `reason` and `writtenOn`, then commit. The commit history then shows the expectation came before the result.
5. **Run.** `npm run real-deals` writes `reports/<date>.md`. A case missing any figure, term or expectation shows as BLOCKED and is not scored.
6. **Discuss mismatches.** Decide whether the model or the expectation is wrong. Record the answer in the fixture's `discussion` field.

## Rules

- Every number traces to a source. If it can't be found, it stays null, and the case stays blocked.
- EBITDA = operating income + D&A unless the fixture cites a company-defined EBITDA.
- Debt service = cash interest paid + principal due in twelve months.
- Third-party PDFs (rating agency presales) go in `sources/`. That folder is gitignored and never committed.

## Known limits

- companyfacts omits dimensioned facts. Rental fleet depreciation, floorplan payables and individual note tranches usually need a manual read.
- For each FYE, the fetcher takes the value from the earliest 10-K that reports it. That's the number an analyst had at the time, before any restatement.
- SEC User-Agent and rate limit: see `lib/edgar.js`.
