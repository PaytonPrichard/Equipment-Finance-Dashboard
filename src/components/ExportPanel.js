import React, { useState } from 'react';
import { exportScreeningCsv } from '../utils/csvExport';

function esc(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// eslint-disable-next-line no-unused-vars
function parseSummaryToPdfHtml(summaryText, inputs) {
  const lines = summaryText.split('\n');
  const companyName = inputs?.companyName || 'N/A';

  // Parse sections from the structured summaryText
  const sections = [];
  let currentSection = null;
  let screeningResult = {};

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip the plain-text title lines and separator lines
    if (trimmed === 'EQUIPMENT FINANCE DEAL SCREENING') continue;
    if (trimmed === 'PRELIMINARY ASSESSMENT') continue;
    if (/^[=]+$/.test(trimmed)) continue;
    if (trimmed === '') continue;

    // Detect section headers (lines that are ALL CAPS followed by a dashed line, or preceded by one)
    if (/^[-]+$/.test(trimmed)) {
      // Check if next line is a section header
      const nextLine = (lines[i + 1] || '').trim();
      const lineAfter = (lines[i + 2] || '').trim();
      if (nextLine && !/^[-]+$/.test(nextLine) && /^[-]+$/.test(lineAfter)) {
        // nextLine is the header, lineAfter is the closing dashes
        currentSection = { title: nextLine, lines: [] };
        sections.push(currentSection);
        i += 2; // skip header and closing dashes
        continue;
      } else if (nextLine && !/^[-]+$/.test(nextLine)) {
        currentSection = { title: nextLine, lines: [] };
        sections.push(currentSection);
        i += 1;
        continue;
      }
      continue;
    }

    // Collect content into current section
    if (currentSection) {
      currentSection.lines.push(line);
    } else {
      // Lines before the first section (deal info header)
      if (!sections.length || sections[0].title !== '_HEADER_') {
        sections.unshift({ title: '_HEADER_', lines: [] });
        currentSection = sections[0];
      }
      sections[0].lines.push(line);
    }
  }

  // Extract screening result from the SCREENING RESULT section
  const screeningSection = sections.find(s => s.title === 'SCREENING RESULT');
  if (screeningSection) {
    for (const line of screeningSection.lines) {
      const scoreMatch = line.match(/Risk Score:\s*(\d+)\/100\s*-\s*(.+)/);
      if (scoreMatch) {
        screeningResult.score = scoreMatch[1];
        screeningResult.category = scoreMatch[2].trim();
      }
      const recMatch = line.match(/Recommendation:\s*(.+)/);
      if (recMatch) {
        screeningResult.recommendation = recMatch[1].trim();
      }
    }
  }

  // Determine score color
  const scoreNum = parseInt(screeningResult.score || '0', 10);
  let scoreColor = '#dc2626'; // red
  let scoreBg = '#fef2f2';
  if (scoreNum >= 70) { scoreColor = '#16a34a'; scoreBg = '#f0fdf4'; }
  else if (scoreNum >= 50) { scoreColor = '#ca8a04'; scoreBg = '#fefce8'; }
  else if (scoreNum >= 35) { scoreColor = '#ea580c'; scoreBg = '#fff7ed'; }

  // Build header info rows from _HEADER_ section
  const headerSection = sections.find(s => s.title === '_HEADER_');
  const headerRows = (headerSection?.lines || []).map(l => {
    const colonIdx = l.indexOf(':');
    if (colonIdx > 0) {
      const label = l.substring(0, colonIdx).trim();
      const value = l.substring(colonIdx + 1).trim();
      return `<tr><td style="padding:4px 16px 4px 0;color:#64748b;font-size:12px;white-space:nowrap">${esc(label)}</td><td style="padding:4px 0;font-size:12px;font-weight:500">${esc(value)}</td></tr>`;
    }
    return '';
  }).join('');

  // Build section HTML
  function renderSection(section) {
    if (section.title === '_HEADER_' || section.title === 'SCREENING RESULT') return '';
    if (section.title === 'DISCLAIMER: Preliminary screening only. Not a credit decision.') return '';

    const title = esc(section.title);

    // KEY METRICS and DEBT SERVICE: render as table
    if (section.title === 'KEY METRICS' || section.title === 'DEBT SERVICE') {
      const rows = section.lines.map(l => {
        const colonIdx = l.indexOf(':');
        if (colonIdx > 0) {
          const label = l.substring(0, colonIdx).trim();
          let value = l.substring(colonIdx + 1).trim();
          // Extract parenthetical notes
          const noteMatch = value.match(/^(.+?)\s+(\(.+\))$/);
          let note = '';
          if (noteMatch) {
            value = noteMatch[1];
            note = noteMatch[2];
          }
          // Flag warnings
          const flagMatch = value.match(/^(.+?)\s+(\*\*.+\*\*)$/);
          let flag = '';
          if (flagMatch) {
            value = flagMatch[1];
            flag = flagMatch[2].replace(/\*/g, '');
          }
          return `<tr>
            <td style="padding:6px 16px 6px 0;color:#475569;font-size:12px;border-bottom:1px solid #f1f5f9">${esc(label)}</td>
            <td style="padding:6px 8px 6px 0;font-size:12px;font-weight:600;border-bottom:1px solid #f1f5f9;text-align:right">${esc(value)}</td>
            <td style="padding:6px 0;font-size:10px;color:#94a3b8;border-bottom:1px solid #f1f5f9">${esc(note)}${flag ? '<span style="color:#dc2626;font-weight:600"> ' + esc(flag) + '</span>' : ''}</td>
          </tr>`;
        }
        return '';
      }).join('');
      return `<div style="margin-bottom:20px">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #d4a843">${title}</h3>
        <table style="width:100%;border-collapse:collapse">${rows}</table>
      </div>`;
    }

    // STRESS TEST: render as formatted table
    if (section.title === 'STRESS TEST') {
      const rows = section.lines.map(l => {
        const match = l.match(/^(.+?)\s{2,}EBITDA:\s*(\S+)\s{2,}DSCR:\s*(\S+)(.*)$/);
        if (match) {
          const scenario = match[1].trim();
          const ebitda = match[2].trim();
          const dscr = match[3].trim();
          const flag = (match[4] || '').replace(/\*/g, '').trim();
          const dscrNum = parseFloat(dscr);
          let dscrColor = '#16a34a';
          if (dscrNum < 1.0) dscrColor = '#dc2626';
          else if (dscrNum < 1.25) dscrColor = '#ea580c';
          return `<tr>
            <td style="padding:6px 12px 6px 0;font-size:12px;border-bottom:1px solid #f1f5f9">${esc(scenario)}</td>
            <td style="padding:6px 12px 6px 0;font-size:12px;text-align:right;border-bottom:1px solid #f1f5f9">${esc(ebitda)}</td>
            <td style="padding:6px 0;font-size:12px;text-align:right;font-weight:600;color:${dscrColor};border-bottom:1px solid #f1f5f9">${esc(dscr)}${flag ? ' <span style="font-size:10px;font-weight:400;color:#dc2626">' + esc(flag) + '</span>' : ''}</td>
          </tr>`;
        }
        return '';
      }).join('');
      return `<div style="margin-bottom:20px">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #d4a843">${title}</h3>
        <table style="width:100%;border-collapse:collapse">
          <thead><tr>
            <th style="padding:6px 12px 6px 0;font-size:11px;color:#64748b;text-align:left;border-bottom:2px solid #e2e8f0">Scenario</th>
            <th style="padding:6px 12px 6px 0;font-size:11px;color:#64748b;text-align:right;border-bottom:2px solid #e2e8f0">EBITDA</th>
            <th style="padding:6px 0;font-size:11px;color:#64748b;text-align:right;border-bottom:2px solid #e2e8f0">DSCR</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
    }

    // ASSESSMENT NOTES: numbered list
    if (section.title === 'ASSESSMENT NOTES') {
      const items = section.lines.map(l => {
        const m = l.match(/^\d+\.\s*(.+)/);
        if (m) return `<li style="margin-bottom:4px;font-size:12px;color:#334155">${esc(m[1])}</li>`;
        return '';
      }).join('');
      return `<div style="margin-bottom:20px">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #d4a843">${title}</h3>
        <ol style="margin:0;padding-left:20px">${items}</ol>
      </div>`;
    }

    // SUGGESTED ENHANCEMENTS: bullet list
    if (section.title === 'SUGGESTED ENHANCEMENTS') {
      const items = section.lines.map(l => {
        const m = l.match(/^-\s*(.+)/);
        if (m) return `<li style="margin-bottom:4px;font-size:12px;color:#334155">${esc(m[1])}</li>`;
        return '';
      }).join('');
      if (!items) return '';
      return `<div style="margin-bottom:20px">
        <h3 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #d4a843">${title}</h3>
        <ul style="margin:0;padding-left:20px">${items}</ul>
      </div>`;
    }

    // Default: render lines as paragraphs
    const content = section.lines.map(l => `<p style="margin:2px 0;font-size:12px;color:#334155">${esc(l)}</p>`).join('');
    return `<div style="margin-bottom:20px">
      <h3 style="font-size:13px;font-weight:700;color:#1e293b;text-transform:uppercase;letter-spacing:0.05em;margin:0 0 8px 0;padding-bottom:6px;border-bottom:2px solid #d4a843">${title}</h3>
      ${content}
    </div>`;
  }

  const sectionHtml = sections.map(renderSection).join('');

  // Extract disclaimer from the last section or raw text
  const disclaimerSection = sections.find(s => s.title.startsWith('DISCLAIMER'));
  let disclaimerText = 'Preliminary screening only. Not a credit decision. Final terms subject to full underwriting, credit committee approval, and documentation.';
  if (disclaimerSection) {
    disclaimerText = disclaimerSection.title.replace('DISCLAIMER: ', '') + ' ' + disclaimerSection.lines.join(' ');
  }

  // Find generated date from raw text
  const dateMatch = summaryText.match(/Generated:\s*(.+)/);
  const generatedDate = dateMatch ? dateMatch[1].trim() : new Date().toLocaleDateString();

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Equipment Finance Deal Screening - ${esc(companyName)}</title>
<style>
  @page {
    margin: 0.6in 0.7in;
    size: letter;
  }
  @media print {
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .no-print { display: none !important; }
  }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
    color: #1e293b;
    background: #fff;
    margin: 0;
    padding: 0;
    line-height: 1.5;
    font-size: 12px;
  }
  .page {
    max-width: 780px;
    margin: 0 auto;
    padding: 20px 0;
  }
  .header {
    border-bottom: 3px solid #d4a843;
    padding-bottom: 16px;
    margin-bottom: 20px;
  }
  .header h1 {
    font-size: 22px;
    font-weight: 800;
    color: #1e293b;
    margin: 0 0 2px 0;
  }
  .header .subtitle {
    font-size: 13px;
    color: #64748b;
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }
  .score-banner {
    display: flex;
    align-items: center;
    justify-content: space-between;
    background: ${scoreBg};
    border: 1px solid ${scoreColor}33;
    border-left: 4px solid ${scoreColor};
    border-radius: 6px;
    padding: 14px 20px;
    margin-bottom: 20px;
  }
  .score-badge {
    display: inline-flex;
    align-items: baseline;
    gap: 4px;
  }
  .score-number {
    font-size: 32px;
    font-weight: 800;
    color: ${scoreColor};
    line-height: 1;
  }
  .score-max {
    font-size: 14px;
    font-weight: 600;
    color: ${scoreColor}aa;
  }
  .score-label {
    font-size: 14px;
    font-weight: 700;
    color: ${scoreColor};
    margin-left: 12px;
  }
  .score-rec {
    font-size: 12px;
    color: #475569;
    max-width: 400px;
    text-align: right;
  }
  .deal-info {
    margin-bottom: 20px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px 16px;
  }
  .footer {
    margin-top: 24px;
    padding-top: 12px;
    border-top: 1px solid #e2e8f0;
    font-size: 10px;
    color: #94a3b8;
    text-align: center;
  }
  table { border-collapse: collapse; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <h1>${esc(companyName)}</h1>
    <div class="subtitle">Equipment Finance Deal Screening &mdash; Preliminary Assessment</div>
  </div>

  <div class="score-banner">
    <div style="display:flex;align-items:center">
      <div class="score-badge">
        <span class="score-number">${esc(screeningResult.score || 'N/A')}</span>
        <span class="score-max">/100</span>
      </div>
      <span class="score-label">${esc(screeningResult.category || '')}</span>
    </div>
    <div class="score-rec">${esc(screeningResult.recommendation || '')}</div>
  </div>

  <div class="deal-info">
    <table style="width:100%">${headerRows}</table>
  </div>

  ${sectionHtml}

  <div class="footer">
    <p style="margin:0 0 2px 0">${esc(disclaimerText)}</p>
    <p style="margin:0">Generated: ${esc(generatedDate)}</p>
  </div>
</div>
</body>
</html>`;
}

function generateBrandedPdfHtml({ summaryText, inputs, metrics, riskScore, recommendation, screeningResult, orgName, analystName, moduleLabel, branding }) {
  const companyName = inputs?.companyName || 'N/A';
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const score = riskScore?.composite ?? 0;
  const verdict = screeningResult?.verdict?.toUpperCase() || '';
  const b = branding || {};
  const accentColor = b.accentColor || '#d4a843';
  const logoUrl = b.logoUrl || '';
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

  // Build key metrics table based on what's available
  const metricRows = [];
  if (metrics?.dscr !== undefined) metricRows.push(['DSCR', fmtRatio(metrics.dscr), metrics.dscr >= 1.25 ? '#16a34a' : metrics.dscr >= 1.0 ? '#ca8a04' : '#dc2626']);
  if (metrics?.leverage !== undefined) metricRows.push(['Leverage', fmtRatio(metrics.leverage), metrics.leverage <= 3.5 ? '#16a34a' : metrics.leverage <= 5.0 ? '#ca8a04' : '#dc2626']);
  if (metrics?.ltv !== undefined) metricRows.push(['LTV', fmtPct(metrics.ltv), metrics.ltv <= 0.85 ? '#16a34a' : metrics.ltv <= 1.0 ? '#ca8a04' : '#dc2626']);
  if (metrics?.termCoverage !== undefined) metricRows.push(['Term Coverage', metrics.termCoverage.toFixed(0) + '%', metrics.termCoverage <= 80 ? '#16a34a' : '#dc2626']);
  if (metrics?.borrowingBase !== undefined) metricRows.push(['Borrowing Base', fmtCurrency(metrics.borrowingBase), '#334155']);
  if (metrics?.dso !== undefined) metricRows.push(['DSO', Math.round(metrics.dso) + ' days', metrics.dso <= 60 ? '#16a34a' : '#ca8a04']);
  if (metrics?.concentrationRisk !== undefined) metricRows.push(['Concentration', fmtPct(metrics.concentrationRisk), metrics.concentrationRisk <= 0.25 ? '#16a34a' : '#dc2626']);
  if (metrics?.turnoverRatio !== undefined) metricRows.push(['Turnover', fmtRatio(metrics.turnoverRatio), metrics.turnoverRatio >= 4 ? '#16a34a' : '#ca8a04']);
  if (metrics?.obsolescenceRate !== undefined) metricRows.push(['Obsolescence', fmtPct(metrics.obsolescenceRate), metrics.obsolescenceRate <= 0.10 ? '#16a34a' : '#dc2626']);

  const rate = metrics?.rate || metrics?.effectiveRate || 0;

  // Parse commentary and structure from summaryText
  const lines = summaryText.split('\n');
  const commentaryLines = [];
  const structureLines = [];
  let inCommentary = false, inStructure = false;
  for (const line of lines) {
    if (line.includes('ASSESSMENT NOTES')) { inCommentary = true; inStructure = false; continue; }
    if (line.includes('STRESS TEST') || line.includes('FACILITY STRUCTURE') || line.includes('SUGGESTED ENHANCEMENTS')) { inCommentary = false; }
    if (line.includes('FACILITY STRUCTURE') || line.includes('STRUCTURE')) { inStructure = true; inCommentary = false; continue; }
    if (line.includes('ASSESSMENT NOTES') || line.includes('STRESS TEST') || line.includes('DISCLAIMER')) { inStructure = false; }
    if (inCommentary && line.trim() && !/^[-=]+$/.test(line.trim())) commentaryLines.push(line.trim());
    if (inStructure && line.trim() && !/^[-=]+$/.test(line.trim())) structureLines.push(line.trim());
  }

  // Verdict reasons
  const reasonsHtml = (screeningResult?.reasons || []).map(r => {
    const color = r.level === 'fail' ? '#dc2626' : '#ca8a04';
    const icon = r.level === 'fail' ? '&#10005;' : '&#9888;';
    return `<div style="display:flex;gap:6px;align-items:flex-start;margin-bottom:4px"><span style="color:${color};font-size:11px;flex-shrink:0">${icon}</span><span style="font-size:11px;color:#475569">${esc(r.text)}</span></div>`;
  }).join('');

  const brandingHeader = orgName || logoUrl
    ? `<div style="text-align:right">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="${esc(orgName)}" style="max-height:40px;max-width:180px;margin-bottom:4px" />` : ''}
        ${orgName ? `<div style="font-size:11px;color:#94a3b8;text-transform:uppercase;letter-spacing:0.1em;font-weight:600">${esc(orgName)}</div>` : ''}
      </div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<title>Screening Memo — ${esc(companyName)}</title>
<style>
  @page { margin: 0.6in 0.7in; size: letter; }
  @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  * { box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; color: #1e293b; background: #fff; margin: 0; padding: 0; line-height: 1.5; font-size: 12px; }
  .page { max-width: 780px; margin: 0 auto; padding: 24px 0; }
  .header { border-bottom: 3px solid ${accentColor}; padding-bottom: 16px; margin-bottom: 24px; display: flex; justify-content: space-between; align-items: flex-end; }
  .section { margin-bottom: 20px; }
  .section-title { font-size: 12px; font-weight: 700; color: #1e293b; text-transform: uppercase; letter-spacing: 0.06em; margin: 0 0 10px 0; padding-bottom: 6px; border-bottom: 2px solid ${accentColor}; }
  table { width: 100%; border-collapse: collapse; }
  td, th { padding: 5px 12px 5px 0; font-size: 11px; border-bottom: 1px solid #f1f5f9; }
  th { text-align: left; color: #64748b; font-weight: 600; border-bottom: 2px solid #e2e8f0; }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div style="font-size:10px;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;font-weight:600;margin-bottom:4px">${esc(memoTitle || moduleLabel + ' Screening')}</div>
      <h1 style="font-size:22px;font-weight:800;color:#1e293b;margin:0">${esc(companyName)}</h1>
      <div style="font-size:11px;color:#64748b;margin-top:2px">${esc(date)}${analystName ? ' &middot; ' + esc(analystName) : ''}</div>
    </div>
    ${brandingHeader}
  </div>

  <!-- Score + Verdict Banner -->
  <div style="display:flex;gap:12px;margin-bottom:24px">
    <div style="flex:1;background:${scoreBg};border:1px solid ${scoreBorder};border-left:4px solid ${scoreColor};border-radius:6px;padding:14px 20px;display:flex;align-items:center;gap:12px">
      <div>
        <span style="font-size:32px;font-weight:800;color:${scoreColor};line-height:1">${score}</span>
        <span style="font-size:13px;font-weight:600;color:${scoreColor}aa">/100</span>
      </div>
      <div>
        <div style="font-size:13px;font-weight:700;color:${scoreColor}">${esc(recommendation?.category || '')}</div>
        <div style="font-size:11px;color:#475569">${esc(recommendation?.detail || '')}</div>
      </div>
    </div>
    ${verdict ? `<div style="background:${verdictBg};border:1px solid ${verdictColor}33;border-radius:6px;padding:14px 20px;display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:80px">
      <div style="font-size:16px;font-weight:800;color:${verdictColor};letter-spacing:0.1em">${verdict}</div>
    </div>` : ''}
  </div>

  ${reasonsHtml ? `<div style="margin-bottom:20px;padding:10px 14px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px">${reasonsHtml}</div>` : ''}

  <!-- Deal Overview -->
  <div class="section">
    <div class="section-title">Deal Overview</div>
    <table>
      <tr><td style="color:#64748b;width:140px">Industry</td><td style="font-weight:500">${esc(inputs?.industrySector || '')}</td></tr>
      <tr><td style="color:#64748b">Credit Rating</td><td style="font-weight:500">${esc(inputs?.creditRating || '')}</td></tr>
      <tr><td style="color:#64748b">Annual Revenue</td><td style="font-weight:500">${fmtCurrency(inputs?.annualRevenue)}</td></tr>
      <tr><td style="color:#64748b">EBITDA</td><td style="font-weight:500">${fmtCurrency(inputs?.ebitda)}</td></tr>
      <tr><td style="color:#64748b">Existing Debt</td><td style="font-weight:500">${fmtCurrency(inputs?.totalExistingDebt)}</td></tr>
      ${inputs?.yearsInBusiness ? `<tr><td style="color:#64748b">Years in Business</td><td style="font-weight:500">${inputs.yearsInBusiness}</td></tr>` : ''}
      <tr><td style="color:#64748b">Screening Rate</td><td style="font-weight:500">${(rate * 100).toFixed(2)}%</td></tr>
    </table>
  </div>

  <!-- Key Metrics -->
  <div class="section">
    <div class="section-title">Key Metrics</div>
    <table>
      <thead><tr><th>Metric</th><th style="text-align:right">Value</th><th>Status</th></tr></thead>
      <tbody>
        ${metricRows.map(([label, value, color]) => `<tr><td>${esc(label)}</td><td style="text-align:right;font-weight:600;font-family:monospace">${esc(value)}</td><td><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span></td></tr>`).join('')}
      </tbody>
    </table>
  </div>

  <!-- Assessment -->
  ${commentaryLines.length > 0 ? `<div class="section">
    <div class="section-title">Assessment</div>
    <ol style="margin:0;padding-left:20px">
      ${commentaryLines.map(l => { const m = l.match(/^\d+\.\s*(.*)/); return `<li style="margin-bottom:6px;font-size:11px;color:#334155">${esc(m ? m[1] : l)}</li>`; }).join('')}
    </ol>
  </div>` : ''}

  <!-- Structure -->
  ${structureLines.length > 0 ? `<div class="section">
    <div class="section-title">Suggested Structure</div>
    ${structureLines.map(l => {
      if (l.startsWith('-') || l.startsWith('*')) return `<div style="padding-left:12px;font-size:11px;color:#334155;margin-bottom:3px">&bull; ${esc(l.replace(/^[-*]\s*/, ''))}</div>`;
      const colonIdx = l.indexOf(':');
      if (colonIdx > 0 && colonIdx < 25) return `<div style="font-size:11px;margin-bottom:3px"><span style="color:#64748b">${esc(l.substring(0, colonIdx))}:</span> <span style="color:#1e293b;font-weight:500">${esc(l.substring(colonIdx + 1).trim())}</span></div>`;
      return `<p style="font-size:11px;color:#334155;margin:0 0 6px 0">${esc(l)}</p>`;
    }).join('')}
  </div>` : ''}

  <!-- Footer -->
  <div style="margin-top:30px;padding-top:12px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center">
    <div style="font-size:9px;color:#94a3b8;max-width:500px">
      Preliminary screening only. Not a credit decision. Final terms subject to full underwriting, credit committee approval, and documentation.
    </div>
    <div style="font-size:9px;color:#94a3b8;text-align:right">
      ${footerText ? '<div>' + esc(footerText) + '</div>' : ''}
      ${orgName ? esc(orgName) + ' &middot; ' : ''}${esc(date)}
    </div>
  </div>
</div>
</body>
</html>`;
}

export default function ExportPanel({ summaryText, inputs, metrics, riskScore, recommendation, screeningResult, profile, moduleLabel }) {
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

  const handleDownloadPdf = () => {
    const orgName = profile?.organizations?.name || '';
    const analystName = profile?.full_name || profile?.email || '';
    const branding = profile?.organizations?.branding || {};
    const html = generateBrandedPdfHtml({
      summaryText, inputs, metrics, riskScore, recommendation, screeningResult,
      orgName, analystName, moduleLabel: moduleLabel || 'Equipment Finance', branding,
    });
    const w = window.open('', '_blank');
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 400);
  };

  const btnBase = 'px-3 py-1.5 rounded-lg text-[11px] font-medium border transition-all flex items-center gap-1.5';
  const btnDefault = 'bg-white/[0.03] border-white/[0.04] text-slate-400 hover:text-slate-200 hover:border-white/[0.08]';
  const btnCopied = 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400';
  const btnPdf = 'bg-gold-500/[0.07] border-gold-500/20 text-gold-400 hover:text-gold-300 hover:border-gold-500/40';

  return (
    <div className="flex items-center gap-2">
      <button onClick={handleCopy} className={`${btnBase} ${copied ? btnCopied : btnDefault}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        {copied ? 'Copied!' : 'Copy Summary'}
      </button>
      <button onClick={handleDownloadPdf} className={`${btnBase} ${btnPdf}`}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
          <polyline points="14 2 14 8 20 8"/>
          <line x1="12" y1="18" x2="12" y2="12"/>
          <polyline points="9 15 12 18 15 15"/>
        </svg>
        Download PDF
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
