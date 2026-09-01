# Demo script (live)

A runbook for driving Tranche live on a call or a screen share.

For recording, see `VIDEO_SCRIPTS.md`, which has two timecoded shooting
scripts with the voiceover written out. This document is the longer,
conversational version: it assumes someone is watching you and can interrupt.

Roughly **six minutes** at a comfortable pace. The cuts at the end say what to
drop if you have three.

---

## Before you start

**Pick a mode.**

| | Use it when | URL |
|---|---|---|
| **Demo mode** | Screen share, a link you send ahead, anyone clicking unaccompanied | `gettranche.app/?demo=1` |
| **Real account** | You want to prove it is the actual product, not a mock | sign in normally |

Demo mode runs the real scoring engine and the real merge logic against
seeded data. The only thing stubbed is the document upload, which replays a
captured extraction instead of spending an API call. Everything you click
behaves the way it behaves signed in.

**If you are on a real account**, have `test-deal-sheets/equipment/granite-ridge-multidoc/`
open in a file picker beforehand. Four files. Do not go hunting for them on camera.

**Deep links**, so you never navigate on screen:

- `?demo=1` — New Deal, empty
- `?demo=1&tab=pipeline` — the board
- `?demo=1&tab=dashboard` — portfolio view

---

## The through-line

> A deal arrives as a pile of documents. Getting it in front of a committee
> means a day of retyping and a memo somebody builds by hand. Tranche does
> that in about two minutes, and shows its work.

Say some version of that once, at the top. Everything after is evidence.

---

## 1. The problem, stated with the documents themselves (45s)

Open `?demo=1`. Land on New Deal.

Show the four Granite Ridge documents if you have them open, or just name them:

- A credit application
- Two years of reviewed financial statements
- A dealer quote for the equipment
- A broker's cover email

**Say:** "This is how a deal actually shows up. Four documents, three formats,
and the numbers in them do not agree. Someone has to reconcile that before
anyone can look at it."

---

## 2. Upload the set (60s)

Click **Load sample documents** (demo mode) or drag all four in at once.

Wait for it. Roughly six seconds against the real API for four documents,
because they are read in parallel rather than one after another.

**Point at the document list.** Each one is classified: credit application,
financial statements, equipment quote, deal sheet. Nobody tagged those.

**Say:** "It read all four and worked out what each one is. That matters for
the next part."

---

## 3. The conflict. This is the moment (75s)

Point at the amber block: **3 fields where the documents disagree.**

Read the EBITDA line out loud:

> EBITDA: 7,400,000 from 02_financial-statements.pdf.
> 04_broker-email.txt says 7,900,000.

**Say:** "The broker said just under 7.9. The reviewed financials say 7.4. It
took the financials, and it is telling me it did. A tool that silently picked
one is a tool I cannot trust with the other nineteen fields."

Click **Use that** on the EBITDA line. Watch the right side recompute:
EBITDA margin 19.3% to 20.6%, debt yield 138.7% to 148.1%.

Click **Use that** again to put it back.

**Say:** "It is a suggestion, not a decision. I am still the analyst."

Then expand **Show what came from where**.

**Say:** "Every field traces to a document. The financials won on money. The
dealer quote won on equipment. The application won on who the borrower is.
That is not one ranking, it is a rule per kind of fact."

---

## 4. The verdict (45s)

Scroll the right pane. The deal scores **80/100, PASS**.

**Say:** "Twenty fields, four documents, about two minutes, and none of the
numbers were typed."

Point at one red flag: mining is a high-risk sector, which costs it points.

**Say:** "It is not just a number. It says which factor hurt and by how much."

---

## 5. The memo (60s)

Click **Download PDF**.

Open it and scroll from the top:

- **Transaction Summary** — "$5,333,750 84-month EFA to finance new heavy
  machinery for Granite Ridge Materials LLC"
- **Sources and Uses** — cost, borrower contribution, amount financed
- Score, thresholds, red flags, key metrics, sensitivity, structure
- **Source Documents** — the four files, and the line stating that figures
  were reviewed by the analyst before scoring

**Say:** "This is the artifact. It opens with the ask, the way a memo should,
and it ends by naming every document it came from. Nothing in here is
model-written prose. Every sentence is a number from the file or a template
picked by a threshold."

That last sentence is the one that lands with credit people. Do not skip it.

---

## 6. The pipeline (45s)

Go to **Pipeline** (`?demo=1&tab=pipeline`).

Fifteen deals across five stages, with column totals.

Click a deal title to open the drawer. Show: score and verdict, the metrics,
the screening reasons, notes with room to read them, the documents, the stage
row, the activity trail.

**Say:** "Every stage change and every note edit is recorded. When committee
asks why this moved, there is an answer."

Open **Iron Mountain Aggregates** (63, FLAG) if you want to show the failure
side: it names leverage at 5.7x against a 5x maximum, and LTV at 106%.

---

## 7. Close (30s)

**Say:** "Three asset classes: equipment finance, receivables, inventory.
Same document ingest, same memo, different collateral logic. It is screening
and monitoring, not a system of record. It sits in front of your servicing
platform, not on top of it."

Stop. Let them ask.

---

## Cuts, if you have three minutes

Keep 2, 3 and 5. Upload, conflict, memo. Drop everything else.

The conflict block is the single most convincing thing in the product. If you
only get one beat, make it that one.

---

## Questions you will get

**"How do I know the extraction is right?"**
You do not, and it does not ask you to. Extracted values populate a form for
review and are never scored until you accept them. The accuracy scorecard
(`scripts/score-extraction.js`) grades extraction against a fixed answer key
and reports wrong values separately from missed ones, because a wrong number
is much worse than a blank one.

**"Is the memo AI-generated?"**
No. The only model in the product reads documents. The memo is assembled from
inputs you confirmed, metrics computed from them, and sentences chosen by
numeric threshold. Section 12 of `Deal_Screening_Model_Assumptions.md` writes
out the full argument, and two tests fail if the memo module ever reaches for
the extraction path.

**"What are the thresholds, and can we change them?"**
Yes, per organization, in Settings. The memo prints the thresholds it applied
next to the composite, so a committee sees the policy the deal was judged
against.

**"Does it decide anything?"**
No. It is preliminary screening. That is stated on the memo and in the terms.

**"What happens after a deal is funded?"**
Covenants seed from the screening assumptions, and the monitoring view tracks
tests against them. That is where the screen-to-monitor continuity lives.

---

## If something goes wrong on camera

- **Upload hangs** — demo mode never calls the API, so switch to `?demo=1`
  and carry on.
- **A number looks off** — say you will check it and move. Do not debug live.
- **You get lost** — every deep link above lands somewhere clean.
