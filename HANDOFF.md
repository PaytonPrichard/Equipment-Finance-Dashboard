# Tranche — where things stand

Last updated 2026-09-23. Production is `main`, deployed to gettranche.app, but
the working tree is **ahead of production** and not yet deployed: see
"Site runthrough, 2026-09-23" below.

338 client tests, 40 server tests, build clean.

## Site runthrough, 2026-09-23

A pass over the live site and the demo path, ahead of recording the demo video.
Everything below is fixed in the working tree and waiting on one deploy.

**Not fixed in code, needs a deploy to take effect.** `FRED_API_KEY` was never
set in Vercel, so `/api/sofr` returned `{"rate":null,"error":"Server
configuration error"}` and every deal on the live site was priced at the 4.25%
`DEFAULT_SOFR` fallback while real SOFR was 3.87%. The key is set now. It
applies on the next deploy, since Vercel only injects env vars into a new
deployment. At 3.87% the Granite Ridge demo deal still scores 80, so this does
not move the video's number; the test carries the band where it would.

**The rate lied about where it came from.** The chip under the deal form was a
binary: print "live" if the source string said so, otherwise print "cached".
With the FRED fetch failing and nothing in localStorage, it claimed a cached
FRED reading that had never been fetched. It now distinguishes live, cached and
default, and says so in a tooltip. Same class of defect as the credit rating
defaulting from silence.

**Three metric cards stated a target they did not hold themselves to.** The
`threshold` string and the `flag` comparison on every card were literals inline
in App.js, a third copy of the thresholds alongside `FACTOR_TARGETS` and
`DEFAULT_CRITERIA`, and they had drifted:

| Card | Printed | Showed | Factor table said |
|---|---|---|---|
| Term / Life | Target < 60% | 58.3% EXCELLENT | < 80% |
| LTV | Target < 85% | 85.0% GOOD | ≤ 85% |
| Rev. Conc. | Target < 15% | 16.3% GOOD | < 15% |

Term coverage printed two different targets one scroll apart. The literals are
gone: targets now come from the module's `FACTOR_TARGETS`, ceilings from the
firm's own criteria, and the operators match the factor table. The 60 / 15 /
1.50 breakpoints were never targets; they are the status bands in
`Deal_Screening_Model_Assumptions.md` and they stay, as gradients only. Two
latent bugs went with them: the DSCR card hardcoded "Min 1.25x" on AR deals
actually judged at 1.10x (now `dscrFloorFor`, shared with `evaluateScreening`),
and no card moved when a firm changed its policy in Settings.

**Declined behaved as the stage after Funded.** Stage moves were `idx ± 1` over
a flat array ending Funded, Declined, so the board offered "Declined ›" on a
funded deal and "‹ Funded" on a declined one. The stage model now lives in
`src/lib/pipelineStages.js` with an explicit transition map, enforced in
`handleMove` and in the drawer's stage picker, which could reach any stage from
any other. Declined is a branch off the working stages; Funded has no forward
move; Declined reopens at Screening. 17 tests.

**Aging fired on terminal stages.** `days > 14` went amber regardless of stage,
so a funded deal at 45 days read as a problem. Now active stages only.

**Monitoring was empty in demo mode.** Every prospect who clicked Monitoring in
`?demo=1` got "No facilities yet", while the pitch, `DEMO_SCRIPT.md` and Video B
all say the screening assumptions carry forward after a deal funds.
`src/data/demoMonitoring.js` now seeds the two funded demo deals as facilities,
built from the real `calculateMetrics` and `getDefaultCovenants` the way
`demoPipeline.js` builds its scores. One tracks its underwrite. The other lost
two contracts in Q2: DSCR 5.70x to 2.38x, leverage 1.56x to 3.44x, both still
inside covenant, with the quarterly financials overdue. That gap between the
underwrite and the current reading, with no covenant breached, is the drift
view's whole argument.

**A real bug the seeding exposed.** `fetchPortfolioDrift` took the first test
row it saw per covenant and relied on the caller having sorted newest first.
The Supabase branch orders by `test_date desc` so it held there; the demo
branch returned insertion order, oldest first. "Current" showed the *first*
reading a facility ever filed, understating exactly the drift the view exists
to show. It now picks by `test_date`, and `listDemoTests` sorts to match the
query it stands in for.

**Copy.** All ~24 user-facing em dashes are gone, across `DueDiligenceChecklist`
(12), `SettingsPanel` (4), `SensitivityChart`, `StressTestPanel`,
`ScoringWeights`, `AuditLogViewer`, `HistoricalDealsTable`, `IndustryBenchmarks`,
`incompleteFields`, `templateGenerator`, `exampleDeals`, `historicalDeals`,
`screeningCriteria` and the equipment module's financing descriptions. The
bare `'—'` no-value glyph stays. Also: "Heartland Foods Manufacturing Co.."
printed a double period, the facility commitment field showed a raw
`1530000` with no separators, and reporting covenants read "Quarterly ·
Quarterly" because a reporting covenant's target is its cadence.

**Not a defect, recorded because it was raised as one.** `getDefaultCovenants`
seeds every covenant from the firm's screening criteria, one source, so DSCR at
1.25 and leverage at 5.0 are the same kind of number and the basis is already
consistent. What that does mean: a facility underwritten at 5.69x DSCR carries
the same 1.25x covenant as one underwritten at 1.3x, because the seed is the
policy floor rather than a cushion below the underwritten case. That is why
neither funded demo deal can breach a financial covenant without an implausible
collapse, and it is an open design question rather than a bug.

**Demo prep.** `src/data/demoExtraction.test.js` asserts every figure Video A
says out loud, each test named by the timestamp of its beat, driving the real
merge and the real scoring. That replaces phase 0's by-hand checklist.
`scripts/capture-demo-extraction.js --check` runs a live extraction and diffs it
against the fixture without writing, which is the pre-shoot question when
recording signed in rather than in demo mode. `VIDEO_SCRIPTS.md` contradicted
itself on recording mode, telling you to use `?demo=1` in the shared preamble
and to record signed in in Video A's header. Settled as signed in, for both.

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
5. **Download PDF produced no PDF at all.** Found 2026-09-15. html2canvas
   1.4.1, which html2pdf bundles, cannot parse `oklch()`, and that is how
   Tailwind 4 defines its palette. Preflight border colours alone were enough
   to throw, so every download fell through to the print-window fallback, and
   `deal_memos` recorded nothing, because the snapshot is only written after a
   successful download. Fixed by stripping the app's stylesheets from the
   clone html2canvas renders, via its `onclone` hook. The memo carries its own
   CSS, so it needs none of the app's.
6. **The capture node was positioned, so the memo was one blank page.** Found
   2026-09-15, behind the oklch error. html2pdf deep-clones the node it is
   given into its own container, where a `position: fixed` element is out of
   flow and measures zero high. The offscreen positioning now lives on a
   wrapper and html2pdf is handed an in-flow node. Also: taking only `<body>`
   from the memo document dropped its `<style>`, so section titles, the header
   and the tables printed unstyled. The stylesheet is now scoped to the
   capture container and carried in with the body.

   Fixed 2026-09-23, see "Memo pagination" below.

## Memo pagination, 2026-09-23

The memo is a flat run of blocks and html2pdf renders the whole thing to one
canvas, then slices it at fixed page heights. Anything without a rule is cut
wherever the boundary lands. Three defects came out of that, measured in
Chrome at the 662px width the memo is actually captured at.

1. **A forced break wasted most of a page.** Strengths & Risks carried
   `page-break-before: always`, which throws away whatever is left of the
   page it leaves behind. Page 2 held Key Metrics and Assessment and then
   stopped, 473px short of a 922px page. Removed. Nothing in the memo forces
   a break now, and a test asserts that for all three asset classes.
2. **Deal Overview was sliced through its table.** It straddled the page 1
   boundary with no rule protecting it. This one was not on the list and was
   the worst of the three, because a table cut mid-row reads as broken
   software rather than as a layout preference.
3. **The footer split across the last two pages**, and on the inventory memo
   the boundary fell between Source Documents and the footer, so the last
   page carried nothing but the disclaimer.

Fixed by protecting every top-level block (`page-break-inside: avoid`, which
html2pdf reads per element and honours by inserting a padding div), and by
wrapping Source Documents and the footer in one `keep-together` block so the
memo cannot end on a page that only disclaims. A `tr` rule is the safety net
for a section that ever grows past a page: it would then break between rows
rather than through one.

Equipment went 4 pages to 3, inventory 4 to 3, AR stayed at 4. No block is
split in any of them.

**A latent bug in `scopeMemoCss` surfaced while doing it.** It reads
everything up to a brace as a selector list and splits it on commas, so the
first stylesheet comment containing a comma had its own prose scoped as
selectors and left the real rule beneath it unscoped, where it silently
stopped applying inside the capture container. Comments are now stripped
first. This was dormant only because the memo stylesheet had never carried a
comment.

`node scripts/preview-memo.js [module]` renders any of the three to
`outputs/`, which is how all of this was measured.

## Open — product

1. **The memo repeats itself.** Recommended Action restates the score banner
   verbatim on page one. Editorial cut, small.
2. ~~**No memo is ever stored.**~~ Done 2026-09-03. `deal_memos` holds the
   model and the rendered HTML for every memo downloaded against a pipeline
   deal, deduped by content hash, append-only by RLS (no UPDATE or DELETE
   policy). Reopening a deal now shows what has drifted since the memo on file.
   Migration `supabase/migrations/supabase_deal_memos.sql` was run in Supabase
   on 2026-09-03. Live.
3. ~~**TeamManagement.js was never converted to the light theme.**~~ Done
   2026-09-03. All 53 `slate-*` classes and every white-alpha surface are gone.
   The Redeem button lost its emerald gradient to match the other saves on the
   screen, and one em dash left the copy.
4. **App.js is 1,708 lines.** Route split (LandingRoute, NewDealRoute,
   PipelineRoute, DashboardRoute) plus a `useDealScoring` hook is still the plan.
5. **Duplicate team and invite UI** in SettingsPanel and TeamManagement.
6. **TypeScript migration is partway.** `strict: false`, `allowJs: true`.

## Open — pipeline integrity and flow

Raised 2026-09-03: is the tie from a new deal into the pipeline clean, is the
pipeline legible about *which* deal you are looking at, and can the right things
be edited without the load-bearing things being casually alterable.

**Flow audit run 2026-09-03, and all 18 findings fixed the same day.** Walked
new deal, upload, extract, screen, save, reopen, restage, memo, through to
funded, plus the batch path. Each finding below is kept with its fix, because
the defect is the reason the code looks the way it does now. 282 client tests
(up from 268) and 40 server tests pass, build clean.

Three pieces of shared code came out of this, and they are the load-bearing part
of the fix:

- `src/utils/dealMetrics.js` — `computeDealMetrics` and `applyOrgSpread`. One
  definition of a deal's metrics, at the live rate and under the firm's spreads.
  The org override logic was inline in App.js, which is why the drawer had no
  access to it.
- `src/lib/dealVerdict.js` — `verdictForDeal`. One verdict, from
  `evaluateScreening`, honouring firm thresholds and the hard gates. Returns a
  semantic category, never Tailwind classes.
- `src/lib/scoringWeights.js` — `DEFAULT_WEIGHTS` and `validateWeights`, lifted
  out of the lazy-loaded `ScoringWeights` component so App.js can read saved
  weights at startup without pulling in a lazy chunk.

### Wrong numbers or wrong verdict (fixed)

1. **Collapsing the results pane silently reverts to default credit policy.**
   `ScreeningCriteria` (loads the firm's saved thresholds) and `ScoringWeights`
   (loads saved weights) mount *only* inside the results pane, which renders
   only when `valid && paneMode !== 'form'`. `SettingsPanel`'s loader
   early-returns unless the panel is open, so it is not a second source.
   `paneMode` persists in `localStorage` across sessions. So an analyst who
   customises thresholds and then collapses the results pane screens every
   subsequent deal against `DEFAULT_CRITERIA`, with no indication. The verdict,
   the policy printed in the memo, and now the frozen memo snapshot are all
   computed against the wrong thresholds. Worst finding in the audit: a layout
   preference changes scoring.
   `App.js:536,1043,1560,1564`, `ScreeningCriteria.js:50`, `SettingsPanel.js:76`.
   **Fixed.** App.js now loads saved criteria and weights in its startup
   `fetchPreferences` call, which is the only place guaranteed to run. The
   components keep their own load, which is now harmless duplication of the
   same values.
2. **Three different verdicts for the same deal.** The screening view runs
   `evaluateScreening(criteria, ...)`, which honours firm thresholds and the
   hard DSCR / LTV / leverage / concentration gates. The pipeline card runs
   `getVerdict(score)` off hardcoded 75/35 and ignores the `criteria` prop the
   component is already given. The drawer runs `verdictFor(score)`, also
   hardcoded, and renders that chip directly above the reason list that
   `evaluateScreening` produced. A deal scoring 82 that breaches the LTV ceiling
   reads `PASS · 82/100` with its own failure reasons printed underneath.
   `DealPipeline.js:70,603`, `DealDetail.js:42,249,284`.
   **Fixed.** Both now call `verdictForDeal`. The board memoises one verdict per
   deal across the whole list rather than recomputing per card render, and hangs
   the failure reasons off the chip's tooltip. Covered by
   `src/lib/dealVerdict.test.js`.
3. **The drawer prices every deal at 4.25%.** `mod.calculateMetrics(deal.inputs)`
   is called with no `sofr` argument, so it falls back to `DEFAULT_SOFR`, while
   the screening view passes live FRED SOFR. The drawer also skips the org
   spread override App.js applies. Same deal, two DSCRs, depending on which
   surface you opened. `DealDetail.js:163`.
   **Fixed.** `sofr` and `orgSettings` now travel App to DealPipeline to
   DealDetail, and every surface goes through `computeDealMetrics`.
   `orgSpreadDebtService.test.js` now exercises `applyOrgSpread` directly
   instead of only describing the shapes it should have.
4. **Reloading the page strips a memo's source documents.** The draft persists
   `inputs`, `activeModule`, `activePipelineDealId`, but not `extraction`. On
   reload `memoSourceDocuments` is `[]`. The provenance *is* stored on the
   pipeline row and *is* restored by `loadDealIntoScreening`, just never by the
   draft-restore path. So: build a deal from four documents, save it, refresh,
   download the memo, and the memo has no "where these numbers came from"
   section, which is the product's headline claim. The snapshot then freezes
   that empty state as the record. `App.js:300,427,659`.
   **Fixed.** On restore, if a pipeline deal is bound and nothing is in memory,
   App.js rehydrates `extraction_provenance` from the deal row, guarded by a ref
   so it runs once per deal. A deal built from documents but never saved to the
   pipeline still loses provenance on refresh; that was the accepted trade for
   keeping the draft row small.

### Blocked or dead-ended (fixed)

5. **"Add Deal" on the pipeline tab fails unless a valid deal is already
   loaded.** `handleConfirmAdd` posts `currentInputs || {}`; the server
   validates and rejects. Confirmed by running `validateDealInputs({})`: invalid
   on `annualRevenue`, `ebitda`, `industrySector`, `creditRating`. The optimistic
   card appears, then vanishes behind a generic "Failed to add deal to
   pipeline". The board's own create affordance cannot create a deal.
   `DealPipeline.js:127`, `api/score-deal.js:115`.
   **Fixed.** The button is disabled unless a scored deal is open on New Deal,
   with the reason in the tooltip and a line of text beside it. A pipeline deal
   is a screened deal, and the affordance now says so instead of failing.
6. **Switching asset class leaves a pipeline deal bound.** `handleModuleChange`
   resets inputs and clears extraction but not `activePipelineDealId`. "Update
   Pipeline Deal" then PATCHes AR inputs onto an equipment deal, the server
   validates against the stored asset class and 400s, and the toast says
   "Failed to update deal" with no reason. The memo drift notice also compares
   across asset classes while this is true. `App.js:284`.
   **Fixed.** `handleModuleChange` clears `activePipelineDealId`. The inputs no
   longer describe that deal, so the binding goes with them.
7. **The activity feed prints raw action strings.** `describeAudit` has no case
   for `update_inputs`, which is what the server writes on every rescore, nor
   for `generate_memo`. Both hit `default` and render the literal string. The
   `case 'update'` branch that would say "Rescored 72 to 68" is keyed to an
   action the rescore path never writes, so it has never once rendered.
   `DealDetail.js:407`, `api/score-deal.js:222`.
   **Fixed.** `describeAudit` gained `update_inputs` and `generate_memo` cases.
   The score sentence moved onto `update_inputs`, where the data actually is,
   and distinguishes a real rescore from an input edit that left the score
   unchanged.
8. **Nothing warns before overwriting a decided deal.** "Update Pipeline Deal"
   rewrites inputs and score with no regard for stage or for an existing
   committee memo. Server side is sound: score recomputed server-side, org
   checked, audit written. This is a UX gap, not a hole, but it is the one that
   detaches a memo from its deal.
   **Fixed.** "Update Pipeline Deal" now confirms first when a memo exists or
   the deal has moved past Screening, naming which of the two applies and
   stating that the memo stays frozen while the deal's numbers move away from
   it. The button also lost its gold-on-gold styling, which was unreadable, and
   is now a neutral secondary next to the gold "Save to Pipeline".
9. **A failed delete reorders the board.** Rollback is
   `setDeals(prev => [...prev, removed])` against a list ordered
   `updated_at desc`, so a deal that fails to delete silently drops to the
   bottom of its column. `DealPipeline.js:169`.
   **Fixed.** The index is captured before the optimistic removal and spliced
   back on failure.
10. **Two autosaves race their own loaders.** The App draft effect (2s) and
    `ScreeningCriteria`'s save effect (1s) each schedule a write of default
    state on mount while the fetch of real state is still in flight. If the
    fetch is slower than the timer, defaults land on top of saved state. Both
    self-correct once the fetch resolves, unless the user leaves inside the
    window. `App.js:425`, `ScreeningCriteria.js:62`.
    **Fixed** in both components with a ref that skips the save on first run.
    The App draft effect is left as it was: its payload is the working deal,
    which is restored wholesale a moment later, so the window is harmless
    there.

### Presentation (fixed)

11. **The pipeline board was never converted to the light theme.** This is why
    the tab looks wrong, and it is invisible to a `slate-*` grep because the
    leftovers are `*-400` foregrounds on 8% alpha washes: `STAGE_STYLES`,
    `scoreBg`, `scoreColor`, `getVerdict`. `text-emerald-400` on an 8% emerald
    wash is barely legible on cream. The aging signal (`days > 14` to
    `text-amber-400`) is the least visible thing on the card, and the
    "Incomplete" chip is correctly light-themed while sitting directly beside
    dark-themed verdict chips. Card hover is `hover:ring-white/[0.06]`,
    invisible on white, so clickable cards have no hover state at all.
    `DealPipeline.js:27-74,557,627`.
    **Fixed.** Every stage style, score badge and verdict chip restated as a
    light-theme pairing: 50-level wash, 200-level border, 700 or 800-level
    foreground. Aging text moved to `amber-700`. Card hover is now a border and
    shadow change that is actually visible.
12. **Rename on a card is double-click only**, advertised only in a `title`
    tooltip. Single click opens the drawer. The drawer's name field is the
    discoverable path; the card's is the hidden one.
    **Fixed.** A pencil button appears on card hover. Double-click still
    works.
13. **Move buttons conflate "no next stage" with "no permission."** Both render
    greyed with an empty `title`, so a user without `pipeline.move_approved`
    gets an unexplained dead control rather than a reason.
    **Fixed.** The tooltip now distinguishes the end of the pipeline from a
    missing permission, and names the stage in both cases.
14. **No memo access from the pipeline.** `MemoHistory` renders only in the
    screening view, so the drawer, which is where you go to understand a deal,
    gives no sign a committee memo exists. Gap introduced by the 2026-09-03
    memo work.
    **Fixed.** The drawer has a Committee memos section listing each memo with
    its date, verdict, score and author, and flags where the deal's current
    score has moved away from the memo's.
15. **Residual dark-theme classes app-wide.** Correcting a number from the
    original audit: the "~35 across 12 files" figure was wrong, inflated by a
    greedy pattern that matched the `translate-` in `-translate-y-1/2`. The real
    count in source is 16.
    **Partly fixed.** The gold-on-gold button, the New Deal nav item, the
    Header icon button and the Clear button are done. Genuinely remaining, none
    of them on a demo path: `DueDiligenceChecklist.js` (4), `MetricCard.tsx`
    (3), `ExportPanel.js` (2), `AuditLogViewer.js` (2), `TutorialBeacon.tsx`,
    `StressTestPanel.js`, `PortfolioAnalytics.js` (1 each). Carried to the UX
    pass.

### Documentation drift (fixed)

16. **CLAUDE.md is wrong about `server-lib/validate.js`.** It says
    "equipment-finance only as of now". It validates all three asset classes via
    `validateARInputs` and `validateInventoryInputs`. **Fixed** in CLAUDE.md.
17. **`DealDetail.js`'s header comment** points at AUDIT.md for "pinning rate
    and criteria at score time" as open. Done for memos as of 2026-09-03.
    **Fixed.** The comment now describes what the panel actually does and points
    at `deal_memos` for the frozen record.
18. **Em dash in a generated deal name.** `Untitled Deal — <date>` at
    `App.js:886` becomes the deal's name on the board. `BatchScreening.js` gets
    this right.
    **Fixed**, along with a recent-deals tooltip that read
    `industry — Score n — date`. Left alone deliberately: three places use a
    bare em dash as the "no value" glyph in a metric cell. That is a typographic
    placeholder rather than copy, and `TeamManagement.js` uses `--` for the same
    job, so the two should be reconciled in the UX pass rather than silently
    changed here.

### Verified clean

The upload and parse path handles failure correctly (status, message, file input
cleared, no orphaned staged files), `removeDocument` re-merges without
re-parsing so there is no repeat model cost, attachments upload after the deal
has an id with a partial-failure toast, provenance travels correctly on the
drawer's "Open in screening", stage-change permissions are reflected in disabled
button state, and the server PATCH recomputes score server-side, checks org
ownership and writes the audit row.

### Still to run

- **Integrity audit.** What can still be changed after a decision, and does the
  record show it. Which fields should be editable in place (name, notes, stage)
  and which should require an explicit re-screen with the memo consequence
  stated. Open question surfaced by the flow pass: screening criteria live in
  `user_preferences`, so they are per-user, not per-firm. Two analysts in the
  same firm can screen the same deal against different thresholds and each memo
  will truthfully print a different policy.
- **UX audit.** Information hierarchy on the board and in the drawer, whether a
  card tells you what deal it is at a glance, whether the pipeline tab carries
  its own weight. Findings 11 to 15 are the starting list. Also: there is no
  drag and drop, despite the board reading as a kanban.
- **Cleanup carried over from the flow pass.** Duplicate mutation paths in
  `DealPipeline.js`: two rename handlers (`commitRename`, `renameDeal`) and two
  note handlers (`saveNoteFor`, `handleSaveNote`), where the comment on
  `saveNoteFor` claims both callers route through it. They do not. Left alone
  during the flow pass because consolidating them changes behaviour on the
  optimistic-update path, which is not a thing to do the day before a
  recording.
- **Residual dark-theme classes**, the 16 listed under finding 15.
- **The em dash placeholder**, per finding 18.

## Open — go to market

1. **One-pager** (`marketing/one-pager.html`). Mostly done 2026-09-03. Mono is
   now figures and filenames only; eyebrows, section heads, table headers, step
   numbers, chips and the footer rule moved to Sans, separated by weight and
   tracking rather than by a change of face. Sheet went 780px to 940px, with
   prose still capped at 66ch and the lede at 50ch. The IBM Plex conversion and
   both fixes are now published to the artifact URL. **Still open:** the
   two-column layout above 1100px, which is a reading-order change and was not
   taken unilaterally.
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
