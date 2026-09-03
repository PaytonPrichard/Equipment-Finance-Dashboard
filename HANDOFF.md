# Tranche — where things stand

Last updated 2026-09-03. Production is `main` @ `538188c`, pushed and deployed
to gettranche.app.

258 client tests, 40 server tests, build clean.

## What shipped

- **Multi-document ingest.** Up to four documents per deal, each classified and
  read in parallel, then merged deterministically with per-field-group
  precedence. The model extracts, JavaScript merges. No second model call.
  Conflicts are surfaced with both sources named and a one-click switch.
- **Extraction across all three asset classes.** Equipment, AR, inventory.
  61/61 on the sample corpus with zero invented values.
- **Provenance.** Field-level source tracking, a "where these numbers came
  from" view, and a source-documents section in the memo.
- **Pipeline detail drawer.** Title, full notes, documents, metrics, activity.
- **Committee memo.** Transaction summary, sources and uses, borrower
  description, source documents. Prints at true size on US letter.
- **Landing page.** Putty ground with an inset white sheet, nav scrollspy,
  features grid with hierarchy, hover-driven three-step explainer.
- **Billing removed entirely.** Stripe deleted, three serverless slots freed.
- **Sample document corpus** with a generator and an accuracy scorecard.

## Bugs found along the way

Each is a domain catch rather than a coding catch, which is what makes them
worth writing about.

1. **Credit rating defaulted from silence.** A missing rating became "Not
   Rated", worth +100bps of spread. The same deal priced 100bps wider uploaded
   than typed, with nothing on screen saying the value was manufactured.
2. **The LTV check was dead by default.** A `maxLtv < 100` guard disabled the
   check at its own default of 100, so a deal at 150% LTV screened PASS with no
   LTV reason given.
3. **Org spread overrides broke DSCR.** Debt service was computed interest-only
   against modules that amortize, inflating DSCR 22% for any firm that
   customised its spreads.
4. **The memo printed at 92% on the wrong paper.** Laid out at 780px and
   printed into 718px of A4, while the stylesheet claimed letter.

## Open — product

1. **The memo repeats itself.** Recommended Action restates the score banner
   verbatim on page one. Editorial cut, small.
2. **No memo is ever stored.** No memos table, no PDF artifact, no pinned rate.
   Reopening a deal recomputes against the *current* SOFR and criteria, so after
   a rate move you regenerate a different memo than the one taken to committee.
   Top deferred item. This is a real feature, not cleanup.
3. **TeamManagement.js was never converted to the light theme.** 53 `slate-*`
   classes across 879 lines, and it is where the upgrade CTA lands.
4. **App.js is 1,708 lines.** Route split (LandingRoute, NewDealRoute,
   PipelineRoute, DashboardRoute) plus a `useDealScoring` hook is still the plan.
5. **Duplicate team and invite UI** in SettingsPanel and TeamManagement.
6. **TypeScript migration is partway.** `strict: false`, `allowJs: true`.

## Open — go to market

1. **One-pager** (`marketing/one-pager.html`). Two real problems: three
   typefaces switching line to line (IBM Plex Serif, Sans and Mono, with Mono
   doing eyebrows *and* table cells *and* numerals *and* step numbers), and a
   780px measure that reads as a ribbon on a desktop. Fix is two faces with one
   job each, Mono only for numerals in tables, and a wider two-column layout
   above 1100px. **The live artifact URL still serves the pre-IBM-Plex version;
   it was never republished.**
2. **Build-story piece.** The four bugs above are the material.
3. **Proof of use.** Publish three memos, one per asset class. LinkedIn carousel.
4. **Demo video.** Two minutes. Structure is written, nothing recorded. Cold
   open on the finished memo; the conflict block is the whole demo.
5. **Adversarial end-to-end pass**, plus the `credit-reviewer` agent over the
   accumulated scoring diff.

## Constraints to carry forward

- No em dashes in user-facing copy.
- Scoring modules return semantic categories, never Tailwind class strings.
- Never write `pipeline_deals` without the matching `audit_log` entry.
- Source of truth for thresholds is `DEFAULT_CRITERIA` per module.
  `Deal_Screening_Model_Assumptions.md` is the methodology spec.
- `CI=true npm run build` before every push. Vercel treats ESLint warnings as
  fatal.
- `npm start` does not serve `/api/`. Use `vercel dev`.
- The only LLM in the product is `server-lib/extract.js`. The memo contains no
  model-generated prose. Keep it that way.
