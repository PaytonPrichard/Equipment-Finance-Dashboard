#!/usr/bin/env node
// ============================================================
// Analyst sheets: the sourced figures an analyst would look at before
// forming a view, with no Tranche output on them.
//
//   npm run real-deals:sheet
//
// Read these, write the expected verdict, commit, then run. The sheet
// deliberately never loads the scoring code, so it cannot leak a score.
// Ratios here are plain arithmetic on the cited figures, before the new
// loan. They are not Tranche's metrics.
// ============================================================

const fs = require('fs');
const path = require('path');
const { derive, figureValue } = require('./lib/derive');
const { fetchCompanyFacts, pickAnnualFact } = require('./lib/edgar');
const { liquidityRunway, maturityWall, money } = require('./lib/analystView');

const ROOT = __dirname;
// Companies tag the same line differently. First tag with a value wins.
const PRETAX_TAGS = [
  'us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest',
  'us-gaap:IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments',
];
const REVENUE_TAGS = ['us-gaap:Revenues', 'us-gaap:RevenueFromContractWithCustomerExcludingAssessedTax', 'us-gaap:SalesRevenueNet'];
// Companies tag cash differently. First match wins.
const CASH_TAGS = ['us-gaap:CashAndCashEquivalentsAtCarryingValue', 'us-gaap:Cash'];

const ratio = (num, den) => (num == null || den == null || den <= 0 ? null : num / den);
const xx = (r, d = 2) => (r == null ? 'n/a' : `${r.toFixed(d)}x`);
const pct = (r) => (r == null ? 'n/a' : `${(r * 100).toFixed(1)}%`);

function priorYearEnd(fye) {
  const d = new Date(fye + 'T00:00:00Z');
  d.setUTCFullYear(d.getUTCFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

async function sheetFor(fx) {
  const facts = await fetchCompanyFacts(fx.borrower.cik);
  const fye = fx.period.fiscalYearEnd;
  const pfye = priorYearEnd(fye);
  const cik = fx.borrower.cik;
  const pick = (tag, end) => pickAnnualFact(facts, tag, end, cik);
  const first = (tags, end) => tags.map((t) => pick(t, end)).find(Boolean) || null;
  const revPrior = first([...(fx.figures.revenue.tags || []), ...REVENUE_TAGS], pfye);
  const pretax = first(PRETAX_TAGS, fye);
  const pretaxPrior = first(PRETAX_TAGS, pfye);
  const cash = CASH_TAGS.map((t) => pick(t, fye)).find(Boolean);

  const { inputs, caveats } = derive(fx);
  const fig = (k) => figureValue(fx.figures[k]);
  const rev = inputs.annualRevenue;
  const ebitda = inputs.ebitda;
  const debt = inputs.totalExistingDebt;
  const ds = inputs.actualAnnualDebtService ?? null;
  const interest = fig('interestPaid') ?? fig('otherInterest');
  const capex = inputs.maintenanceCapex ?? null;
  const a = fx.assumptions;
  const dealNet = (a.equipmentCost?.value ?? 0) - (a.downPayment?.value ?? 0);

  const out = [];
  out.push(`## ${fx.borrower.name} (${fx.borrower.ticker}), FY ending ${fye}`, '');
  if (fx.context) out.push(fx.context, '');
  out.push('| | Value | Note |', '|---|---|---|');
  out.push(`| Revenue | ${money(rev)} | Prior year ${money(revPrior?.val)}, change ${pct(revPrior ? rev / revPrior.val - 1 : null)} |`);
  out.push(`| Pre-tax income | ${money(pretax?.val)} | Prior year ${money(pretaxPrior?.val)} |`);
  out.push(`| EBITDA (built) | ${money(ebitda)} | Margin ${pct(ratio(ebitda, rev))} |`);
  out.push(`| Debt | ${money(debt)} | ${fx.figures.totalDebt?.note || ''} |`);
  out.push(`| Debt / EBITDA | ${ebitda > 0 ? xx(ratio(debt, ebitda), 1) : 'NM (EBITDA not positive)'} | Before the new loan |`);
  out.push(`| Debt service (existing) | ${money(ds)} | Interest + principal due in 12 months |`);
  out.push(`| EBITDA / debt service | ${ebitda > 0 ? xx(ratio(ebitda, ds)) : 'negative'} | Before the new loan |`);
  out.push(`| EBITDA / interest | ${ebitda > 0 ? xx(ratio(ebitda, interest)) : 'negative'} | |`);
  out.push(`| (EBITDA - maintenance capex) / debt service | ${ebitda > 0 && capex != null ? xx(ratio(ebitda - capex, ds)) : 'n/a'} | Capex is an estimate, see caveats |`);
  out.push(`| Cash | ${money(cash?.val)} | Balance sheet, year end${cash ? `, ${cash.tag}` : ''} |`);
  out.push(`| Proposed deal | ${money(a.equipmentCost?.value)} ${a.equipmentType?.value || ''}, ${money(dealNet)} financed over ${a.loanTerm?.value} months | ${pct(ratio(a.equipmentCost?.value, rev))} of revenue${ebitda > 0 ? `, ${xx(ratio(dealNet, ebitda), 2)} EBITDA` : ''} |`);
  out.push(`| Credit rating | ${a.creditRating?.value || 'pending (Joel)'} | |`);

  const availability = fig('availableLiquidity');
  const run = liquidityRunway({ cash: cash?.val ?? null, availability, ebitda, maintenanceCapex: capex, debtService: ds });
  out.push('', '**Liquidity runway** (before the new loan)', '');
  if (run) {
    out.push(`- Liquidity ${money(run.liquidity)}: cash ${money(cash.val)}${availability != null ? ` + undrawn facility ${money(availability)}` : ', undrawn availability not included'}.`);
    if (run.monthsOfDebtService != null) out.push(`- Covers ${run.monthsOfDebtService.toFixed(1)} months of existing debt service (${money(ds)} a year).`);
    if (run.cashAfterYear != null) out.push(`- After 12 months, if this year's cash flow repeats (EBITDA less estimated maintenance capex, before tax, ${money(run.cashFlow)}): ${money(run.cashAfterYear)}.`);
  } else out.push('- Cash not available.');

  const wall = maturityWall(fig);
  // Fiscal years are named for the calendar year they end in (Titan: Jan 2027 = FY2027).
  const fyYear = Number(fye.slice(0, 4));
  out.push('', '**Maturity wall** (principal due, by fiscal year)', '', `| ${wall.map((m) => `FY${fyYear + m.year}`).join(' | ')} |`, `|${wall.map(() => '---').join('|')}|`, `| ${wall.map((m) => money(m.amount)).join(' | ')} |`);
  const wallNote = [1, 2, 3, 4, 5].map((y) => fx.figures[`maturityY${y}`]?.note).find(Boolean);
  if (wallNote) out.push('', wallNote);
  if (caveats.length) {
    out.push('', '**Caveats**', '');
    for (const c of caveats) out.push(`- ${c}`);
  }
  const manual = Object.entries(fx.figures).filter(([, f]) => f.manual);
  if (manual.length) {
    out.push('', '**Manual reads to verify**', '', '| Figure | Value | Where |', '|---|---|---|');
    for (const [k, f] of manual) {
      const v = k === 'yearsInBusiness' ? `${f.manual.value} yrs` : money(f.manual.value);
      out.push(`| ${k} | ${v} | ${f.manual.cite} |`);
    }
  }
  out.push('', '**Your expectation** (write before running): verdict ____, reason ____', '');
  return out.join('\n');
}

(async () => {
  const dir = path.join(ROOT, 'fixtures');
  const fixtures = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
  const today = new Date().toLocaleDateString('en-CA');
  const parts = [`# Analyst sheets, ${today}`, '', 'Sourced figures only. No Tranche score. Ratios are before the proposed loan.', ''];
  for (const fx of fixtures) parts.push(await sheetFor(fx));
  const outDir = path.join(ROOT, 'sheets');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, `${today}.md`);
  fs.writeFileSync(outFile, parts.join('\n'));
  console.log(`Wrote ${path.relative(process.cwd(), outFile)}`);
})().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
