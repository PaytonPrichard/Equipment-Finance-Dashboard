#!/usr/bin/env node
// Capture a real extraction of the Granite Ridge set and write it as a
// fixture, so demo mode can run the full merge and conflict UI without an
// API key, an account, or a single token spent.
//
//   node scripts/capture-demo-extraction.js          # re-capture, overwrites the fixture
//   node scripts/capture-demo-extraction.js --check  # compare only, writes nothing
//
// --check is the pre-shoot question: does a live extraction still produce
// what the fixture says it produces? Demo mode replays the fixture, so the
// figures in VIDEO_SCRIPTS.md are guaranteed there and locked by
// src/data/demoExtraction.test.js. Recording signed in runs a real
// extraction instead, and nothing guarantees the model reads the same
// numbers out of the same four files months later. The conflict block is the
// whole video, so run --check the day before a shoot. If it passes, record
// signed in. If it drifts, you found out with a day to spare.
//
// Costs one extraction call either way.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const { extractDealSheetSet } = require(path.join(REPO, 'server-lib', 'extract.js'));

const DIR = path.join(REPO, 'test-deal-sheets', 'equipment', 'granite-ridge-multidoc');
const OUT = path.join(REPO, 'src', 'data', 'demoExtraction.json');
const MEDIA = { '.pdf': 'application/pdf', '.txt': 'text/plain' };

const CHECK_ONLY = process.argv.includes('--check');

// What the video depends on: which document each field was read from, and
// what value it carried. Warnings and the model's free-text notes are prose
// that can move without changing a single figure on screen, so they are not
// compared.
function comparable(documents) {
  return documents.map((d) => ({
    fileName: d.fileName,
    documentType: d.documentType,
    inputs: d.inputs || {},
  }));
}

function diff(fixture, fresh) {
  const problems = [];
  const byName = (list) => Object.fromEntries(list.map((d) => [d.fileName, d]));
  const was = byName(fixture);
  const now = byName(fresh);

  for (const name of Object.keys(was)) {
    if (!now[name]) { problems.push(`${name}: missing from the fresh extraction`); continue; }
    if (was[name].documentType !== now[name].documentType) {
      problems.push(`${name}: classified ${now[name].documentType}, fixture says ${was[name].documentType}`);
    }
    const fields = new Set([...Object.keys(was[name].inputs), ...Object.keys(now[name].inputs)]);
    for (const f of fields) {
      const a = JSON.stringify(was[name].inputs[f]);
      const b = JSON.stringify(now[name].inputs[f]);
      if (a !== b) problems.push(`${name}.${f}: fixture ${a}, fresh ${b}`);
    }
  }
  for (const name of Object.keys(now)) {
    if (!was[name]) problems.push(`${name}: in the fresh extraction, absent from the fixture`);
  }
  return problems;
}

(async () => {
  const files = fs.readdirSync(DIR).sort().map((name) => ({
    name,
    media_type: MEDIA[path.extname(name).toLowerCase()],
    data: fs.readFileSync(path.join(DIR, name)).toString('base64'),
  }));

  const { documents, error } = await extractDealSheetSet({
    moduleKey: 'equipment_finance',
    files,
  });
  if (error) throw new Error(error);

  const payload = {
    _comment:
      'Real output of server-lib/extract.js against test-deal-sheets/equipment/granite-ridge-multidoc, ' +
      'captured so demo mode can exercise the real merge and conflict UI with no API key and no cost. ' +
      'Regenerate by re-running the capture script if the extraction spec changes. ' +
      'The borrower is fictional.',
    capturedAt: new Date().toISOString().slice(0, 10),
    assetClass: 'equipment_finance',
    scenario: 'granite-ridge-multidoc',
    documents,
  };

  if (CHECK_ONLY) {
    const fixture = JSON.parse(fs.readFileSync(OUT, 'utf-8'));
    const problems = diff(comparable(fixture.documents), comparable(documents));
    console.log(`fixture captured ${fixture.capturedAt}, compared against a live extraction just now`);
    if (problems.length === 0) {
      console.log('MATCH. Every document type and every field agrees.');
      console.log('Safe to record signed in. Nothing written.');
      return;
    }
    console.log(`DRIFT. ${problems.length} difference${problems.length === 1 ? '' : 's'}:`);
    for (const p of problems) console.log(`  ${p}`);
    console.log('');
    console.log('Nothing written. Either re-run without --check to adopt the fresh');
    console.log('extraction, then run the tests, which will name any video beat that');
    console.log('moved. Or record in demo mode, which replays the fixture.');
    process.exitCode = 1;
    return;
  }

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log('wrote', OUT);
  console.log('documents:', documents.length);
  for (const d of documents) {
    console.log(`  ${d.fileName.padEnd(30)} ${d.documentType.padEnd(22)} ${d.found.length} fields`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
