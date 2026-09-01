#!/usr/bin/env node
// Capture a real extraction of the Granite Ridge set and write it as a
// fixture, so demo mode can run the full merge and conflict UI without an
// API key, an account, or a single token spent.
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..');
const { extractDealSheetSet } = require(path.join(REPO, 'server-lib', 'extract.js'));

const DIR = path.join(REPO, 'test-deal-sheets', 'equipment', 'granite-ridge-multidoc');
const OUT = path.join(REPO, 'src', 'data', 'demoExtraction.json');
const MEDIA = { '.pdf': 'application/pdf', '.txt': 'text/plain' };

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

  fs.writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n', 'utf-8');
  console.log('wrote', OUT);
  console.log('documents:', documents.length);
  for (const d of documents) {
    console.log(`  ${d.fileName.padEnd(30)} ${d.documentType.padEnd(22)} ${d.found.length} fields`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
