# Recording runbook

How to actually get Video A on tape and onto LinkedIn, assuming you have
never edited video.

`VIDEO_SCRIPTS.md` is the script. Do not rewrite it. This is the order of
operations and the button pressing.

Budget one evening for the first one. Maybe three hours of real work, of
which forty minutes is recording and the rest is setup and editing. The
second video you make will take an hour.

---

## The two decisions, already made

**Record in `?demo=1`.** Reversed on 2026-09-23, and the reason is worth
keeping.

The original call was to record signed in, because `DemoBanner.tsx` puts a
permanent amber "sample data, changes won't be saved" bar across the top and
a prospect reads that as a mockup. That reasoning assumed a live extraction
reproduces what the script says. It does not. Two runs against the same four
Granite Ridge files, half an hour apart, gave three conflicts, then five,
then four. Every figure that carries the memo held in all of them, but the
conflict count is the one number the video is built around, and 0:45 says
three.

Demo mode replays a captured extraction, so it says three every time.

The thing that made this an easy call: **drag and drop works in demo mode.**
`DealSheetUpload.js` routes a drop to the captured replay, spinner and all,
so the gesture at 0:28 is exactly the same on camera. The old note here
claiming 0:28 was "false in demo mode" was wrong; only the button label
changes. You can drag the four real files onto the zone and the fixture
loads behind it.

Two smaller consequences, both in your favour:
- The wait is 900ms of deliberate spinner, not six seconds of real
  extraction, so there is nothing to cut out of `02_upload`.
- It costs no API call, so you can shoot the upload beat as many times as
  you like.

**Record against production, at
`https://www.gettranche.app/?demo=1&capture=1`.**

`capture=1` drops the banner. It works only alongside `demo=1`, is never
remembered, and hides nothing else: the data is the same sample data and the
borrower is fictional either way.

Two things it does not fix, both now handled elsewhere:
- The analyst and firm used to read "Demo Analyst" of "Demo Capital
  Partners", in the app header on every screen and printed on the committee
  memo's masthead and footer. They are now J. Peter of Keystone Credit
  Partners, the same names `scripts/preview-memo.js` uses.
- `npm start` does not serve `/api/`, so a local recording shows SOFR as an
  amber **default 4.25%** rather than **live 3.87%**, on screen from 0:28
  onward. That is the reason to record against production rather than
  localhost.

**Tools: OBS Studio to record, CapCut to edit. Both free, both Windows.**

| Job | Tool | Why not the obvious alternative |
|---|---|---|
| Screen capture | **OBS Studio** | Loom cannot cut the middle out of a clip and cannot caption properly. It is a share-link tool, not a production tool. |
| Cut, voiceover, captions, export | **CapCut Desktop** | DaVinci Resolve is more powerful and much harder. Use Resolve only if CapCut puts auto-captions behind Pro, in which case Resolve's Auto Subtitles is free. |
| Voiceover mic | Whatever headset you own | A USB headset in a small carpeted room beats a laptop mic by a lot and a studio mic by very little. |

No paid software. No new dependencies in the repo.

---

## Phase 0. Dry run (20 min, do this first)

You are not recording yet. You are checking that the product still says what
the script claims it says. Never edit the product to match the script the
night before a shoot.

Most of this used to be a checklist of ten figures to read off the screen and
compare against the script by hand. It is now
`src/data/demoExtraction.test.js`, which drives the real merge and the real
scoring and asserts every figure Video A says out loud, each test named by
the timestamp of its beat. A scoring change that would have broken a beat
fails there instead of surfacing halfway through a take.

1. `npm run test:all`. If `demoExtraction.test.js` fails, the name of the
   failing test is the beat that moved. Fix the script, not the product.
2. Skip `--check` when recording in demo mode. It compares a live
   extraction against the fixture, and demo mode never runs a live
   extraction, so it answers a question you are not asking. Run it only if
   you go back to recording signed in.
3. `npm start`, open `?demo=1`, and walk Video A once with the script open.
   Confirm the conflict block reads **3 fields where the documents
   disagree** before you shoot anything. You are
   looking at the things a test cannot see: whether **Show what came from
   where** is legible at 1080p, whether the memo pages break cleanly, whether
   anything is visually broken on the path.
4. Time yourself reading the voiceover column aloud at a normal pace. If it
   runs past 2:05, cut 0:12 to 0:20 as the script already tells you to.

One drift worth knowing about: the screening rate is live SOFR from FRED,
which demo mode does not replay, and the 80 the voiceover says holds while
SOFR is at or below about 4.5%. It was 3.87% on 2026-09-23. The test carries
that band, so you will see it fail rather than discover it on tape.

**Do not fix product bugs in this phase.** If something is visibly broken,
write it down and decide tomorrow whether it blocks the shoot. The residual
dark-theme classes in finding 15 of `HANDOFF.md` are all off the Video A
path, so they block nothing.

---

## Phase 1. Clean the machine (20 min)

Every item here has ended somebody's take.

- [ ] Windows: Settings, System, Notifications, turn on **Do not disturb**
- [ ] Quit Slack, Discord, Outlook, Teams, Steam, anything with a toast
- [ ] Second monitor: unplug it or disable it. OBS capturing the wrong
      display is the most common beginner mistake
- [ ] New Chrome profile with zero extensions and zero bookmarks. Extension
      icons in the toolbar date a video and leak what you use
- [ ] `Ctrl+0` to force 100% zoom
- [ ] `F11` for fullscreen. No tabs, no address bar, no taskbar, no clock
- [ ] Settings, Accessibility, Mouse pointer, bump the size up one notch.
      Viewers need to track the cursor at feed size
- [ ] Charge the laptop and plug it in. Power saving throttles the encoder
- [ ] Look at what is on screen in New Deal that is not Granite Ridge. If a
      recent deals list shows real deal names, clear them or keep them out of
      frame

---

## Phase 2. Set up OBS (20 min, once, forever)

Download from obsproject.com. Skip the auto-config wizard, it optimizes for
game streaming.

1. **Settings, Video.** Base resolution `1920x1080`. Output resolution
   `1920x1080`. FPS `60`. Sixty matters here because half your shots are slow
   scrolls and thirty makes scrolling stutter.
2. **Settings, Output.** Output Mode `Simple`. Recording Quality
   `Indistinguishable Quality, Large File Size`. Recording Format `mkv`.
   Encoder: hardware `NVENC` or `QuickSync` if offered, `x264` otherwise.

   MKV, not MP4, because if OBS crashes mid-recording an MKV survives and an
   MP4 is a dead file. CapCut reads MKV. If it complains, OBS has
   **File, Remux Recordings** built in.
3. **Settings, Audio.** Set Desktop Audio and Mic to **Disabled**. You are
   recording picture only. Narration comes later.
4. **Settings, Hotkeys.** Bind Start Recording and Stop Recording to
   something like `Ctrl+Shift+F9` and `Ctrl+Shift+F10`. You must never be
   seen clicking OBS.
5. **Sources panel**, plus, **Display Capture**, pick your only display.
6. Record five seconds of your desktop, stop, open the file, confirm it is
   sharp and shows the right monitor. Do this now, not after a good take.

---

## Phase 3. Shoot the picture, silently, beat by beat (45 min)

**The rule that makes this survivable: one clip per beat, not one take of the
whole video.** A fumble costs you twenty seconds instead of two minutes. You
assemble them in order in the edit.

For every clip:
1. Get the screen into position first, with recording off.
2. Start recording. Count three in your head doing nothing.
3. Do the one action.
4. Count two doing nothing. Stop recording.

Those dead seconds at each end are your edit handles. Without them every cut
lands on top of a movement and looks amateur.

Shoot these clips in this order, which is not the order they appear in the
video. Grouping by screen state means less setup between takes.

| Clip | What you do | Covers |
|---|---|---|
| `01_files` | Explorer window on the four Granite Ridge files, list view, slow | 0:12 to 0:28 |
| `02_upload` | New Deal empty, drag all four in, let the real extraction run | 0:28 to 0:36 |
| `03_doclist` | Slow cursor down the classified document list | 0:36 to 0:45 |
| `04_conflict` | Scroll to the amber conflict block, stop, hold still | 0:45 to 0:52 |
| `05_ebitda` | Cursor rests on the EBITDA row. Do not click. Just hold | 0:52 to 1:08 |
| `06_usethat` | Click **Use that**, let the right pane recompute, hold | 1:08 to 1:14 |
| `07_restore` | Click **Use that** again, then expand **Show what came from where**, slow scroll | 1:14 to 1:24 |
| `08_score` | Right pane, score 80 PASS, hold, then cursor to the mining red flag | 1:24 to 1:40 |
| `09_memo` | Click Download PDF, open it, scroll from the top through sources and uses | 1:40 to 1:48 |
| `10_sources` | Keep scrolling to Source Documents, stop, hold five seconds | 1:48 to 2:00 |

Technique, all of it learned the hard way:

- **Scroll with the trackpad or a smooth scroll mouse, never the scrollbar
  handle.** Dragging a scrollbar looks like flailing.
- **Move the cursor in straight lines, and stop moving it when you are not
  pointing at anything.** A cursor drifting in circles reads as hesitation.
- **Never hunt.** If you have to look for a button, stop, cut, reposition,
  retake.
- **Shoot every clip twice**, back to back. The second take is almost always
  the one you use and it costs thirty seconds.
- `02_upload` in demo mode waits 900ms, not the six seconds a real
  extraction takes, so there is nothing to cut. Still never let the spinner
  land in the final cut.

---

## Phase 4. Assemble the picture (45 min)

Install CapCut Desktop from capcut.com. Free account.

1. **New Project.** Canvas `16:9`, project 1080p.
2. Drag your keeper clips onto the timeline in **script order**, following
   the Video A time column, not the clip numbers.
3. **Trim the handles.** Select a clip, drag its left edge in to where the
   action starts, drag the right edge to where it stops. That is ninety
   percent of editing.
4. **Cut the extraction wait** out of `02_upload`: park the playhead where
   the spinner starts, `Ctrl+B` to split, move to where the result appears,
   `Ctrl+B` again, select the middle piece, `Delete`, drag the right half
   left to close the gap.
5. **Speed up a slow scroll** if a beat overruns its slot. Right click the
   clip, Speed, 1.5x. Screen recordings tolerate this well.
6. Watch it through. Total should land near 2:00 with picture only.

Do not add music. Do not add transitions. Do not add zoom effects. Each one
makes a credit tool look like a Kickstarter.

---

## Phase 5. Voiceover (30 min)

Record after the picture is locked, watching the picture, so your pacing
matches what is on screen. That is why the script says record separately.

1. Small room, soft furnishings, door closed, phone on silent in another
   room.
2. Headset mic about a hand's width from your mouth and slightly off to the
   side, so plosives do not hit it straight on.
3. In CapCut, click the **microphone icon** on the timeline toolbar. It
   records straight onto the timeline while the video plays.
4. **One line per take.** Play the beat, record the line, stop. If you fluff
   it, delete that clip and go again. Do not read all twelve lines in one
   pass.
5. Read the voiceover column exactly as written. It was written to be read.
   Do not improvise, do not add "so" and "basically" to the front of
   sentences.
6. Flat and matter of fact. You are a credit professional explaining a tool,
   not a founder pitching. The script register is right, keep it.
7. When done, select the audio clips and turn on **Enhance Voice** or the
   noise reduction toggle in the audio panel. One click, real improvement.

---

## Phase 6. Captions (20 min, non-negotiable)

Most LinkedIn video is watched with the sound off.

1. CapCut, **Text, Auto captions**, English, generate.
2. **Proofread every single one.** Auto-captioning reliably mangles exactly
   the words this video depends on: EBITDA, DSCR, LTV, SOFR, "7.4 million",
   "80 out of 100", and "Tranche" itself. A caption reading "e bit duh"
   undoes the whole credibility argument.
3. Style: white text, dark box behind it, lower third but above where
   LinkedIn puts its own UI. Keep the default font.
4. Add one text element the script does not have: **a burned-in hook in the
   first two seconds.** LinkedIn autoplays muted, and a slow scroll over a
   memo with no words is invisible in a feed. Flat and factual, in the
   product's voice. Pick one:
   - "Four documents. Three disagreements. One committee memo."
   - "This memo was built from four documents in two minutes."

   Plain type, gone by 0:03. No animation.

---

## Phase 7. Export and check (15 min)

1. **Export.** 1080p, 60fps, MP4, bitrate Recommended or higher. Untick any
   watermark option. Name it `tranche-product-2min-2026-09.mp4`.
2. **Watch it on mute, start to finish.** If you cannot follow what is
   happening without the narration, the screen work is wrong and no voiceover
   rescues it. Reshoot the beat that lost you.
3. **Watch it at 1.5x.** Anything that drags at 1.5x is unbearable at 1x.
4. Watch it on your phone. That is where it will be seen.
5. Confirm the file is under 200MB. Two minutes of 1080p should be well under.

---

## Phase 8. Publish

**LinkedIn**
- Upload the MP4 natively. Never post a YouTube or Loom link, the feed
  suppresses posts that send people off platform.
- 16:9 is correct here. Do not crop a screen recording to square, it destroys
  the UI. If you want the taller feed footprint later, pad the 16:9 into a
  4:5 canvas with the caption block below the video. Second export, optional.
- LinkedIn will offer its own auto-captions. Decline, yours are proofread.
- Post it with the one-pager, per `VIDEO_SCRIPTS.md`. The video makes the
  claim, the one-pager is the checkable version.
- Post body: lead with the observation, not the product. The conflict block
  is the hook in the video and it is the hook in the copy.

**In conversations**
- Same MP4 sent directly, or unlisted YouTube if you need a link.
- Pair it with `gettranche.app/?demo=1` so they can drive it themselves. The
  demo banner that would have hurt the video helps here. It tells them
  nothing they touch is real.

**Keep the source**
- Save the CapCut project and the raw OBS clips somewhere findable. When a
  number in the product changes you reshoot one beat and re-export rather
  than rebuild the video.

---

## The day, compressed

Everything below is in the phases above. This is the sequence to follow with
the phases open beside you.

**Before you touch OBS**

1. `npm run test:all`. Green means the product still says what the script
   says. A failure in `demoExtraction.test.js` names the beat that moved.
2. Open `https://www.gettranche.app/?demo=1&capture=1`. Production, not
   localhost: the dev server does not serve `/api/`, so a local recording
   shows SOFR as an amber **default 4.25%** instead of **live 3.87%**, from
   0:28 onward.
3. Drag the four files from `test-deal-sheets/equipment/granite-ridge-multidoc/`
   onto the upload panel. Confirm **3 fields where the documents disagree**.
   That number is the video. If it is not 3, stop and read the note on
   recording mode at the top of this file.
4. **Click Download PDF and open the file.** Do not skip this. The memo
   download has broken twice before, both times silently: once because
   html2canvas could not parse `oklch()` and once because the capture node
   measured zero high. Neither showed an error on screen. You are checking a
   PDF exists, opens, and runs 3 pages with nothing cut mid-table.
5. Read the voiceover column aloud, timed. Past 2:05, cut 0:12 to 0:20.

**Then**

6. Clean the machine, phase 1. Every item there has ended somebody's take.
7. Set up OBS, phase 2. Once, forever.
8. Shoot the ten silent clips, two takes each, phase 3.
9. Assemble the picture, cut every wait, phase 4.
10. Voiceover onto the locked picture, one line per take, phase 5.
11. Auto-caption, then proofread every number, phase 6.
12. Export, watch muted, watch at 1.5x, watch on the phone, phase 7.
13. Native upload to LinkedIn with the one-pager, phase 8.

**If a number on screen disagrees with the script**, the script is wrong and
the product is right. Fix the script. That rule is the whole reason phase 0
exists.

Video B in `VIDEO_SCRIPTS.md` reuses phases 1 through 3 wholesale. Shoot both
sets of clips in the same session while the machine is already clean.
