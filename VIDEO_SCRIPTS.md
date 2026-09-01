# Video scripts

Two videos, each doing one job. Shooting scripts, not outlines: the voiceover
is written to be read aloud as written.

- **Video A — Product.** For a lender. What it does, why it is different.
- **Video B — Practice.** For a professional audience. Why the hard part is
  the hard part, and what the judgment calls were.

Both run about two minutes. Neither mentions that this was built solo, and
neither apologizes for anything. The product carries it.

`DEMO_SCRIPT.md` is a different document: a runbook for driving the product
live on a call. This one is for recording.

---

## Before either take

**Screen**
- 1920x1080, browser at 100% zoom. Do not record a 4K screen scaled down.
- Hide the bookmarks bar, close every other tab, quit anything that shows a
  notification. One stray Slack toast ends a take.
- Full-screen the browser. No dock, no taskbar, no clock.
- Light theme. The product is designed for it.

**Data**
- Use `?demo=1`. It runs the real scoring and the real merge against seeded
  data, and the upload replays a captured extraction rather than spending an
  API call. Nothing on screen is fake; nothing is slow.
- Check the pipeline looks lived-in before you start: fifteen deals, mixed
  verdicts, notes on the cards.

**Cursor**
- Move deliberately. Slow is fine, jittery is not.
- Never hunt. If you have to look for something, cut and re-take.

**Latency**
- Cut every wait in the edit. The extraction takes about six seconds; on tape
  that is six seconds of nothing. Cut to the result.
- Never let a spinner appear in the final cut.

**Audio**
- Record voiceover separately, after picking the takes. Trying to narrate
  while driving produces both a worse take and worse narration.
- Caption both videos. Most feed video is watched muted, and Video B in
  particular does not work without its words.

---

# Video A — Product

**Runs 2:00. For someone at an ABL shop who might use this.**

The structure is deliberate: it opens on the finished memo, then rewinds. A
viewer who has already seen where this ends up watches the middle differently.

| Time | On screen | Voiceover |
|---|---|---|
| **0:00** | The finished committee memo, mid-page. Slow scroll through the metrics table. | "This is a committee memo for a $5.3 million equipment facility." |
| **0:06** | Keep scrolling. Land on Source Documents. | "It took four documents and about ninety seconds. Here is the whole of it." |
| **0:12** | Cut to a folder or desktop showing the four files: credit application, financial statements, equipment quote, broker email. | "A deal does not arrive as a form. It arrives as this." |
| **0:20** | Hold on the four filenames. | "An application, two years of financials, a dealer quote, and a broker's cover email. Four documents about one borrower, and they do not agree with each other." |
| **0:28** | Tranche, New Deal, empty. Drag all four in at once. Cut the wait. | "So the first thing it does is read all four together." |
| **0:36** | The document list, each row showing its detected type. | "Each one is classified. Application, financials, quote, deal sheet. Nobody tagged those, and it matters for what happens next." |
| **0:45** | Scroll to the amber conflict block. Hold. | "Because here is where the documents disagree." |
| **0:52** | Cursor rests on the EBITDA line. | "The broker says EBITDA is just under 7.9 million. The reviewed financials say 7.4." |
| **1:00** | Still on the EBITDA line. | "It took the financials. Statements outrank a broker summary on financial data. And it is telling me it did, with both numbers and both filenames." |
| **1:08** | Click **Use that**. Right pane recomputes: margin 19.3 to 20.6. | "If I disagree, I override it, and everything downstream moves." |
| **1:14** | Click **Use that** again to restore. Then expand **Show what came from where**. | "Every field traces to a document. Financials won on money. The dealer quote won on the equipment. The application won on who the borrower is." |
| **1:24** | Right pane: score 80, PASS. | "Twenty fields, four documents, and none of them typed. It scores 80." |
| **1:32** | Point at the red flag: mining, high risk. | "And it says which factor cost it points, not just the number." |
| **1:40** | Click **Download PDF**. Cut to the memo, top. Scroll: transaction summary, sources and uses. | "The memo opens on the ask, the way a memo should." |
| **1:48** | Keep scrolling to Source Documents. Hold. | "And it closes by naming every document the figures came from." |
| **1:55** | Hold on the memo. No logo card. | "Equipment finance, receivables, inventory. Tranche, at gettranche.app." |
| **2:00** | End on the memo. | *(silence)* |

**If it runs long**, cut 0:12 to 0:20 and open on the upload. Never cut the
conflict beat.

**Do not**: tour the navigation, open Settings, show the pipeline, mention
that a model is involved anywhere except where the video already does.

---

# Video B — Practice

**Runs 2:00. For a professional audience: credit people, fintech, anyone
assessing whether the person behind this understands the domain.**

Different job, so a different opening. Video A opens on the artifact because
a buyer wants the outcome. This one opens on the observation, because that is
the thing worth being known for.

The register throughout is matter-of-fact. Not selling, not confessing.

| Time | On screen | Voiceover |
|---|---|---|
| **0:00** | Four filenames, plain. | "Four documents about the same borrower. Three of them disagree about EBITDA." |
| **0:08** | Hold. | "That is not an edge case. That is every deal." |
| **0:14** | Cut to the conflict block in Tranche. | "The interesting problem in reading credit documents is not reading them. It is deciding which one to believe." |
| **0:24** | Cursor on the EBITDA row. | "A broker email and a set of reviewed financials are not equally credible about EBITDA. A dealer quote and a credit application are not equally credible about what the equipment is." |
| **0:34** | Expand **Show what came from where**. Slow scroll. | "So precedence is set per kind of fact, not once globally. Financials win on money. The quote wins on equipment. The application wins on identity." |
| **0:46** | Point at a conflict row showing both values. | "And where two documents disagree, both are shown. Picking one silently would have been easier to build and worse to use. An analyst who never learns the broker said something different cannot exercise judgment about it." |
| **1:00** | Scroll to the audit view: "Where these numbers came from." | "Which leads to the decision I would defend hardest." |
| **1:08** | The field-by-field table, origins visible. | "The model reads documents. It does not score anything. It never has." |
| **1:16** | Scroll to "How that scored", the factor table. | "Extraction fills a form. A person reviews it. The score is computed from what that person confirmed, by arithmetic you can read." |
| **1:26** | The weighted composite row, then "Judged against". | "So every number on a memo traces back to a document or to a decision somebody made. Nothing is generated prose." |
| **1:36** | Cut to the memo, Source Documents section. | "The memo says so on its own face. It lists the documents, and it says the figures were reviewed before scoring." |
| **1:46** | Cut to the pipeline board, brief. | "It screens across equipment finance, receivables and inventory, and it carries the assumptions forward into covenant monitoring after a deal funds." |
| **1:55** | Land on the audit view or the memo. | "Tranche. gettranche.app." |
| **2:00** | Hold. | *(silence)* |

**The line that does the work** is at 1:08: *the model reads documents, it
does not score anything.* Everything before it sets that up and everything
after it is evidence. If a take is soft, it is usually soft there.

**If it runs long**, cut 1:46. The asset-class breadth matters least here.

**Do not** say: "I built this," "as a side project," "I taught myself," or
anything hedging the work. The written build story is where the first person
belongs. Here the product speaks and the credibility is in the judgment on
display.

---

## Where each one goes

| | Video A | Video B |
|---|---|---|
| Aspect | 16:9 | 4:5 or 1:1 for feed, 16:9 if linked |
| Captions | Yes | Yes, non-negotiable |
| Posted with | The one-pager | The written build story |
| Opens on | The memo | The observation |
| Ends on | The memo | The audit view |

Post Video B with the build story rather than alone. The video makes the
claim; the writing shows the work behind it, including what broke.

---

## After the first take

Watch it once on mute. If you cannot follow what is happening without the
voiceover, the screen work is wrong and no narration will rescue it.

Then watch it at 1.5x. Anything that feels slow at 1.5x is far too slow at 1x.
