// ============================================================
// SEC EDGAR XBRL companyfacts client.
//
// SEC asks every automated client for a descriptive User-Agent with a
// contact, and caps traffic at 10 requests/second. We send one request
// per company and pause between them, well under the cap.
//
// Known limit: companyfacts drops "dimensioned" facts, i.e. values
// tagged with a segment or class qualifier. Rental fleet depreciation,
// floorplan payables and individual note tranches often live there.
// Those figures have to be read from the filing and cited manually.
// ============================================================

const USER_AGENT = 'Tranche joelpeter617@gmail.com';
const MIN_GAP_MS = 250;

let lastRequestAt = 0;

async function politeFetchJson(url) {
  const wait = lastRequestAt + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastRequestAt = Date.now();
  const res = await fetch(url, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } });
  if (!res.ok) throw new Error(`EDGAR ${res.status} for ${url}`);
  return res.json();
}

function companyFactsUrl(cik) {
  return `https://data.sec.gov/api/xbrl/companyfacts/CIK${String(cik).padStart(10, '0')}.json`;
}

function filingIndexUrl(cik, accn) {
  return `https://www.sec.gov/Archives/edgar/data/${Number(cik)}/${accn.replace(/-/g, '')}/`;
}

async function fetchCompanyFacts(cik) {
  return politeFetchJson(companyFactsUrl(cik));
}

const DAY_MS = 864e5;

/**
 * The annual value of one tag for the fiscal year ending `fiscalYearEnd`.
 *
 * Flow items (revenue, interest paid) must cover roughly a full year.
 * Stock items (debt) are instants at year end. Later 10-Ks repeat prior
 * years, sometimes restated, so we take the fact from the earliest 10-K
 * that reports it: the filing an analyst would have had at the time.
 *
 * @returns {{tag, val, start, end, accn, form, filed, url} | null}
 */
function pickAnnualFact(facts, qualifiedTag, fiscalYearEnd, cik) {
  const [ns, tag] = qualifiedTag.split(':');
  const units = facts?.facts?.[ns]?.[tag]?.units;
  if (!units) return null;
  const series = units.USD || Object.values(units)[0] || [];
  const candidates = series.filter((x) => {
    if (!/^10-K/.test(x.form) || x.end !== fiscalYearEnd) return false;
    if (!x.start) return true;
    const days = (new Date(x.end) - new Date(x.start)) / DAY_MS;
    return days > 350 && days < 380;
  });
  if (!candidates.length) return null;
  candidates.sort((a, b) => (a.filed < b.filed ? -1 : a.filed > b.filed ? 1 : 0));
  const f = candidates[0];
  return {
    tag: qualifiedTag,
    val: f.val,
    start: f.start || null,
    end: f.end,
    accn: f.accn,
    form: f.form,
    filed: f.filed,
    url: filingIndexUrl(cik, f.accn),
  };
}

module.exports = { USER_AGENT, fetchCompanyFacts, pickAnnualFact, companyFactsUrl, filingIndexUrl };
