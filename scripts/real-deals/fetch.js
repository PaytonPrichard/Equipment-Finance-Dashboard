#!/usr/bin/env node
// ============================================================
// Fill every XBRL-sourced figure in the fixtures from EDGAR.
//
//   node scripts/real-deals/fetch.js            all fixtures
//   node scripts/real-deals/fetch.js dxp-fy2025 one fixture
//
// A figure with `tags` is fetched: each tag's annual value is looked
// up for the fixture's fiscal year end, summed, and stored with its
// accession number and filing URL. A figure with `manual` is never
// touched; a person read it from the filing and cited the page.
// A tag that is not found leaves the figure null. Nothing is guessed.
// ============================================================

const fs = require('fs');
const path = require('path');
const { fetchCompanyFacts, pickAnnualFact, companyFactsUrl } = require('./lib/edgar');

const FIXTURE_DIR = path.join(__dirname, 'fixtures');

function listFixtures(only) {
  return fs
    .readdirSync(FIXTURE_DIR)
    .filter((f) => f.endsWith('.json'))
    .filter((f) => !only || f === `${only}.json`)
    .map((f) => path.join(FIXTURE_DIR, f));
}

async function fillFixture(file) {
  const fx = JSON.parse(fs.readFileSync(file, 'utf8'));
  const { cik } = fx.borrower;
  const fye = fx.period.fiscalYearEnd;
  const facts = await fetchCompanyFacts(cik);
  const log = [];

  for (const [key, fig] of Object.entries(fx.figures)) {
    if (fig.manual || !Array.isArray(fig.tags)) continue;
    const sources = fig.tags.map((t) => pickAnnualFact(facts, t, fye, cik));
    const missing = fig.tags.filter((_, i) => !sources[i]);
    if (missing.length) {
      fig.value = null;
      fig.sources = sources.filter(Boolean);
      fig.missing = missing;
      log.push(`  ${key}: NOT FOUND ${missing.join(', ')}`);
      continue;
    }
    delete fig.missing;
    fig.sources = sources;
    fig.value = sources.reduce((s, x) => s + x.val, 0);
    log.push(`  ${key}: ${fig.value.toLocaleString('en-US')}`);
  }

  fx.period.companyFactsUrl = companyFactsUrl(cik);
  fx.period.fetchedAt = new Date().toISOString().slice(0, 10);
  fs.writeFileSync(file, JSON.stringify(fx, null, 2) + '\n');
  console.log(`${path.basename(file)} (${fx.borrower.name}, FYE ${fye})\n${log.join('\n')}`);
}

(async () => {
  const files = listFixtures(process.argv[2]);
  if (!files.length) {
    console.error('No matching fixtures.');
    process.exit(1);
  }
  for (const f of files) await fillFixture(f);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
