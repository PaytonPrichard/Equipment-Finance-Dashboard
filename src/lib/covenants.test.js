import {
  evaluateFinancialCovenant,
  evaluateReportingCovenant,
  evaluateCovenantTest,
  addFrequency,
} from './covenants';

describe('evaluateFinancialCovenant', () => {
  // DSCR covenant: flag below 1.25, fail below 1.00. These boundaries are
  // lifted from evaluateScreening and must not drift.
  describe('direction min (DSCR, turnover)', () => {
    const flag = 1.25;
    const fail = 1.0;

    test('passes at the flag boundary (strict)', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 1.25)).toBe('pass');
    });
    test('passes above the flag threshold', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 1.4)).toBe('pass');
    });
    test('flags just below the flag threshold', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 1.24)).toBe('flag');
    });
    test('flags exactly at the fail boundary (1.00 is not yet a fail)', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 1.0)).toBe('flag');
    });
    test('fails below 1.00 — the hard DSCR floor', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 0.99)).toBe('fail');
    });
    test('fails at zero coverage', () => {
      expect(evaluateFinancialCovenant('min', flag, fail, 0)).toBe('fail');
    });
    test('null fail band yields only pass/flag', () => {
      expect(evaluateFinancialCovenant('min', 4.0, null, 0)).toBe('flag');
    });
  });

  // Leverage covenant: flag above 5.0, fail above 7.5 (1.5x). Mirrors screening.
  describe('direction max (leverage, LTV, concentration)', () => {
    const flag = 5.0;
    const fail = 7.5;

    test('passes at the flag boundary (strict)', () => {
      expect(evaluateFinancialCovenant('max', flag, fail, 5.0)).toBe('pass');
    });
    test('passes below the flag threshold', () => {
      expect(evaluateFinancialCovenant('max', flag, fail, 3.0)).toBe('pass');
    });
    test('flags just above the flag threshold', () => {
      expect(evaluateFinancialCovenant('max', flag, fail, 5.1)).toBe('flag');
    });
    test('flags at the fail boundary (7.5 is not yet a fail)', () => {
      expect(evaluateFinancialCovenant('max', flag, fail, 7.5)).toBe('flag');
    });
    test('fails above 1.5x the max — the hard leverage breach', () => {
      expect(evaluateFinancialCovenant('max', flag, fail, 7.6)).toBe('fail');
    });
    test('null fail band yields only pass/flag', () => {
      expect(evaluateFinancialCovenant('max', 25, null, 40)).toBe('flag');
    });
  });
});

describe('evaluateReportingCovenant', () => {
  const due = '2026-06-30';
  const cure = 5;

  test('on-time submission passes', () => {
    expect(evaluateReportingCovenant(due, '2026-06-28', cure, '2026-07-10')).toBe('pass');
  });
  test('submission on the due date passes', () => {
    expect(evaluateReportingCovenant(due, '2026-06-30', cure, '2026-07-10')).toBe('pass');
  });
  test('late within the cure window flags', () => {
    expect(evaluateReportingCovenant(due, '2026-07-03', cure, '2026-07-10')).toBe('flag');
  });
  test('submission at the cure edge flags', () => {
    expect(evaluateReportingCovenant(due, '2026-07-05', cure, '2026-07-10')).toBe('flag');
  });
  test('submission past the cure window fails', () => {
    expect(evaluateReportingCovenant(due, '2026-07-06', cure, '2026-07-10')).toBe('fail');
  });
  test('unsubmitted and not yet due passes', () => {
    expect(evaluateReportingCovenant(due, null, cure, '2026-06-15')).toBe('pass');
  });
  test('unsubmitted and late within cure flags', () => {
    expect(evaluateReportingCovenant(due, null, cure, '2026-07-03')).toBe('flag');
  });
  test('unsubmitted and past cure fails', () => {
    expect(evaluateReportingCovenant(due, null, cure, '2026-07-20')).toBe('fail');
  });
  test('accepts a full datetime for submittedAt', () => {
    expect(evaluateReportingCovenant(due, '2026-06-30T14:00:00Z', cure, '2026-07-10')).toBe('pass');
  });
});

describe('evaluateCovenantTest dispatch', () => {
  const dscrCovenant = { kind: 'financial', direction: 'min', flag_value: 1.25, fail_value: 1.0, cure_days: 0 };
  const bbcCovenant = { kind: 'reporting', direction: null, flag_value: null, fail_value: null, cure_days: 5 };

  test('routes financial covenants to the value evaluator', () => {
    expect(evaluateCovenantTest(dscrCovenant, { reportedValue: 1.1, asOf: '2026-07-01' })).toBe('flag');
  });
  test('routes reporting covenants to the timeliness evaluator', () => {
    expect(
      evaluateCovenantTest(bbcCovenant, { dueDate: '2026-06-30', submittedAt: '2026-06-29', asOf: '2026-07-01' }),
    ).toBe('pass');
  });
  test('throws when a financial test has no reported value', () => {
    expect(() => evaluateCovenantTest(dscrCovenant, { asOf: '2026-07-01' })).toThrow();
  });
  test('throws when a reporting test has no due date', () => {
    expect(() => evaluateCovenantTest(bbcCovenant, { submittedAt: null, asOf: '2026-07-01' })).toThrow();
  });
});

describe('addFrequency', () => {
  test('monthly advances one month', () => {
    expect(addFrequency('2026-01-15', 'monthly')).toBe('2026-02-15');
  });
  test('quarterly advances three months', () => {
    expect(addFrequency('2026-01-15', 'quarterly')).toBe('2026-04-15');
  });
  test('semiannual advances six months', () => {
    expect(addFrequency('2026-01-15', 'semiannual')).toBe('2026-07-15');
  });
  test('annual advances a year', () => {
    expect(addFrequency('2026-01-15', 'annual')).toBe('2027-01-15');
  });
  test('rolls over the year boundary', () => {
    expect(addFrequency('2026-12-10', 'monthly')).toBe('2027-01-10');
  });
  test('accepts a full datetime and returns a date', () => {
    expect(addFrequency('2026-03-31T12:00:00Z', 'quarterly')).toBe('2026-07-01');
  });
});
