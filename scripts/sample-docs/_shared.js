// Shared page chrome for generated sample documents.
//
// Every generated page carries a visible synthetic-data marker. These
// documents exist to exercise extraction against realistic layouts; they
// must never be mistaken for a real borrower's financials.

const SYNTHETIC_NOTICE = 'SAMPLE — SYNTHETIC DATA. Fictional borrower. Not a real credit file.';

const BASE_CSS = `
  @page { size: Letter; margin: 0.6in; }
  * { box-sizing: border-box; }
  body {
    font-family: "Times New Roman", Times, serif;
    font-size: 10.5pt;
    line-height: 1.35;
    color: #111;
    margin: 0;
  }
  .marker {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 7pt;
    letter-spacing: 0.08em;
    color: #b45309;
    border: 1px solid #f0c479;
    background: #fdf7ec;
    padding: 3px 6px;
    margin-bottom: 14px;
    text-align: center;
  }
  .letterhead { border-bottom: 2px solid #111; padding-bottom: 6px; margin-bottom: 14px; }
  .letterhead .name { font-size: 15pt; font-weight: bold; letter-spacing: 0.02em; }
  .letterhead .meta { font-size: 8.5pt; color: #444; margin-top: 2px; }
  h1 { font-size: 12.5pt; margin: 16px 0 8px; text-transform: uppercase; letter-spacing: 0.04em; }
  h2 { font-size: 10.5pt; margin: 14px 0 5px; text-transform: uppercase; letter-spacing: 0.03em;
       border-bottom: 1px solid #999; padding-bottom: 2px; }
  table { width: 100%; border-collapse: collapse; margin: 6px 0 10px; font-size: 10pt; }
  th, td { padding: 3px 6px; vertical-align: top; }
  thead th { border-bottom: 1px solid #111; text-align: right; font-size: 9pt;
             text-transform: uppercase; letter-spacing: 0.03em; }
  thead th:first-child { text-align: left; }
  tbody td { border-bottom: 1px solid #e2e2e2; text-align: right; }
  tbody td:first-child { text-align: left; }
  tr.total td { border-top: 1px solid #111; border-bottom: 2px double #111; font-weight: bold; }
  tr.sub td { font-style: italic; color: #333; }
  .kv { width: 100%; font-size: 10pt; }
  .kv td { border: none; padding: 2px 6px 2px 0; text-align: left; }
  .kv td:first-child { width: 42%; color: #333; }
  .kv td:last-child { font-weight: bold; }
  p { margin: 6px 0; }
  .note { font-size: 9pt; color: #444; font-style: italic; }
  .footer { margin-top: 18px; padding-top: 6px; border-top: 1px solid #ccc;
            font-size: 8pt; color: #666; }
`;

function page({ title, letterhead, body, extraCss = '' }) {
  return `<!doctype html>
<html><head><meta charset="utf-8"><title>${title}</title>
<style>${BASE_CSS}${extraCss}</style></head>
<body>
  <div class="marker">${SYNTHETIC_NOTICE}</div>
  ${letterhead ? `<div class="letterhead">
    <div class="name">${letterhead.name}</div>
    <div class="meta">${letterhead.meta}</div>
  </div>` : ''}
  ${body}
  <div class="footer">${SYNTHETIC_NOTICE}</div>
</body></html>`;
}

// $6,275,000 — the format these documents actually use.
function usd(n) {
  return '$' + Number(n).toLocaleString('en-US');
}

module.exports = { page, usd, SYNTHETIC_NOTICE };
