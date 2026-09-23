// Facilities, covenants and covenant tests shown in demo mode (?demo=1).
//
// The monitoring tab used to open on "No facilities yet" for everyone who
// clicked it, while the pitch, the demo script and Video B all say the
// screening assumptions carry forward into monitoring after a deal funds.
// The two funded deals on the demo board are now monitored facilities with a
// test history behind them.
//
// Everything here is computed from the real modules, the same way
// demoPipeline.js computes its scores: the underwritten snapshot comes from
// calculateMetrics, and the covenants come from getDefaultCovenants. So the
// covenant set a prospect sees is the set the product would actually seed,
// not a hand-written imitation of one.
//
// Reported values are the one thing invented here, because they stand in for
// financials a borrower would have sent in. They are chosen to show the two
// states worth seeing: a facility tracking its underwrite, and a facility
// that has drifted a long way from it.

import { getInitialDemoPipeline } from './demoPipeline';
import { getModule } from '../modules';
import { DEFAULT_CRITERIA } from '../lib/screeningCriteria';
import { evaluateCovenantTest } from '../lib/covenants';

const DEMO_ORG_ID = 'demo-org';
const DEMO_USER_ID = 'demo-user';
const SOFR_FALLBACK = 0.0425;

const DAY_MS = 86400000;

function isoDaysAgo(days) {
  return new Date(Date.now() - days * DAY_MS).toISOString();
}

function dateDaysAgo(days) {
  return isoDaysAgo(days).slice(0, 10);
}

function dateDaysAhead(days) {
  return new Date(Date.now() + days * DAY_MS).toISOString().slice(0, 10);
}

// ---- The two facilities, by the deal each was funded from ----
//
// `readings` are reported values keyed by covenant metric, oldest first, one
// entry per quarterly test. `filings` describe how the reporting covenants
// were met, so the reporting side of monitoring is exercised too.
const FACILITY_DEFS = [
  {
    dealName: 'Heartland Foods Manufacturing',
    fundedDaysAgo: 183,
    // Tracking the underwrite. Debt service is covered several times over and
    // the quarter-to-quarter movement is ordinary operating noise.
    readings: [
      { daysAgo: 176, dscr: 5.52, leverage: 2.11 },
      { daysAgo: 84, dscr: 5.37, leverage: 2.18 },
    ],
    filings: [
      { name: 'Quarterly financial statements', dueDaysAgo: 176, submittedDaysAgo: 178 },
      { name: 'Compliance certificate', dueDaysAgo: 176, submittedDaysAgo: 177 },
      { name: 'Quarterly financial statements', dueDaysAgo: 84, submittedDaysAgo: 86 },
      { name: 'Compliance certificate', dueDaysAgo: 84, submittedDaysAgo: 84 },
    ],
  },
  {
    dealName: 'Summit IT Solutions',
    fundedDaysAgo: 193,
    // Lost two of its largest managed-service contracts in the second
    // quarter. Coverage is still comfortably inside the 1.25x covenant, which
    // is the point: nothing here is in breach on the numbers, and the credit
    // has still moved a long way from what was underwritten. That gap is what
    // the drift view is for.
    readings: [
      { daysAgo: 186, dscr: 5.41, leverage: 1.63 },
      { daysAgo: 94, dscr: 2.38, leverage: 3.44 },
    ],
    // Reporting has slipped with the business. The certificate came in inside
    // its cure window last quarter, and this quarter's financials are past
    // due and still not in.
    filings: [
      { name: 'Quarterly financial statements', dueDaysAgo: 186, submittedDaysAgo: 187 },
      { name: 'Compliance certificate', dueDaysAgo: 186, submittedDaysAgo: 188 },
      { name: 'Quarterly financial statements', dueDaysAgo: 94, submittedDaysAgo: 91 },
      { name: 'Compliance certificate', dueDaysAgo: 94, submittedDaysAgo: 90 },
      { name: 'Quarterly financial statements', dueDaysAgo: 12, submittedDaysAgo: null },
    ],
  },
];

const NOTES = {
  'Minimum DSCR': {
    'Heartland Foods Manufacturing': [
      'Q1 statements reviewed. Coverage in line with the underwrite.',
      'Q2 statements reviewed. No change to the risk view.',
    ],
    'Summit IT Solutions': [
      'Q1 statements reviewed. Tracking the underwrite.',
      'Two managed-service contracts not renewed. Coverage still inside the covenant, but well below the underwritten case. Raised with the relationship team.',
    ],
  },
};

function buildFacility(def, deal, index) {
  const mod = getModule(deal.asset_class || 'equipment_finance');
  const metrics = mod.calculateMetrics(deal.inputs, SOFR_FALLBACK);
  const riskScore = mod.calculateRiskScore(deal.inputs, metrics);
  const createdAt = isoDaysAgo(def.fundedDaysAgo);

  const facility = {
    id: `demo-fac-${index + 1}`,
    org_id: DEMO_ORG_ID,
    pipeline_deal_id: deal.id,
    user_id: DEMO_USER_ID,
    borrower_name: deal.inputs.companyName || deal.name,
    asset_class: deal.asset_class || 'equipment_finance',
    commitment_amount: metrics.netFinanced ?? metrics.borrowingBase ?? null,
    status: 'active',
    funded_at: dateDaysAgo(def.fundedDaysAgo),
    maturity_date: null,
    // The same shape the setup screen writes, so the drift view reads it the
    // same way it reads a real one.
    underwritten_snapshot: {
      inputs: deal.inputs,
      metrics,
      score: riskScore.composite,
      criteria: DEFAULT_CRITERIA,
      captured_at: createdAt,
    },
    created_at: createdAt,
    updated_at: createdAt,
  };

  const seeds = mod.getDefaultCovenants(deal.inputs, metrics, DEFAULT_CRITERIA);
  const covenants = seeds.map((seed, i) => ({
    ...seed,
    id: `${facility.id}-cov-${i + 1}`,
    org_id: DEMO_ORG_ID,
    facility_id: facility.id,
    next_test_date: null,
    active: true,
    created_at: createdAt,
    updated_at: createdAt,
  }));

  const tests = [];
  let testSeq = 0;

  // Financial covenants: one test per reading, status from the real evaluator
  // rather than asserted here, so a threshold change moves the demo too.
  covenants
    .filter((c) => c.kind === 'financial' && c.metric_key)
    .forEach((covenant) => {
      def.readings.forEach((reading, i) => {
        const reported = reading[covenant.metric_key];
        if (reported == null) return;
        const testDate = dateDaysAgo(reading.daysAgo);
        tests.push({
          id: `${facility.id}-test-${++testSeq}`,
          org_id: DEMO_ORG_ID,
          facility_id: facility.id,
          covenant_id: covenant.id,
          test_date: testDate,
          due_date: testDate,
          reported_value: reported,
          submitted_at: testDate,
          status: evaluateCovenantTest(covenant, { reportedValue: reported, asOf: testDate }),
          note: NOTES[covenant.name]?.[def.dealName]?.[i] || '',
          created_by: DEMO_USER_ID,
          created_at: isoDaysAgo(reading.daysAgo),
        });
      });
    });

  // Reporting covenants: status from whether the filing landed inside its
  // due date and cure window.
  def.filings.forEach((filing) => {
    const covenant = covenants.find((c) => c.kind === 'reporting' && c.name === filing.name);
    if (!covenant) return;
    const dueDate = dateDaysAgo(filing.dueDaysAgo);
    const submittedAt = filing.submittedDaysAgo == null ? null : dateDaysAgo(filing.submittedDaysAgo);
    const asOf = dateDaysAgo(0);
    tests.push({
      id: `${facility.id}-test-${++testSeq}`,
      org_id: DEMO_ORG_ID,
      facility_id: facility.id,
      covenant_id: covenant.id,
      test_date: submittedAt || dueDate,
      due_date: dueDate,
      reported_value: null,
      submitted_at: submittedAt,
      status: evaluateCovenantTest(covenant, { dueDate, submittedAt, asOf }),
      note: '',
      created_by: DEMO_USER_ID,
      created_at: isoDaysAgo(filing.submittedDaysAgo ?? filing.dueDaysAgo),
    });
  });

  // Schedule the next test on each covenant from the last one it actually had,
  // so the facility has a forward calendar rather than a blank one.
  covenants.forEach((covenant) => {
    const own = tests
      .filter((t) => t.covenant_id === covenant.id)
      .sort((a, b) => (a.test_date < b.test_date ? 1 : -1));
    if (own.length === 0) {
      covenant.next_test_date = dateDaysAhead(30);
      return;
    }
    const months = covenant.test_frequency === 'monthly' ? 1
      : covenant.test_frequency === 'quarterly' ? 3
        : covenant.test_frequency === 'semiannual' ? 6 : 12;
    const last = new Date(`${own[0].test_date}T00:00:00Z`);
    last.setUTCMonth(last.getUTCMonth() + months);
    covenant.next_test_date = last.toISOString().slice(0, 10);
  });

  return { facility, covenants, tests };
}

function build() {
  const deals = getInitialDemoPipeline();
  const facilities = [];
  const covenants = [];
  const tests = [];

  FACILITY_DEFS.forEach((def, i) => {
    const deal = deals.find((d) => d.name === def.dealName && d.stage === 'Funded');
    // A rename on the demo board should not crash the monitoring tab.
    if (!deal) return;
    const built = buildFacility(def, deal, i);
    facilities.push(built.facility);
    covenants.push(...built.covenants);
    tests.push(...built.tests);
  });

  return { facilities, covenants, tests };
}

// Built once at module load. Callers get fresh copies so the in-memory demo
// stores can mutate them without trashing the source, matching demoPipeline.
const BUILT = build();

export function getInitialDemoFacilities() {
  return BUILT.facilities.map((f) => ({ ...f }));
}

export function getInitialDemoCovenants() {
  return BUILT.covenants.map((c) => ({ ...c }));
}

export function getInitialDemoCovenantTests() {
  return BUILT.tests.map((t) => ({ ...t }));
}
