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

// Read .env.local the way the dev server does, so this script does not need
// the key exported into the shell first. Anything already in the environment
// wins, and nothing here is a dependency: it is six lines rather than a
// transitive dotenv.
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf-8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (!m) continue;
    if (process.env[m[1]] !== undefined) continue;
    process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
loadEnvFile(path.join(REPO, '.env.local'));
loadEnvFile(path.join(REPO, '.env'));

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('ANTHROPIC_API_KEY is not set.');
  console.error('');
  console.error('This script calls the real extraction, so it needs the key.');
  console.error('Add it to .env.local as a line reading:');
  console.error('');
  console.error('  ANTHROPIC_API_KEY=sk-ant-...');
  console.error('');
  console.error('.env.local is gitignored. See .env.example for the full list.');
  process.exit(1);
}
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

  // A failed call is not a drifted reading, and must never be reported as
  // one. extractDealSheetSet deliberately lets one bad document through
  // rather than failing the batch, so a request the API rejects comes back
  // as a document classified "other" with no fields. Diffed against the
  // fixture that reads as every field on every page having changed. Sending
  // a deprecated `temperature` produced exactly that: four rejected calls
  // and a confident report of 53 differences.
  const failed = documents.filter((d) => d.error || (d.found || []).length === 0);
  if (failed.length > 0) {
    console.error(`Extraction failed for ${failed.length} of ${documents.length} documents. This is not drift.`);
    console.error('');
    for (const d of failed) {
      console.error(`  ${d.fileName}: ${d.error || 'no fields returned'}`);
    }
    console.error('');
    console.error('Nothing written and nothing compared. Fix the call, then run this again.');
    process.exitCode = 1;
    return;
  }

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
