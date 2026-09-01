#!/usr/bin/env node
// ============================================================
// Grade extraction against the sample corpus answer key.
//
//   node scripts/score-extraction.js                 # every scenario
//   node scripts/score-extraction.js granite-ridge   # one, by name prefix
//
// Reads test-deal-sheets/EXPECTED.json, runs each document through the
// real extraction path in server-lib/extract.js, and reports per field:
//
//   correct  extracted and matches the answer key
//   WRONG    extracted but disagrees with the answer key
//   missed   not extracted at all
//
// Wrong is much worse than missed. A blank field is a prompt to the
// analyst; a wrong field is a number that flows into the memo unnoticed.
// The extraction layer already takes that position (server-lib/extract.js:
// "a wrong prefilled value is worse than a blank one"), so the summary
// scores them separately rather than rolling them into one accuracy number.
//
// This calls the live Anthropic API and costs real tokens (roughly one
// Sonnet call per document). It is a manual script, not part of CI.
// Requires ANTHROPIC_API_KEY.
// ============================================================

const fs = require('fs');
const path = require('path');

const { extractDealSheet } = require('../server-lib/extract');

const ROOT = path.join(__dirname, '..', 'test-deal-sheets');
const EXPECTED_PATH = path.join(ROOT, 'EXPECTED.json');

const MEDIA_TYPES = {
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.txt': 'text/plain',
  '.csv': 'text/csv',
};

// Currency and count fields carry rounding noise from prose ("just over 38MM").
// A 1% band treats those as agreement; anything wider is a real disagreement.
const NUMERIC_TOLERANCE = 0.01;

function valuesAgree(actual, expected) {
  if (typeof expected === 'number' && typeof actual === 'number') {
    if (expected === 0) return actual === 0;
    return Math.abs(actual - expected) / Math.abs(expected) <= NUMERIC_TOLERANCE;
  }
  if (typeof expected === 'boolean') return actual === expected;
  if (typeof expected === 'string' && typeof actual === 'string') {
    return actual.trim().toLowerCase() === expected.trim().toLowerCase();
  }
  return actual === expected;
}

function fmt(v) {
  if (v === undefined) return '—';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  return String(v);
}

const C = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
};

async function extractOne(absPath, moduleKey) {
  const ext = path.extname(absPath).toLowerCase();
  const mediaType = MEDIA_TYPES[ext];
  if (!mediaType) return { error: `no media type mapped for ${ext}` };
  const fileBase64 = fs.readFileSync(absPath).toString('base64');
  return extractDealSheet({ moduleKey, mediaType, fileBase64 });
}

// Union of every document's extraction, first writer wins, with every
// document that stated a field recorded so disagreements are visible.
// This is a diagnostic view, not the product merge: it deliberately does
// no precedence, so the report shows what each document actually said.
function unionByField(perDoc) {
  const byField = {};
  for (const doc of perDoc) {
    if (doc.error || !doc.inputs) continue;
    for (const [field, value] of Object.entries(doc.inputs)) {
      if (!byField[field]) byField[field] = [];
      byField[field].push({ file: doc.file, value });
    }
  }
  return byField;
}

async function runScenario(scenario) {
  const dir = path.join(ROOT, ...scenario.dir.split('/'));
  console.log('\n' + C.bold(scenario.scenario) + C.dim(`  (${scenario.moduleKey})`));
  console.log(C.dim('  ' + scenario.description));

  const perDoc = [];
  for (const docSpec of scenario.documents) {
    const abs = path.join(dir, docSpec.file);
    if (!fs.existsSync(abs)) {
      console.log(C.red(`  ! missing ${docSpec.file} — run scripts/generate-sample-docs.js`));
      perDoc.push({ file: docSpec.file, error: 'file missing' });
      continue;
    }
    process.stdout.write(C.dim(`  reading ${docSpec.file} ... `));
    const result = await extractOne(abs, scenario.moduleKey);
    if (result.error) {
      console.log(C.red(result.error));
      perDoc.push({ file: docSpec.file, error: result.error });
      continue;
    }
    console.log(C.dim(`${result.found.length} fields`));
    perDoc.push({ file: docSpec.file, ...result });
  }

  // ---- Grade the union against the answer key ----
  const byField = unionByField(perDoc);
  const rows = [];
  let correct = 0;
  let wrong = 0;
  let missed = 0;

  for (const [field, expected] of Object.entries(scenario.truth)) {
    const stated = byField[field] || [];
    if (stated.length === 0) {
      missed += 1;
      rows.push({ field, verdict: 'missed', expected, got: undefined, sources: [] });
      continue;
    }
    const agreeing = stated.filter((s) => valuesAgree(s.value, expected));
    if (agreeing.length > 0) {
      correct += 1;
      rows.push({
        field,
        verdict: stated.length > agreeing.length ? 'correct-with-conflict' : 'correct',
        expected,
        got: agreeing[0].value,
        sources: stated,
      });
    } else {
      wrong += 1;
      rows.push({ field, verdict: 'wrong', expected, got: stated[0].value, sources: stated });
    }
  }

  // ---- Fields that should have stayed blank ----
  const falsePositives = [];
  for (const field of scenario.expectedAbsent || []) {
    if (byField[field]) {
      falsePositives.push({ field, stated: byField[field] });
    }
  }

  // ---- Report ----
  const width = Math.max(...rows.map((r) => r.field.length), 12);
  console.log('');
  for (const r of rows) {
    const name = r.field.padEnd(width);
    if (r.verdict === 'correct') {
      console.log(`  ${C.green('ok  ')} ${name}  ${fmt(r.got)}`);
    } else if (r.verdict === 'correct-with-conflict') {
      const others = r.sources
        .filter((s) => !valuesAgree(s.value, r.expected))
        .map((s) => `${fmt(s.value)} in ${s.file}`)
        .join('; ');
      console.log(
        `  ${C.green('ok  ')} ${name}  ${fmt(r.got)}  ${C.yellow(`[also stated: ${others}]`)}`,
      );
    } else if (r.verdict === 'wrong') {
      const where = r.sources.map((s) => `${fmt(s.value)} in ${s.file}`).join('; ');
      console.log(`  ${C.red('WRONG')} ${name}  expected ${fmt(r.expected)}, got ${where}`);
    } else {
      console.log(`  ${C.dim('miss')} ${C.dim(name)}  ${C.dim('expected ' + fmt(r.expected))}`);
    }
  }

  if (falsePositives.length) {
    console.log('');
    for (const fp of falsePositives) {
      const where = fp.stated.map((s) => `${fmt(s.value)} in ${s.file}`).join('; ');
      console.log(
        `  ${C.red('INVENTED')} ${fp.field} — no document states this, extraction returned ${where}`,
      );
    }
  }

  const total = rows.length;
  console.log('');
  console.log(
    `  ${C.bold('Result')}  ${correct}/${total} correct, ` +
      `${wrong ? C.red(`${wrong} wrong`) : '0 wrong'}, ${missed} missed` +
      (falsePositives.length ? `, ${C.red(`${falsePositives.length} invented`)}` : ''),
  );

  return { scenario: scenario.scenario, correct, wrong, missed, total, invented: falsePositives.length };
}

async function main() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is not set.');
    process.exit(1);
  }
  if (!fs.existsSync(EXPECTED_PATH)) {
    console.error('No EXPECTED.json. Run: node scripts/generate-sample-docs.js');
    process.exit(1);
  }

  const key = JSON.parse(fs.readFileSync(EXPECTED_PATH, 'utf-8'));
  const filter = process.argv[2];
  const scenarios = key.scenarios.filter((s) => !filter || s.scenario.startsWith(filter));

  if (!scenarios.length) {
    console.error(`No scenario matches "${filter}".`);
    process.exit(1);
  }

  console.log(C.dim(`Model: ${process.env.ANTHROPIC_MODEL || 'claude-sonnet-5'} (one call per document)`));

  const results = [];
  for (const scenario of scenarios) {
    results.push(await runScenario(scenario));
  }

  if (results.length > 1) {
    console.log('\n' + C.bold('Summary'));
    for (const r of results) {
      console.log(
        `  ${r.scenario.padEnd(28)} ${r.correct}/${r.total} correct, ${r.wrong} wrong, ${r.missed} missed`,
      );
    }
  }

  // Wrong or invented values are the failure condition. Missed is a gap, not a defect.
  const bad = results.reduce((n, r) => n + r.wrong + r.invented, 0);
  process.exit(bad > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
