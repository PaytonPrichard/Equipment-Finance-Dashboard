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
- Bugs found while building go in AUDIT.md (P0-7, P1-13 to P1-15, P2-7 to P2-9), not here.
