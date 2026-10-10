// Resale-value benchmarks: collateral value vs loan balance over time.
// Every curve below is copied from a cited source. The loan schedule is
// arithmetic on Tranche's own structure (fully amortizing EFA). The interest
// rate is an illustrative assumption, labeled as such in the output.
//
// Run: node scripts/real-deals/benchmarks/resale-analysis.js
// Results are written up in resale-2026-10.md.

// ISU Ag Decision Maker A3-29 (PM 710, rev. March 2026), p. 2, Tables 1a/1b.
// "Remaining salvage value as percent of new list price", ages 1-20.
// Built from published auction values: average as-is value at the farm.
const ISU = {
  'Tractor 150+ hp, 400 hrs/yr': [67, 59, 54, 49, 45, 42, 39, 36, 34, 32, 30, 28, 26, 24, 23, 21, 20, 19, 18, 17],
  'Tractor 80-149 hp, 400 hrs/yr': [68, 62, 57, 53, 49, 46, 44, 41, 39, 37, 35, 34, 32, 31, 29, 28, 27, 25, 24, 23],
  'Combine, 300 hrs/yr': [69, 58, 50, 44, 39, 35, 31, 28, 25, 23, 20, 18, 16, 14, 13, 11, 10, 9, 8, 7],
  'Planter, drill, sprayer': [65, 60, 56, 53, 50, 48, 46, 44, 42, 40, 39, 38, 36, 35, 34, 33, 32, 30, 29, 29],
};

// BEA Depreciation Estimates, https://apps.bea.gov/national/pdf/BEA_depreciation_rates.pdf
// Geometric rate per year; value after t years = (1 - rate)^t.
// All four are Hulten-Wykoff type A (rates estimated from used-asset prices).
// BEA footnote 2: the profile is for a whole cohort including retirements, so
// it is more convex (faster early decline) than a single surviving asset.
const BEA = {
  'Construction machinery, except tractors (BEA, 10-yr life)': { rate: 0.1550, life: 10 }, // PDF p.10
  'Construction tractors (BEA, 8-yr life)': { rate: 0.1633, life: 8 },                     // PDF p.10
  'Trucks, trucking and other services (BEA, 10-yr life)': { rate: 0.1725, life: 10 },     // PDF p.9
  'Farm tractors (BEA, 9-yr life)': { rate: 0.1452, life: 9 },                             // PDF p.10
};

// Illustrative loan rate. Not sourced. Balance paths move little with rate.
const RATE = 0.08;

function balancePct(financedPct, termMonths, month) {
  if (month >= termMonths) return 0;
  const r = RATE / 12;
  const pmt = (financedPct * r) / (1 - Math.pow(1 + r, -termMonths));
  return financedPct * Math.pow(1 + r, month) - (pmt * (Math.pow(1 + r, month) - 1)) / r;
}

function isuValue(curve, years, priceVsList) {
  // ISU is % of list. A buyer who paid priceVsList of list holds collateral
  // worth curve/priceVsList of what they paid.
  return years === 0 ? 100 : curve[years - 1] / priceVsList;
}

function beaValue(rate, years) {
  return 100 * Math.pow(1 - rate, years);
}

// Worst year-end gap (loan balance minus collateral value, % of cost).
function worstGap(valueAt, financedPct, termMonths) {
  let worst = { gap: -Infinity, year: 0 };
  for (let y = 1; y <= Math.ceil(termMonths / 12); y++) {
    const gap = balancePct(financedPct, termMonths, y * 12) - valueAt(y);
    if (gap > worst.gap) worst = { gap, year: y };
  }
  return worst;
}

const fmt = (n) => `${n >= 0 ? '+' : ''}${n.toFixed(0)}`;
const lines = [];
const out = (s = '') => lines.push(s);

out(`Loan rate ${(RATE * 100).toFixed(0)}% (illustrative). Fully amortizing, monthly.`);
out('Gap = loan balance minus collateral value, % of cost, worst year-end in the term. Positive = underwater.');
out();

out('## Year-1 value, % of new');
for (const [k, c] of Object.entries(ISU)) out(`${k}: ${c[0]}% of list (ISU, auction as-is)`);
for (const [k, b] of Object.entries(BEA)) out(`${k}: ${beaValue(b.rate, 1).toFixed(1)}% (BEA geometric)`);
out();

const terms = [36, 48, 60, 72, 84];
for (const downPct of [10, 15, 20]) {
  const financed = 100 - downPct;
  out(`## ${downPct}% down (${financed}% financed). Worst gap by term, % of cost [year]`);
  out(`| Curve | ${terms.map((t) => `${t} mo`).join(' | ')} |`);
  out(`|---|${terms.map(() => '---').join('|')}|`);
  for (const [k, c] of Object.entries(ISU)) {
    for (const [label, p] of [['paid list', 1], ['paid 12.5% under list', 0.875]]) {
      const cells = terms.map((t) => {
        const w = worstGap((y) => isuValue(c, y, p), financed, t);
        return `${fmt(w.gap)} [y${w.year}]`;
      });
      out(`| ${k}, ${label} | ${cells.join(' | ')} |`);
    }
  }
  for (const [k, b] of Object.entries(BEA)) {
    const cells = terms.map((t) => {
      const w = worstGap((y) => beaValue(b.rate, y), financed, t);
      return `${fmt(w.gap)} [y${w.year}]`;
    });
    out(`| ${k} | ${cells.join(' | ')} |`);
  }
  out();
}

out('## Term coverage (term / BEA life) for the same terms');
for (const [k, b] of Object.entries(BEA)) {
  out(`${k}: ${terms.map((t) => `${t} mo = ${((t / 12 / b.life) * 100).toFixed(0)}%`).join(', ')}`);
}
out();

out('## Value at 80% of BEA life, % of new (BEA geometric)');
for (const [k, b] of Object.entries(BEA)) {
  out(`${k}: ${(0.8 * b.life).toFixed(1)} yrs -> ${beaValue(b.rate, 0.8 * b.life).toFixed(0)}%`);
}

console.log(lines.join('\n'));
