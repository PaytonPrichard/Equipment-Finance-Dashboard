# Marketing assets

## one-pager.html

The product one-pager, for sending ahead of a conversation.

Published as an Artifact at:
https://claude.ai/code/artifact/8db1256e-1e6a-4708-8fd6-f3c9bfd3c132

It is private until shared from the page's share menu.

**Design note.** The page is laid out as a credit memo, because that is the
artifact the product produces: ruled section heads, a metadata masthead,
tabular figures, verdict chips. It follows the app's own palette (warm
off-white ground, near-black ink, gold reserved for one thing at a time)
rather than inventing a second visual identity.

**Type.** One superfamily, three roles with one job each. IBM Plex Serif sets
the wordmark, the lede and the step headings. IBM Plex Sans sets body text and
every label: eyebrows, section heads, table headers, step numbers, chips, the
footer rule. IBM Plex Mono is reserved for figures and filenames, so a
monospace face on the page always means machine output. The sheet is 940px;
running text stays capped at 66ch and the lede at 50ch.

**Every claim on it is checkable:**

| Claim | Where it comes from |
|---|---|
| 20/20 fields, 0 invented | `node scripts/score-extraction.js` |
| 6.3s for four documents | Measured against the live API, parallel fan-out |
| 3 disagreements surfaced | The Granite Ridge corpus conflicts |
| Memo has no model-written prose | Two tests in `src/components/ExportPanel.test.js` |
| Row-level isolation | RLS policies in `supabase/migrations/` |
| Audit on deal changes | `logAudit` calls in `src/lib/pipeline.ts` |

If any of those stop being true, fix the page.

**To update:** edit this file and re-publish to the same Artifact URL, so the
link you have already sent keeps working.
