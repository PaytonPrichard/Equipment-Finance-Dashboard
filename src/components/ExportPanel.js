import React, { useState } from 'react';
import { exportScreeningCsv } from '../utils/csvExport';
import { DEFAULT_CRITERIA } from '../lib/screeningCriteria';
import { createMemoSnapshot } from '../lib/memos';
import packageJson from '../../package.json';

const APP_VERSION = process.env.REACT_APP_VERSION || packageJson.version || 'dev';

// Escapes for HTML text content AND attribute values. Quote-escaping is what
// makes interpolation into src="...", alt="...", etc. safe.
function esc(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Branding values land in CSS/attribute positions where esc() alone isn't
// enough. Validate them: a real color or a real https URL, or fall back.
function safeColor(value, fallback) {
  return /^#[0-9a-fA-F]{3,8}$/.test(String(value || '')) ? value : fallback;
}

function safeUrl(value) {
  const s = String(value || '').trim();
  return /^https:\/\//i.test(s) ? s : '';
}

// A memo opens by stating the ask. Without this a reader gets a score before
// they know what is being asked for, which is backwards: the request is the
// thing being decided. Every value here is already on the page; nothing new
// is computed and nothing is inferred.
function buildRequestLine(inputs, metrics, moduleKey, financingLabel) {
  const usd = (v) => '$' + Math.round(Number(v) || 0).toLocaleString();
  const company = inputs?.companyName;
  if (!company) return '';

  if (moduleKey === 'equipment_finance') {
    const financed = metrics?.netFinanced;
    if (!financed) return '';
    const term = inputs?.loanTerm ? `${inputs.loanTerm}-month ` : '';
    const structure = financingLabel ? `${financingLabel}` : 'facility';
    const condition = inputs?.equipmentCondition ? inputs.equipmentCondition.toLowerCase() + ' ' : '';
    const kind = inputs?.equipmentType ? `${condition}${inputs.equipmentType.toLowerCase()}` : 'equipment';
    return `${usd(financed)} ${term}${structure} to finance ${kind} for ${company}.`;
  }

  if (moduleKey === 'accounts_receivable') {
    const base = metrics?.borrowingBase;
    if (!base) return '';
    const rate = inputs?.requestedAdvanceRate
      ? ` at ${article(inputs.requestedAdvanceRate)} ${inputs.requestedAdvanceRate}% advance rate`
      : '';
    return `${usd(base)} revolving facility secured by accounts receivable${rate} for ${company}.`;
  }

  const base = metrics?.borrowingBase;
  if (!base) return '';
  const rate = inputs?.requestedAdvanceRate
    ? ` at ${article(inputs.requestedAdvanceRate)} ${inputs.requestedAdvanceRate}% advance rate`
    : '';
  return `${usd(base)} revolving facility secured by inventory${rate} for ${company}.`;
}

// "a 85% advance rate" reads wrong. The article depends on how the number
// is spoken, not how it is spelled: eight, eleven, eighteen and eighty all
// start with a vowel sound.
function article(n) {
  const s = String(Math.floor(Math.abs(Number(n) || 0)));
  if (s === '8' || s === '11' || s === '18') return 'an';
  if (s.startsWith('8') && s.length === 2) return 'an';   // 80-89
  if (s.startsWith('11') && s.length === 4) return 'an';  // 1100-1199
  if (s.startsWith('18') && s.length === 4) return 'an';  // 1800-1899
  return 'a';
}

// Sources and uses. Equipment finance only: an ABL revolver funds against a
// borrowing base rather than a fixed purchase, so the three-line block does
// not describe it and is omitted rather than faked.
function buildSourcesAndUses(inputs, metrics, moduleKey) {
  if (moduleKey !== 'equipment_finance') return null;
  const cost = Number(inputs?.equipmentCost) || 0;
  const down = Number(inputs?.downPayment) || 0;
  const financed = Number(metrics?.netFinanced) || 0;
  if (!cost || !financed) return null;
  return { cost, down, financed };
}

// Two lines of borrower context from fields already collected. A committee
// reading this cold should not have to assemble who the borrower is from a
// metrics table.
function buildBorrowerDescription(inputs) {
  const company = inputs?.companyName;
  if (!company) return '';
  const parts = [];
  if (inputs?.yearsInBusiness) {
    parts.push(`has been operating for ${inputs.yearsInBusiness} year${inputs.yearsInBusiness === 1 ? '' : 's'}`);
  }
  if (inputs?.industrySector) parts.push(`in ${inputs.industrySector.toLowerCase()}`);
  const revenue = Number(inputs?.annualRevenue) || 0;
  const scale = revenue
    ? `Most recent annual revenue is $${Math.round(revenue).toLocaleString()}`
    : '';
  const rating = inputs?.creditRating && inputs.creditRating !== 'Not Rated'
    ? ` Credit quality is characterized as ${inputs.creditRating.toLowerCase()}.`
    : '';
  const opening = parts.length ? `${company} ${parts.join(' ')}.` : `${company}.`;
  return `${opening}${scale ? ' ' + scale + '.' : ''}${rating}`;
}

// Legacy path: recover the assessment lines from the plain-text summary.
// Only used when a caller does not pass the commentary array.
function parseCommentaryFromSummary(summaryText) {
  const out = [];
  let inCommentary = false;
  for (const line of String(summaryText || '').split('\n')) {
    if (line.includes('ASSESSMENT NOTES')) { inCommentary = true; continue; }
    if (line.includes('STRESS TEST') || line.includes('FACILITY STRUCTURE') || line.includes('SUGGESTED ENHANCEMENTS') || line.includes('DISCLAIMER')) { inCommentary = false; }
    if (inCommentary && line.trim() && !/^[-=]+$/.test(line.trim())) out.push(line.trim());
  }
  return out;
}

// Two notes about the body below, kept here rather than as HTML comments,
// because anything in the template ships inside every downloaded memo and
// every stored snapshot.
//
// There is no "Recommended Action" section. It used to open by restating
// the score banner directly above it: same category, same colour, same
// detail line, within about 200px on page one, so a committee reader met
// the recommendation twice before reaching a new fact. The banner keeps it,
// because the banner carries the score and the verdict alongside. What only
// that block had was the conditions, so that is all it is now, and it
// renders only when there are some.
//
// Source Documents and the footer are wrapped together. Apart, the page
// boundary landed between them on the inventory memo and the last page
// carried nothing but the disclaimer. Together they are about a third of a
// page, so keeping them whole is always affordable.
export function generateBrandedPdfHtml({ summaryText, inputs, metrics, riskScore, recommendation, screeningResult, orgName, analystName, moduleLabel, branding, factors = [], structure = null, stressResults = [], moduleKey = 'equipment_finance', borrowerExtras = null, criteria = null, commentary = null, sourceDocuments = [], generatedAt = null }) {
  const companyName = inputs?.companyName || 'N/A';
  // Read from the model, not the clock. A memo reopened next quarter has to
  // print the date it went to committee, not the date it was reopened.
  const date = new Date(generatedAt || Date.now()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const score = riskScore?.composite ?? 0;
  const verdict = screeningResult?.verdict?.toUpperCase() || '';
  const b = branding || {};
  const accentColor = safeColor(b.accentColor, '#d4a843');
  const logoUrl = safeUrl(b.logoUrl);
  const footerText = b.footerText || '';
  const memoTitle = b.memoTitle || '';

  // Score styling
  let scoreColor = '#dc2626', scoreBg = '#fef2f2', scoreBorder = '#fecaca';
  if (score >= 75) { scoreColor = '#16a34a'; scoreBg = '#f0fdf4'; scoreBorder = '#bbf7d0'; }
  else if (score >= 55) { scoreColor = '#ca8a04'; scoreBg = '#fefce8'; scoreBorder = '#fef08a'; }
  else if (score >= 35) { scoreColor = '#ea580c'; scoreBg = '#fff7ed'; scoreBorder = '#fed7aa'; }

  // Verdict styling
  let verdictColor = scoreColor;
  let verdictBg = scoreBg;
  if (verdict === 'PASS') { verdictColor = '#16a34a'; verdictBg = '#f0fdf4'; }
  else if (verdict === 'FLAG') { verdictColor = '#ca8a04'; verdictBg = '#fefce8'; }
  else if (verdict === 'FAIL') { verdictColor = '#dc2626'; verdictBg = '#fef2f2'; }

  const fmtCurrency = (v) => {
    if (!v) return '$0';
    return '$' + Math.round(v).toLocaleString();
  };
  const fmtPct = (v) => v !== undefined && v !== null ? (v * 100).toFixed(1) + '%' : '';
  const fmtRatio = (v) => v !== undefined ? v.toFixed(2) + 'x' : '';

  // Build key metrics table based on what's available.
  //
  // The green/amber/red dots are read as a judgement about the firm's policy,
  // so their breakpoints come from that policy rather than from literals
  // sitting in the presentation layer. Green is at or better than the firm's
  // limit, amber is past it but not alarming, red is past the point the
  // commentary would call out.
  const c = { ...DEFAULT_CRITERIA, ...(criteria || {}) };
  const dscrFloor = moduleKey === 'accounts_receivable' ? c.minDscrAR : c.minDscr;
  const metricRows = [];
  if (metrics?.dscr !== undefined) metricRows.push(['DSCR', fmtRatio(metrics.dscr), metrics.dscr >= dscrFloor ? '#16a34a' : metrics.dscr >= 1.0 ? '#ca8a04' : '#dc2626']);
  if (borrowerExtras?.fccr != null) metricRows.push(['FCCR', fmtRatio(borrowerExtras.fccr), borrowerExtras.fccr >= dscrFloor ? '#16a34a' : borrowerExtras.fccr >= 1.0 ? '#ca8a04' : '#dc2626']);
  if (metrics?.leverage !== undefined) metricRows.push(['Leverage', fmtRatio(metrics.leverage), metrics.leverage <= c.maxLeverage ? '#16a34a' : metrics.leverage <= c.maxLeverage * 1.5 ? '#ca8a04' : '#dc2626']);
  if (metrics?.ltv !== undefined) metricRows.push(['LTV', fmtPct(metrics.ltv), metrics.ltv * 100 <= c.maxLtv ? '#16a34a' : metrics.ltv <= 1.2 ? '#ca8a04' : '#dc2626']);
  if (metrics?.termCoverage !== undefined) {
    // DSCR, FCCR, leverage and LTV are standard and travel on their own.
    // Term coverage as a percent of useful life is this product's framing,
    // and 58% means nothing to a reader who has not been told what it is a
    // percentage of. The screening view spells it out as "7.0yr / 12yr";
    // the memo did not, and the memo is the artifact that leaves the room.
    const years = (inputs?.loanTerm || 0) / 12;
    const life = inputs?.usefulLife || 0;
    const note = years > 0 && life > 0 ? `${years.toFixed(1)}yr / ${life}yr` : '';
    metricRows.push(['Term Coverage', metrics.termCoverage.toFixed(0) + '%', metrics.termCoverage <= c.maxTermCoverage ? '#16a34a' : '#dc2626', note]);
  }
  if (metrics?.borrowingBase !== undefined) metricRows.push(['Borrowing Base', fmtCurrency(metrics.borrowingBase), '#334155']);
  if (metrics?.dso !== undefined) metricRows.push(['DSO', Math.round(metrics.dso) + ' days', metrics.dso <= 60 ? '#16a34a' : '#ca8a04']);
  if (metrics?.concentrationRisk !== undefined) metricRows.push(['Concentration', fmtPct(metrics.concentrationRisk), metrics.concentrationRisk * 100 <= c.maxConcentration ? '#16a34a' : '#dc2626']);
  if (metrics?.turnoverRatio !== undefined) metricRows.push(['Turnover', fmtRatio(metrics.turnoverRatio), metrics.turnoverRatio >= c.minTurnover ? '#16a34a' : '#ca8a04']);
  if (metrics?.obsolescenceRate !== undefined) metricRows.push(['Obsolescence', fmtPct(metrics.obsolescenceRate), metrics.obsolescenceRate * 100 <= c.maxObsolescence ? '#16a34a' : '#dc2626']);

  const rate = metrics?.rate || metrics?.effectiveRate || 0;

  const requestLine = buildRequestLine(inputs, metrics, moduleKey, structure?.type || structure?.structureType || '');
  const borrowerDescription = buildBorrowerDescription(inputs);
  const sourcesAndUses = buildSourcesAndUses(inputs, metrics, moduleKey);

  // Assessment comes through as an array. It used to be recovered by
  // string-matching 'ASSESSMENT NOTES' out of summaryText, a blob this
  // function was already handed, even though App.js had computed commentary
  // as a proper array all along and simply never passed it down. Renaming a
  // header inside any module's generateExportSummary silently emptied the
  // section. Same fix commit 6d4dc77 applied to the structure section;
  // commentary was the leftover.
  //
  // The summaryText fallback stays for callers that have not been updated,
  // so an old call site degrades rather than losing the section outright.
  const commentaryLines = Array.isArray(commentary) && commentary.length
    ? commentary.map((c) => String(c).trim()).filter(Boolean)
    : parseCommentaryFromSummary(summaryText);

  // Render the Suggested Structure section directly from the structured
  // getSuggestedStructure output. Module-aware so AR's reporting requirements,
  // inventory's sublimits, and EF's rate range / structure type each surface
  // in the PDF.
  const renderStructureSection = () => {
    if (!structure) return '';
    const parts = [];
    if (structure.structureType) {
      parts.push(`<div style="font-size:12.5px;margin-bottom:3px"><span style="color:#64748b">Type:</span> <span style="color:#1e293b;font-weight:500">${esc(structure.structureType)}</span></div>`);
    }
    if (structure.rateRange && Number.isFinite(structure.rateRange[0]) && Number.isFinite(structure.rateRange[1])) {
      const lo = structure.rateRange[0]; const hi = structure.rateRange[1];
      parts.push(`<div style="font-size:12.5px;margin-bottom:3px"><span style="color:#64748b">Indicative rate:</span> <span style="color:#1e293b;font-weight:500">${(lo * 100).toFixed(2)}–${(hi * 100).toFixed(2)}%</span></div>`);
    }
    if (structure.advanceRate != null) {
      const v = typeof structure.advanceRate === 'string' ? structure.advanceRate : `${(structure.advanceRate * 100).toFixed(1)}%`;
      parts.push(`<div style="font-size:12.5px;margin-bottom:3px"><span style="color:#64748b">Advance rate:</span> <span style="color:#1e293b;font-weight:500">${esc(v)}</span></div>`);
    }
    const facilitySize = structure.facilitySize ?? structure.maxCommitment;
    if (facilitySize) {
      parts.push(`<div style="font-size:12.5px;margin-bottom:3px"><span style="color:#64748b">Facility size:</span> <span style="color:#1e293b;font-weight:500">${fmtCurrency(facilitySize)}</span></div>`);
    }
    if (structure.fieldExamFrequency) {
      parts.push(`<div style="font-size:12.5px;margin-bottom:3px"><span style="color:#64748b">Field exams:</span> <span style="color:#1e293b;font-weight:500">${esc(structure.fieldExamFrequency)}</span></div>`);
    }
    if (structure.structure) {
      parts.push(`<p style="font-size:12.5px;color:#334155;margin:8px 0">${esc(structure.structure)}</p>`);
    }
    if (structure.sublimits) {
      const s = structure.sublimits;
      const row = (label, sub) => `<tr style="border-bottom:1px solid #f1f5f9">
        <td style="padding:4px 8px 4px 0;font-size:12.5px;color:#1f2937">${esc(label)}</td>
        <td style="text-align:right;padding:4px 8px;font-size:12.5px;color:#1f2937;font-family:'IBM Plex Mono',ui-monospace,monospace">${(sub.advanceRate * 100).toFixed(0)}%</td>
        <td style="text-align:right;padding:4px 0 4px 8px;font-size:12.5px;color:#1f2937;font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtCurrency(sub.amount)}</td>
      </tr>`;
      parts.push(`<div style="font-size:11.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px">Borrowing Base Sublimits</div>
        <table style="width:100%;border-collapse:collapse;margin-bottom:8px">
          <thead><tr style="border-bottom:2px solid #e2e8f0">
            <th style="text-align:left;padding:4px 8px 4px 0;font-size:11.5px;color:#64748b;font-weight:600">Category</th>
            <th style="text-align:right;padding:4px 8px;font-size:11.5px;color:#64748b;font-weight:600">Cap</th>
            <th style="text-align:right;padding:4px 0 4px 8px;font-size:11.5px;color:#64748b;font-weight:600">Eligible $</th>
          </tr></thead>
          <tbody>
            ${row('Raw Materials', s.rawMaterials)}
            ${row('Work-in-Progress', s.workInProgress)}
            ${row('Finished Goods', s.finishedGoods)}
          </tbody>
        </table>`);
    }
    if (structure.reportingRequirements && structure.reportingRequirements.length > 0) {
      parts.push(`<div style="font-size:11.5px;font-weight:600;color:#64748b;text-transform:uppercase;letter-spacing:0.06em;margin-top:8px;margin-bottom:4px">Reporting Requirements</div>
        <ul style="margin:0;padding-left:18px">
          ${structure.reportingRequirements.map((r) => `<li style="font-size:12.5px;color:#1f2937;margin-bottom:2px">${esc(r)}</li>`).join('')}
        </ul>`);
    }
    if (structure.sizingFlag) {
      parts.push(`<div style="font-size:11.5px;color:#92400e;background:#fef3c7;border:1px solid #fde68a;border-radius:4px;padding:6px 8px;margin-top:8px;font-style:italic">${esc(structure.sizingFlag)}</div>`);
    }
    if (parts.length === 0) return '';
    return `<div class="section">
      <div class="section-title">Suggested Structure</div>
      ${parts.join('')}
    </div>`;
  };

  // Verdict reasons
  const reasonsHtml = (screeningResult?.reasons || []).map(r => {
    const color = r.level === 'fail' ? '#dc2626' : '#ca8a04';
    const icon = r.level === 'fail' ? '&#10005;' : '&#9888;';
    return `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px"><span style="color:${color};font-size:12.5px;flex-shrink:0">${icon}</span><span style="font-size:12.5px;color:#475569">${esc(r.text)}</span></div>`;
  }).join('');

  // Red flags — bottom sub-scores under 50, paired with their underlying metric.
  // Don't pad: show 0-3 items, sorted worst first.
  const redFlagItems = (factors || [])
    .filter((f) => f.score < 50)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);

  // Strengths & Concerns — page 2. Top 3 ≥75, bottom 3 <50, drawn from the
  // same factor array but expressed for committee skim-reading.
  const strengths = (factors || [])
    .filter((f) => f.score >= 75)
    .slice()
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
  const concerns = (factors || [])
    .filter((f) => f.score < 50)
    .slice()
    .sort((a, b) => a.score - b.score)
    .slice(0, 3);
  const factorRow = (f, side) => {
    const accent = side === 'strength' ? '#16a34a' : '#dc2626';
    return `<div style="border-left:3px solid ${accent};padding:6px 10px;margin-bottom:6px;background:${side === 'strength' ? '#f0fdf4' : '#fef2f2'};border-radius:0 4px 4px 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px">
        <span style="font-size:12.5px;font-weight:700;color:#1f2937">${esc(f.label)}</span>
        <span style="font-size:11.5px;color:${accent};font-weight:600;flex-shrink:0">${Math.round(f.score)}/100</span>
      </div>
      <div style="font-size:11.5px;color:#475569;margin-top:2px">${esc(f.caption)} <span style="color:#94a3b8">· target ${esc(f.target)}</span></div>
    </div>`;
  };
  // Sensitivity table — 4 stress scenarios with module-aware columns.
  // EF: Score | DSCR | FCCR. AR & Inventory: + Borrowing Base.
  const showBorrowingBase = moduleKey === 'accounts_receivable' || moduleKey === 'inventory_finance';
  const fmtMillions = (v) => (v == null || !Number.isFinite(v)) ? '—' : `$${(v / 1_000_000).toFixed(1)}M`;
  const fmtRatioCell = (v) => (v == null || !Number.isFinite(v)) ? '—' : `${v.toFixed(2)}x`;
  const sensitivityHtml = (stressResults && stressResults.length > 0) ? `<div class="section">
    <div class="section-title">Sensitivity Analysis</div>
    <table style="width:100%;border-collapse:collapse;font-size:12.5px">
      <thead>
        <tr style="border-bottom:2px solid #e2e8f0">
          <th style="text-align:left;padding:6px 8px 6px 0;color:#64748b;font-weight:600">Scenario</th>
          <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:600">Score</th>
          <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:600">DSCR</th>
          <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:600">FCCR</th>
          ${showBorrowingBase ? '<th style="text-align:right;padding:6px 0 6px 8px;color:#64748b;font-weight:600">Borrowing Base</th>' : ''}
        </tr>
      </thead>
      <tbody>
        ${stressResults.map((s, i) => {
          const isBase = i === 0;
          const rowStyle = isBase ? 'background:#f8fafc;font-weight:600' : '';
          const dscrColor = s.dscr < 1.0 ? '#dc2626' : s.dscr < 1.25 ? '#ea580c' : '#1f2937';
          const fccrColor = (s.fccr != null && s.fccr < 1.0) ? '#dc2626' : (s.fccr != null && s.fccr < 1.25) ? '#ea580c' : '#1f2937';
          return `<tr style="border-bottom:1px solid #f1f5f9;${rowStyle}">
            <td style="padding:6px 8px 6px 0;color:#1f2937">${esc(s.label)}</td>
            <td style="text-align:right;padding:6px 8px;color:#1f2937;font-family:'IBM Plex Mono',ui-monospace,monospace">${Math.round(s.score)}</td>
            <td style="text-align:right;padding:6px 8px;color:${dscrColor};font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtRatioCell(s.dscr)}</td>
            <td style="text-align:right;padding:6px 8px;color:${fccrColor};font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtRatioCell(s.fccr)}</td>
            ${showBorrowingBase ? `<td style="text-align:right;padding:6px 0 6px 8px;color:#1f2937;font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtMillions(s.borrowingBase)}</td>` : ''}
          </tr>`;
        }).join('')}
      </tbody>
    </table>
  </div>` : '';

  // No forced break before this section. It used to carry
  // page-break-before:always, which threw away whatever was left of the
  // preceding page and is what left page 2 half empty.
  const strengthsConcernsHtml = (strengths.length === 0 && concerns.length === 0) ? '' : `<div class="section">
    <div class="section-title">Strengths &amp; Risks</div>
    <div style="display:flex;gap:12px">
      <div style="flex:1">
        <div style="font-size:11.5px;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Strengths</div>
        ${strengths.length > 0 ? strengths.map((f) => factorRow(f, 'strength')).join('') : '<div style="font-size:12.5px;color:#94a3b8;font-style:italic">No sub-scores above 75.</div>'}
      </div>
      <div style="flex:1">
        <div style="font-size:11.5px;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:6px">Risks</div>
        ${concerns.length > 0 ? concerns.map((f) => factorRow(f, 'concern')).join('') : '<div style="font-size:12.5px;color:#94a3b8;font-style:italic">No sub-scores below 50.</div>'}
      </div>
    </div>
  </div>`;
  const redFlagsHtml = redFlagItems.length === 0 ? '' : `<div class="section" style="margin-bottom:18px;background:#fef2f2;border:1px solid #fecaca;border-left:4px solid #dc2626;border-radius:6px;padding:12px 16px">
    <div style="font-size:12.5px;font-weight:700;color:#991b1b;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:8px">Red Flags</div>
    ${redFlagItems.map((f) => `<div style="display:flex;gap:8px;align-items:baseline;margin-bottom:4px">
      <span style="color:#dc2626;font-size:12.5px;flex-shrink:0">&#10148;</span>
      <span style="font-size:12.5px;color:#1f2937"><strong>${esc(f.label)}</strong> ${esc(f.caption)}, target ${esc(f.target)} <span style="color:#6b7280">(sub-score ${Math.round(f.score)}/100)</span></span>
    </div>`).join('')}
  </div>`;

  const brandingHeader = orgName || logoUrl
    ? `<div style="text-align:right">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(orgName)}" style="max-height:40px;max-width:180px;margin-bottom:4px" />` : ''}
        ${orgName ? `<div style="font-size:12.5px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:600">${esc(orgName)}</div>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Screening Memo: ${esc(companyName)}</title>
<style>
  @page { margin: 0.7in 0.8in; size: letter; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; }
  body { font-family: 'IBM Plex Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 0; line-height: 1.5; font-size: 13.5px; }
  .page { width: 100%; margin: 0; padding: 0; }
  .header { border-bottom: 3px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .section { margin-bottom: 20px; }
  /* Pagination.
     html2pdf renders the whole memo to a single canvas and then slices it
     into pages, so any block without a rule is cut wherever the boundary
     happens to fall. Deal Overview straddled the page 1 break and printed
     with its table sliced through a row. Every top-level block now keeps
     itself whole and the memo packs naturally, which is also what removed
     the half-empty page: there used to be a forced break before Strengths
     and Risks, and a forced break wastes whatever is left of the page it
     leaves behind.
     The tr rule is a safety net. No section is near a page tall today, but
     if one ever grows past that, break-inside on the section cannot be
     honoured and this makes it break between rows rather than through one. */
  .page > div, .section, .keep-together { page-break-inside: avoid; break-inside: avoid; }
  tr { page-break-inside: avoid; break-inside: avoid; }
  .section-title { font-size: 13.5px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 10px 0; padding-bottom: 6px; border-bottom: 2px solid ${accentColor}; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 12px 5px 0; font-size: 12.5px; border-bottom: 1px solid #f1f5f9; }
  th { text-align: left; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div style="font-size:11.5px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:4px">${esc(memoTitle || moduleLabel + ' Screening')}</div>
      <h1 style="font-size:25px;font-weight:800;color:#1e293b;margin:0">${esc(companyName)}</h1>
      <div style="font-size:12.5px;color:#64748b;margin-top:2px">${esc(date)}${analystName ? ' &middot; ' + esc(analystName) : ''}</div>
    </div>
    ${brandingHeader}
  </div>

  ${requestLine ? `<!-- Transaction Summary -->
  <div class="section">
    <div class="section-title">Transaction Summary</div>
    <div style="font-size:14.5px;color:#1f2937;font-weight:500;margin-bottom:${borrowerDescription ? '8px' : '0'}">${esc(requestLine)}</div>
    ${borrowerDescription ? `<div style="font-size:12.5px;color:#475569;line-height:1.55">${esc(borrowerDescription)}</div>` : ''}
  </div>` : ''}

  ${sourcesAndUses ? `<!-- Sources and Uses -->
  <div class="section">
    <div class="section-title">Sources and Uses</div>
    <table>
      <tr><td style="color:#64748b;width:180px">Equipment cost</td><td style="font-weight:500;text-align:right;font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtCurrency(sourcesAndUses.cost)}</td></tr>
      <tr><td style="color:#64748b">Borrower contribution</td><td style="font-weight:500;text-align:right;font-family:'IBM Plex Mono',ui-monospace,monospace">${fmtCurrency(sourcesAndUses.down)}${sourcesAndUses.cost ? ` <span style="color:#64748b;font-weight:400">(${((sourcesAndUses.down / sourcesAndUses.cost) * 100).toFixed(1)}%)</span>` : ''}</td></tr>
      <tr><td style="color:#1f2937;font-weight:600;border-top:1px solid #cbd5e1">Amount financed</td><td style="font-weight:700;text-align:right;font-family:'IBM Plex Mono',ui-monospace,monospace;border-top:1px solid #cbd5e1">${fmtCurrency(sourcesAndUses.financed)}</td></tr>
    </table>
  </div>` : ''}

  <!-- Score + Verdict Banner -->
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="flex:1;background:${scoreBg};border:1px solid ${scoreBorder};border-left:4px solid ${scoreColor};border-radius:6px;padding:14px 20px;display:flex;align-items:center;gap:12px">
      <div>
        <span style="font-size:34px;font-weight:800;color:${scoreColor};line-height:1">${score}</span>
        <span style="font-size:14.5px;font-weight:600;color:${scoreColor}aa">/100</span>
      </div>
      <div>
        <div style="font-size:14.5px;font-weight:700;color:${scoreColor}">${esc(recommendation?.category || '')}</div>
        <div style="font-size:12.5px;color:#475569">${esc(recommendation?.detail || '')}</div>
      </div>
    </div>
    ${verdict ? `<div style="background:${verdictBg};border:1px solid ${verdictColor}33;border-radius:6px;padding:14px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:80px">
      <div style="font-size:17.5px;font-weight:800;color:${verdictColor};letter-spacing:0.1em">${verdict}</div>
    </div>` : ''}
  </div>

  ${(() => {
    const verdictLabel = (verdict || (screeningResult?.verdict || '')).toUpperCase() || '—';
    return `<div style="display:flex;flex-wrap:wrap;gap:14px;margin-bottom:18px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;font-size:12.5px;color:#475569">
      <span>Composite: <strong style="color:#1f2937">${score}</strong></span>
      <span>Firm pass threshold: <strong style="color:#1f2937">${c.passScore}</strong></span>
      <span>Firm flag threshold: <strong style="color:#1f2937">${c.flagScore}</strong></span>
      <span>Verdict: <strong style="color:${verdictColor}">${esc(verdictLabel)}</strong></span>
    </div>`;
  })()}

  ${reasonsHtml ? `<div style="margin-bottom:20px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">${reasonsHtml}</div>` : ''}

  ${redFlagsHtml}

  <!-- Conditions and Mitigants -->
  ${(structure?.enhancements?.length || 0) > 0 ? `<div class="section">
    <div class="section-title">Conditions and Mitigants</div>
    <ul style="margin:0;padding-left:18px">
      ${structure.enhancements.map((e) => `<li style="font-size:12.5px;color:#1f2937;margin-bottom:3px">${esc(e)}</li>`).join('')}
    </ul>
  </div>` : ''}

  <!-- Deal Overview -->
  <div class="section">
    <div class="section-title">Deal Overview</div>
    <table>
      <tr><td style="color:#64748b;width:140px">Industry</td><td style="font-weight:500;text-align:right">${esc(inputs?.industrySector || '')}</td></tr>
      <tr><td style="color:#64748b">Credit Rating</td><td style="font-weight:500;text-align:right">${esc(inputs?.creditRating || '')}</td></tr>
      <tr><td style="color:#64748b">Annual Revenue</td><td style="font-weight:500;text-align:right">${fmtCurrency(inputs?.annualRevenue)}${inputs?.priorYearRevenue > 0 ? ` <span style="color:#64748b;font-weight:400">· prior ${fmtCurrency(inputs.priorYearRevenue)} · ${(((inputs.annualRevenue / inputs.priorYearRevenue) - 1) * 100).toFixed(1)}% YoY</span>` : ''}</td></tr>
      <tr><td style="color:#64748b">EBITDA</td><td style="font-weight:500;text-align:right">${fmtCurrency(inputs?.ebitda)}${inputs?.priorYearEbitda > 0 ? ` <span style="color:#64748b;font-weight:400">· prior ${fmtCurrency(inputs.priorYearEbitda)} · ${(((inputs.ebitda / inputs.priorYearEbitda) - 1) * 100).toFixed(1)}% YoY</span>` : ''}</td></tr>
      <tr><td style="color:#64748b">Existing Debt</td><td style="font-weight:500;text-align:right">${fmtCurrency(inputs?.totalExistingDebt)}</td></tr>
      ${inputs?.yearsInBusiness ? `<tr><td style="color:#64748b">Years in Business</td><td style="font-weight:500;text-align:right">${inputs.yearsInBusiness}</td></tr>` : ''}
      <tr><td style="color:#64748b">Screening Rate</td><td style="font-weight:500;text-align:right">${(rate * 100).toFixed(2)}%</td></tr>
    </table>
  </div>

  <!-- Key Metrics -->
  <div class="section">
    <div class="section-title">Key Metrics</div>
    <table>
      <thead><tr><th>Metric</th><th style="text-align:right">Value</th><th style="text-align:right;width:44px">Status</th></tr></thead>
      <tbody>
        ${metricRows.map(([label, value, color, note]) => `<tr><td>${esc(label)}</td><td style="text-align:right;font-weight:600;font-family:'IBM Plex Mono',ui-monospace,monospace">${esc(value)}${note ? ` <span style="color:#64748b;font-weight:400">· ${esc(note)}</span>` : ''}</td><td style="text-align:right"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span></td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Assessment -->
  ${commentaryLines.length > 0 ? `<div class="section">
    <div class="section-title">Assessment</div>
    <ol style="margin:0;padding-left:20px">
      ${commentaryLines.map(l => { const m = l.match(/^\d+\.\s*(.*)/); return `<li style="margin-bottom:6px;font-size:12.5px;color:#334155">${esc(m ? m[1] : l)}</li>`; }).join('')}
    </ol>
  </div>` : ''}

  ${strengthsConcernsHtml}

  ${sensitivityHtml}

  <!-- Suggested Structure (module-aware, structured) -->
  ${renderStructureSection()}

  <!-- Source Documents + Footer -->
  <div class="keep-together">
  <div class="section">
    <div class="section-title">Source Documents</div>
    ${sourceDocuments.length ? `
      <table>
        <thead><tr><th>Document</th><th>Type</th><th style="text-align:right">Read on</th></tr></thead>
        <tbody>
          ${sourceDocuments.map((d) => `<tr>
            <td style="font-weight:500">${esc(d.fileName)}</td>
            <td style="color:#64748b">${esc(d.documentType || '')}</td>
            <td style="text-align:right;color:#64748b">${esc(d.addedOn || '')}</td>
          </tr>`).join('')}
        </tbody>
      </table>
      <div style="font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.5">
        Figures were extracted from the documents above and reviewed by the analyst before scoring. The score is computed from the reviewed inputs, not from the documents directly.
      </div>
    ` : `
      <div style="font-size:12.5px;color:#475569">Inputs were entered manually. No source documents are attached to this deal.</div>
    `}
  </div>

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:flex-end;gap:24px">
    <!-- 420px here left the right column about 218px of a 662px page, which
         is narrow enough that "Inputs entered by ... on September 23, 2026"
         wrapped with the year alone on its own line. -->
    <div style="font-size:10.5px;color:#94a3b8;max-width:340px">
      Preliminary screening only. Not a credit decision. Final terms subject to full underwriting, credit committee approval, and documentation.
    </div>
    <div style="font-size:10.5px;color:#94a3b8;text-align:right;line-height:1.5">
      ${footerText ? '<div>' + esc(footerText) + '</div>' : ''}
      ${analystName ? `<div>Prepared by: ${esc(analystName)}</div>` : ''}
      <div>Inputs entered${analystName ? ' by ' + esc(analystName) : ''} on ${esc(date)}</div>
      <div>${orgName ? esc(orgName) + ' &middot; ' : ''}Tranche v${esc(APP_VERSION)}</div>
    </div>
  </div>
  </div>
</div>
</body>
</html>`;
}

// html2pdf renders a node inside the live app, not a document, so the memo's
// <head> never reaches it. Taking only the <body> dropped the stylesheet, and
// every class-styled element (section titles, the header, tables) printed
// unstyled. The stylesheet is scoped to the capture container and carried in
// with the body, so its body and * rules cannot restyle the app mid-render.
export const MEMO_SCOPE = 'tranche-memo';

export function scopeMemoCss(css, scope = MEMO_SCOPE) {
  return css
    // Comments first. The rule matcher below treats everything between two
    // braces as a selector list and splits it on commas, so a comment
    // containing a comma had its own prose scoped as if it were selectors,
    // and the real selector that followed it was left unscoped and stopped
    // applying inside the capture container. Latent until the stylesheet
    // grew its first multi-line comment.
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/@page\s*\{[^}]*\}/g, '')
    .replace(/@media print\s*\{[^{}]*\{[^}]*\}\s*\}/g, '')
    .replace(/([^{}]+)\{([^}]*)\}/g, (_, selectors, decls) => {
      const scoped = selectors
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((sel) => {
          if (sel === 'body' || sel === 'html') return `.${scope}`;
          if (sel === '*') return `.${scope}, .${scope} *`;
          return `.${scope} ${sel}`;
        })
        .join(', ');
      return `${scoped} {${decls}}`;
    });
}

export function memoCaptureMarkup(html, scope = MEMO_SCOPE) {
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi)].map((m) => m[1]).join('\n');
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
  return `<style>${scopeMemoCss(css, scope)}</style>${bodyMatch ? bodyMatch[1] : html}`;
}

// html2canvas 1.4.1 cannot parse oklch(), which is how Tailwind 4 defines its
// palette. Any app rule reaching the memo subtree (preflight border colours
// alone are enough) threw, html2pdf fell back to the print window, and no PDF
// or memo snapshot was ever produced. The memo carries its own stylesheet, so
// the clone html2canvas renders keeps only that and the web font.
export function stripAppStylesForCapture(clonedDoc, scope = MEMO_SCOPE) {
  clonedDoc.querySelectorAll('style, link[rel="stylesheet"]').forEach((node) => {
    if (node.closest(`.${scope}`)) return;
    if ((node.getAttribute('href') || '').includes('fonts.googleapis.com')) return;
    node.remove();
  });
}

export default function ExportPanel({ summaryText, inputs, metrics, riskScore, recommendation, screeningResult, profile, moduleLabel, moduleKey, factors, structure, stressResults, borrowerExtras, criteria, commentary, sourceDocuments = [], pipelineDealId = null, userId = null, sofr = null, sofrDate = null, onMemoSaved = null }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(summaryText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"/>
<style>body{font-family:-apple-system,system-ui,sans-serif;color:#000;background:#fff;padding:40px;line-height:1.6;max-width:800px;margin:0 auto}pre{white-space:pre-wrap;font-family:inherit}</style>
</head><body><pre>${summaryText.replace(/&/g,'&amp;').replace(/</g,'&lt;')}</pre></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  };

  const [pdfLoading, setPdfLoading] = useState(false);

// US letter, in millimetres, with the margins a memo actually uses.
// 10mm was tight enough that the content read as a slab rather than
// a typeset page.
const PAGE_W_MM = 215.9;
const MARGIN_X_MM = 20.32; // 0.8in
const MARGIN_Y_MM = 17.78; // 0.7in
const CONTENT_MM = PAGE_W_MM - MARGIN_X_MM * 2;
// CSS resolves absolute units at 96px to the inch, so this is the
// pixel width at which one CSS pixel is exactly one printed pixel.
const CONTENT_PX = Math.round((CONTENT_MM * 96) / 25.4);

  const handleDownloadPdf = async () => {
    const orgName = profile?.organizations?.name || '';
    const analystName = profile?.full_name || profile?.email || '';
    const branding = profile?.organizations?.branding || {};

    // The model is assembled first and the memo is rendered from it, so what
    // gets stored is exactly what produced the PDF rather than a second
    // reconstruction of it. SOFR and the date are carried explicitly: they
    // are the two values that would otherwise be read from live state on a
    // re-render, and they are what makes a regenerated memo disagree with
    // the one taken to committee.
    const model = {
      summaryText, inputs, metrics, riskScore, recommendation, screeningResult,
      orgName, analystName, moduleLabel: moduleLabel || 'Equipment Finance', branding,
      moduleKey, factors, structure, stressResults, borrowerExtras, criteria,
      commentary, sourceDocuments,
      sofr, sofrDate, generatedAt: new Date().toISOString(),
    };
    const html = generateBrandedPdfHtml(model);

    setPdfLoading(true);
    try {
      const html2pdf = (await import('html2pdf.js')).default;
      // Match html2pdf's capture container exactly, so the memo is
      // laid out at the width it is printed at and nothing is scaled
      // or clipped. Kept off-screen rather than in flow: it was
      // previously appended visibly at full width for the duration of
      // the render.
      //
      // The offscreen positioning belongs on the wrapper, not on the node
      // handed to html2pdf. html2pdf deep-clones that node into its own
      // container, where a positioned element is out of flow and measures
      // zero high, and the memo came out as one blank page.
      const wrapper = document.createElement('div');
      wrapper.style.position = 'fixed';
      wrapper.style.left = '-10000px';
      wrapper.style.top = '0';
      wrapper.style.width = `${CONTENT_PX}px`;

      const container = document.createElement('div');
      container.className = MEMO_SCOPE;
      container.innerHTML = memoCaptureMarkup(html);
      container.style.width = `${CONTENT_PX}px`;
      wrapper.appendChild(container);
      document.body.appendChild(wrapper);

      const companyName = (inputs?.companyName || 'Deal').replace(/[^a-zA-Z0-9]/g, '_');
      const date = new Date().toISOString().slice(0, 10);

      await html2pdf().set({
        margin: [MARGIN_Y_MM, MARGIN_X_MM, MARGIN_Y_MM, MARGIN_X_MM],
        filename: `${companyName}_screening_memo_${date}.pdf`,
        image: { type: 'jpeg', quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true, onclone: (doc) => stripAppStylesForCapture(doc) },
        // Letter, not A4. The stylesheet's @page always said letter;
        // this is the half that disagreed, so every memo came out on
        // the wrong paper size for a US credit committee.
        jsPDF: { unit: 'mm', format: 'letter', orientation: 'portrait' },
        pagebreak: { mode: ['css', 'legacy'] },
      }).from(container).save();

      document.body.removeChild(wrapper);

      // Only after the download succeeded. A failed export should not leave a
      // memo in the record that nobody ever held. Storage failing is logged
      // and swallowed: the analyst has their PDF either way, and a thrown
      // error here would read as a failed export.
      if (pipelineDealId && userId && profile?.org_id) {
        try {
          const { data, duplicate, error } = await createMemoSnapshot({
            dealId: pipelineDealId,
            orgId: profile.org_id,
            userId,
            assetClass: moduleKey || 'equipment_finance',
            model,
            html,
            appVersion: APP_VERSION,
          });
          if (error) console.warn('Memo snapshot failed:', error);
          else if (data && onMemoSaved) onMemoSaved(data);
          else if (duplicate && onMemoSaved) onMemoSaved(null);
        } catch (snapErr) {
          console.warn('Memo snapshot failed:', snapErr);
        }
      }
    } catch (err) {
      // Fallback to print dialog if html2pdf fails
      console.warn('PDF generation failed, falling back to print:', err);
      const w = window.open('', '_blank');
      w.document.write(html);
      w.document.close();
      w.focus();
      setTimeout(() => w.print(), 400);
    } finally {
      setPdfLoading(false);
    }
  };

  const btnBase = 'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5';
  const btnDefault = 'bg-white/[0.03] border-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/[0.08]';
  const btnCopied = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  const btnPdf = 'bg-gray-100 border-gray-200 text-gray-600 hover:text-gray-700 hover:border-gray-300';

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleCopy} className={`${btnBase} ${copied ? btnCopied : btnDefault}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {copied ? 'Copied!' : 'Copy Summary'}
      </button>
      <button onClick={handleDownloadPdf} disabled={pdfLoading} className={`${btnBase} ${btnPdf} ${pdfLoading ? 'opacity-50 cursor-not-allowed' : ''}`}>
        {pdfLoading ? (
          <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="12" y1="18" x2="12" y2="12"/>
            <polyline points="9 15 12 18 15 15"/>
          </svg>
        )}
        {pdfLoading ? 'Generating...' : 'Download PDF'}
      </button>
      {metrics && riskScore && (
        <button
          onClick={() => exportScreeningCsv(inputs, metrics, riskScore, recommendation, screeningResult)}
          className={`${btnBase} ${btnDefault}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="7 10 12 15 17 10"/>
            <line x1="12" y1="15" x2="12" y2="3"/>
          </svg>
          Export CSV
        </button>
      )}
      <button onClick={handlePrint} className={`${btnBase} ${btnDefault}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9V2h12v7"/>
          <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/>
          <rect x="6" y="14" width="12" height="8"/>
        </svg>
        Print Report
      </button>
    </div>
  );
}
