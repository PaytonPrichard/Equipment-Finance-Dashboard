#!/usr/bin/env node
// ============================================================
// Run every fixture through Tranche's scoring and write a dated report.
//
//   npm run real-deals
//
// Scoring is the real module code, bundled with esbuild exactly as the
// server bundle is. SOFR is the module default, as on the server, so a
// rerun on the same fixtures gives the same answer.
//
// A case without a written expectation is not scored. The expectation
// has to exist before the result does, or the comparison means nothing.
// ============================================================

const fs = require('fs');
const path = require('path');
const { derive } = require('./lib/derive');

const ROOT = __dirname;
const BUNDLE = path.join(ROOT, '.build', 'scoring.cjs');

function buildBundle() {
  require('esbuild').buildSync({
    entryPoints: [path.join(ROOT, 'entry.js')],
    bundle: true,
    platform: 'node',
    target: 'node20',
    format: 'cjs',
    outfile: BUNDLE,
    logLevel: 'error',
  });
  return require(BUNDLE);
}

const money = (n) =>
  n == null ? 'n/a' : `${n < 0 ? '-' : ''}$${(Math.abs(n) / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })}M`;
const x = (n, d = 2) => (n == null || !Number.isFinite(n) ? 'n/a' : `${n.toFixed(d)}x`);
const MONEY_FIELDS = new Set(['annualRevenue', 'ebitda', 'totalExistingDebt', 'actualAnnualDebtService', 'equipmentCost', 'downPayment', 'maintenanceCapex']);
const fmtField = (k, v) => (v == null ? 'n/a' : MONEY_FIELDS.has(k) ? money(v) : String(v));

function runCase(fx, S) {
  const { inputs, derivations, blockers } = derive(fx);
  if (!fx.expected || !fx.expected.verdict) {
    blockers.unshift('No expected verdict written. Write it before running.');
  }
  if (blockers.length) return { fx, inputs, derivations, blockers };

  const ef = S.equipmentFinance;
  const metrics = ef.calculateMetrics(inputs, S.DEFAULT_SOFR);
  const risk = ef.calculateRiskScore(inputs, metrics);
  const factors = ef.describeFactors(inputs, metrics, risk);
  const screening = S.evaluateScreening(S.DEFAULT_CRITERIA, metrics, risk, inputs, 'equipment_finance');
  const stress = ef.runStressTest(inputs, S.DEFAULT_SOFR);

  const warnings = [];
  if (metrics.debtServiceEstimated) {
    warnings.push('Existing debt service is estimated at 8% of total debt. No actual figure was supplied.');
  }
  if (inputs.maintenanceCapex == null) {
    warnings.push('Stress-test FCCR uses 3% of revenue as maintenance capex. runStressTest imputes it silently.');
  }
  if (!(inputs.ebitda > 0)) {
    warnings.push('EBITDA is zero or negative. Leverage reads 0.0x and scores as best-in-class, and the DSCR gate is skipped. Known defect, see CHANGELOG_BUILD.md backlog.');
  }

  const actual = screening.verdict;
  const expected = String(fx.expected.verdict).toLowerCase();
  return { fx, inputs, derivations, blockers, metrics, risk, factors, screening, stress, warnings, actual, expected, match: actual === expected };
}

function citeLine(key, fig) {
  if (fig.manual) {
    const m = fig.manual;
    return `| ${key} | ${money(m.value)} | manual: ${m.cite || 'NO CITATION'}${m.readBy ? ` (read by ${m.readBy})` : ''} |`;
  }
  if (!fig.sources) return `| ${key} | n/a | not fetched yet |`;
  const parts = fig.sources.map((s) => `${s.tag} = ${money(s.val)}, ${s.form} filed ${s.filed}, [${s.accn}](${s.url})`);
  if (fig.missing) parts.push(`NOT FOUND: ${fig.missing.join(', ')}`);
  return `| ${key} | ${money(fig.value)} | ${parts.join('<br>')} |`;
}

function caseSection(r) {
  const { fx } = r;
  const out = [];
  out.push(`## ${fx.borrower.name} (${fx.case})`);
  out.push('');
  out.push(`CIK ${fx.borrower.cik}. Fiscal year ending ${fx.period.fiscalYearEnd}. Figures fetched ${fx.period.fetchedAt || 'never'}.`);
  if (fx.context) out.push('', fx.context);
  out.push('', '### Sourced figures', '', '| Figure | Value | Source |', '|---|---|---|');
  for (const [k, fig] of Object.entries(fx.figures)) out.push(citeLine(k, fig));
  const notes = Object.entries(fx.figures).filter(([, f]) => f.note);
  if (notes.length) {
    out.push('');
    for (const [k, f] of notes) out.push(`- **${k}:** ${f.note}`);
  }

  out.push('', "### Deal terms (Joel's assumptions, not from the filing)", '', '| Input | Value | Why |', '|---|---|---|');
  for (const [k, a] of Object.entries(fx.assumptions || {})) {
    out.push(`| ${k} | ${fmtField(k, a?.value)} | ${a?.why || ''} |`);
  }

  out.push('', '### Derived Tranche inputs', '', '| Input | Value | Formula |', '|---|---|---|');
  for (const d of r.derivations) out.push(`| ${d.field} | ${fmtField(d.field, d.value)} | ${d.formula} |`);

  out.push('', `### Joel's expectation (written ${fx.expected?.writtenOn || 'n/a'})`, '');
  out.push(fx.expected?.verdict ? `**${String(fx.expected.verdict).toUpperCase()}**. ${fx.expected.reason || ''}` : 'Not written yet.');

  if (r.blockers.length) {
    out.push('', '### BLOCKED, not scored', '');
    for (const b of r.blockers) out.push(`- ${b}`);
    return out.join('\n');
  }

  const m = r.metrics;
  out.push('', '### Tranche output', '');
  out.push(`**${r.actual.toUpperCase()}**, composite score ${r.risk.composite}. ${r.match ? 'Matches' : '**Does not match**'} the expectation.`);
  out.push('', `Rate ${(m.rate * 100).toFixed(2)}% all-in. DSCR ${x(m.dscr)}. Leverage ${x(m.leverage, 1)}. LTV ${(m.ltv * 100).toFixed(0)}%. Term coverage ${m.termCoverage.toFixed(0)}%. Revenue concentration ${m.revenueConcentration.toFixed(1)}%. EBITDA margin ${m.ebitdaMargin.toFixed(1)}%.`);
  out.push('', '| Factor | Weight | Score | Reading | Target | Met |', '|---|---|---|---|---|---|');
  for (const f of r.factors) {
    out.push(`| ${f.label} | ${(f.weight * 100).toFixed(0)}% | ${Math.round(f.score)} | ${f.caption} | ${f.target} | ${f.passed ? 'yes' : 'no'} |`);
  }
  out.push('', '**Verdict reasons**', '');
  if (r.screening.reasons.length) for (const re of r.screening.reasons) out.push(`- ${re.level.toUpperCase()}: ${re.text}`);
  else out.push('- None. Every gate cleared.');

  out.push('', '**EBITDA stress**', '', '| Scenario | EBITDA | DSCR | Leverage | FCCR | Score |', '|---|---|---|---|---|---|');
  for (const s of r.stress) out.push(`| ${s.label} | ${money(s.ebitda)} | ${x(s.dscr)} | ${x(s.leverage, 1)} | ${x(s.fccr)} | ${s.score} |`);

  if (r.warnings.length) {
    out.push('', '**Fallbacks and caveats that fired**', '');
    for (const w of r.warnings) out.push(`- ${w}`);
  }

  out.push('', '### Discussion', '', fx.discussion || (r.match ? '_Match. Note anything surprising in the factor table._' : '_Mismatch. Decide with Joel: is the model wrong, or the expectation? Record the answer in the fixture `discussion` field._'));
  return out.join('\n');
}

function main() {
  const S = buildBundle();
  const dir = path.join(ROOT, 'fixtures');
  const fixtures = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));

  const results = fixtures.map((fx) => runCase(fx, S));
  const today = new Date().toISOString().slice(0, 10);

  const lines = [`# Real-deals run, ${today}`, ''];
  lines.push(`Module: equipment finance. SOFR ${(S.DEFAULT_SOFR * 100).toFixed(2)}% (module default, same as the server). Criteria: DEFAULT_CRITERIA.`, '');
  lines.push('| Case | Expected | Tranche | Score | Result |', '|---|---|---|---|---|');
  for (const r of results) {
    const exp = r.fx.expected?.verdict ? String(r.fx.expected.verdict).toUpperCase() : 'n/a';
    if (r.blockers.length) lines.push(`| ${r.fx.borrower.name} | ${exp} | n/a | n/a | BLOCKED (${r.blockers.length}) |`);
    else lines.push(`| ${r.fx.borrower.name} | ${exp} | ${r.actual.toUpperCase()} | ${r.risk.composite} | ${r.match ? 'match' : 'MISMATCH'} |`);
  }
  lines.push('');
  for (const r of results) lines.push(caseSection(r), '');

  const reportDir = path.join(ROOT, 'reports');
  fs.mkdirSync(reportDir, { recursive: true });
  const outFile = path.join(reportDir, `${today}.md`);
  fs.writeFileSync(outFile, lines.join('\n'));

  const scored = results.filter((r) => !r.blockers.length);
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
  console.log(`${scored.length} scored, ${scored.filter((r) => r.match).length} matched, ${results.length - scored.length} blocked.`);
}

main();
