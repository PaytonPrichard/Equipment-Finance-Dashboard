// Capture mode exists so a product video does not carry a banner addressed
// to nobody. It must not become a way to quietly drop the disclosure from
// the demo prospects actually drive, so the rules are worth pinning.

const setUrl = (search) => {
  delete window.location;
  window.location = { search, href: `https://gettranche.app/${search}`, pathname: '/' };
};

const fresh = () => {
  jest.resetModules();
  return require('./demoMode');
};

describe('capture mode', () => {
  afterEach(() => { jest.resetModules(); });

  test('is off in the demo people are given', () => {
    setUrl('?demo=1');
    const m = fresh();
    expect(m.isDemoMode()).toBe(true);
    expect(m.isCaptureMode()).toBe(false);
  });

  test('is on only when asked for explicitly', () => {
    setUrl('?demo=1&capture=1');
    const m = fresh();
    expect(m.isDemoMode()).toBe(true);
    expect(m.isCaptureMode()).toBe(true);
  });

  test('cannot be turned on without demo mode', () => {
    // Otherwise a stray param on the real app would mean something.
    setUrl('?capture=1');
    const m = fresh();
    expect(m.isDemoMode()).toBe(false);
    expect(m.isCaptureMode()).toBe(false);
  });

  test('is not remembered', () => {
    // It lives in the URL and nowhere else, so a later visit to ?demo=1
    // gets the banner back.
    setUrl('?demo=1&capture=1');
    expect(fresh().isCaptureMode()).toBe(true);
    setUrl('?demo=1');
    expect(fresh().isCaptureMode()).toBe(false);
  });

  test('any other value is off', () => {
    for (const v of ['0', 'true', 'yes', '']) {
      setUrl(`?demo=1&capture=${v}`);
      expect(fresh().isCaptureMode()).toBe(false);
    }
  });
});

describe('the demo identity', () => {
  test('is a credible analyst and firm, not "Demo Analyst"', () => {
    // Both names are printed on the committee memo, the firm in its
    // masthead and both in its footer, and the analyst sits in the app
    // header on every screen. They are the same names preview-memo.js uses.
    const { DEMO_PROFILE, DEMO_ANALYST_NAME, DEMO_ORG_NAME } = require('../data/demoPipeline');
    expect(DEMO_PROFILE.full_name).toBe(DEMO_ANALYST_NAME);
    expect(DEMO_PROFILE.organizations.name).toBe(DEMO_ORG_NAME);
    expect(DEMO_ANALYST_NAME).not.toMatch(/demo/i);
    expect(DEMO_ORG_NAME).not.toMatch(/demo/i);
  });
});
