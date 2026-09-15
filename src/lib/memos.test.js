import { describeMemoDrift, sha256Hex } from './memos';

// The point of a stored memo is that the deal underneath it can move without
// the record moving. These tests pin down when that movement is worth saying
// out loud, because a notice that fires on noise gets ignored, and one that
// stays quiet on a verdict change is worse than no notice at all.

const memo = (over = {}) => ({ score: 72, verdict: 'PASS', sofr: 0.0433, ...over });

describe('describeMemoDrift', () => {
  it('returns null when there is no memo to compare against', () => {
    expect(describeMemoDrift(null, { score: 72, verdict: 'PASS', sofr: 0.0433 })).toBeNull();
    expect(describeMemoDrift(undefined, { score: 72 })).toBeNull();
  });

  it('reports no drift when nothing moved', () => {
    const drift = describeMemoDrift(memo(), { score: 72, verdict: 'PASS', sofr: 0.0433 });
    expect(drift.hasDrift).toBe(false);
    expect(drift.score.changed).toBe(false);
    expect(drift.verdict.changed).toBe(false);
    expect(drift.sofr.changed).toBe(false);
  });

  it('ignores score movement below the precision the memo prints', () => {
    // 72.1 and 72.4 both print as 72. Flagging that would train people to
    // ignore the badge.
    const drift = describeMemoDrift(memo({ score: 72.1 }), { score: 72.4, verdict: 'PASS', sofr: 0.0433 });
    expect(drift.hasDrift).toBe(false);
  });

  it('reports a score change at one whole point', () => {
    const drift = describeMemoDrift(memo(), { score: 68, verdict: 'PASS', sofr: 0.0433 });
    expect(drift.hasDrift).toBe(true);
    expect(drift.score).toEqual({ then: 72, now: 68, changed: true });
  });

  it('reports a verdict change even when the score is unchanged', () => {
    const drift = describeMemoDrift(memo(), { score: 72, verdict: 'FLAG', sofr: 0.0433 });
    expect(drift.hasDrift).toBe(true);
    expect(drift.verdict).toEqual({ then: 'PASS', now: 'FLAG', changed: true });
  });

  it('compares verdicts case insensitively', () => {
    const drift = describeMemoDrift(memo({ verdict: 'pass' }), { score: 72, verdict: 'Pass', sofr: 0.0433 });
    expect(drift.verdict.changed).toBe(false);
    expect(drift.verdict.then).toBe('PASS');
  });

  it('reports a SOFR move of a basis point but not less', () => {
    const moved = describeMemoDrift(memo(), { score: 72, verdict: 'PASS', sofr: 0.0434 });
    expect(moved.sofr.changed).toBe(true);
    expect(moved.hasDrift).toBe(true);

    const noise = describeMemoDrift(memo(), { score: 72, verdict: 'PASS', sofr: 0.04335 });
    expect(noise.sofr.changed).toBe(false);
    expect(noise.hasDrift).toBe(false);
  });

  it('does not claim a change when either side of a comparison is missing', () => {
    const drift = describeMemoDrift(memo({ score: null, verdict: null, sofr: null }), {
      score: 68, verdict: 'FLAG', sofr: 0.05,
    });
    expect(drift.hasDrift).toBe(false);
    expect(drift.score.changed).toBe(false);
    expect(drift.verdict.changed).toBe(false);
    expect(drift.sofr.changed).toBe(false);
  });

  it('treats a non-finite score as absent rather than as zero', () => {
    const drift = describeMemoDrift(memo({ score: NaN }), { score: 72, verdict: 'PASS', sofr: 0.0433 });
    expect(drift.score.then).toBeNull();
    expect(drift.score.changed).toBe(false);
  });
});

describe('sha256Hex', () => {
  it('hashes to stable hex, or degrades to null where crypto.subtle is unavailable', async () => {
    const a = await sha256Hex('<html>memo</html>');
    const b = await sha256Hex('<html>memo</html>');
    expect(a).toEqual(b);
    if (a !== null) {
      expect(a).toMatch(/^[0-9a-f]{64}$/);
      expect(await sha256Hex('<html>other</html>')).not.toEqual(a);
    }
  });
});
