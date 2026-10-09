// "How the numbers were built", the committee memo section for a deal built
// from statement line items. The memo names its sources (methodology doc,
// section 12): each built figure with its formula and page citations, the
// treatment rules applied and any override with its reason, the add-backs
// accepted and rejected, the gap check, and who confirmed the judgments.
// Empty for a deal without statements.

import { statementState, BUILT_FIELDS } from '../lib/statementBuild';
import { BUILT_FIELD_LABELS, TREATMENT_COPY, money, formulaWithValues } from './statementFormat';

function esc(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;

export function buildStatementsMemoHtml(inputs, treatmentRules) {
  const state = statementState(inputs, treatmentRules);
  const build = state.build;
  if (!build) return '';
  const f = inputs.financials;
  const fieldOverrides = f.fieldOverrides || {};
  const treatmentOverrides = f.treatmentOverrides || {};

  const rows = BUILT_FIELDS.map((field) => {
    const d = build.derivations[field];
    const o = fieldOverrides[field];
    let how;
    if (o) how = `Typed by analyst, overriding the build. Reason: ${esc(o.reason)}`;
    else if (d.value !== null) how = `${esc(formulaWithValues(d))}${d.estimate ? ' <span style="color:#92400e">(estimate)</span>' : ''}`;
    else if (inputs[field] !== null && inputs[field] !== undefined && inputs[field] !== '' && inputs[field] !== 0) how = '<span style="color:#64748b">Typed, not built from statements</span>';
    else how = '<span style="color:#64748b">Not provided</span>';
    const value = o || d.value === null ? inputs[field] : d.value;
    return `<tr><td style="width:150px">${esc(BUILT_FIELD_LABELS[field])}</td><td style="text-align:right;font-weight:600;width:80px;font-family:'IBM Plex Mono',ui-monospace,monospace">${value === null || value === undefined || value === '' ? '' : esc(money(Number(value)))}</td><td style="font-size:11.5px;color:#334155">${how}</td></tr>`;
  }).join('');

  const treatments = build.judgments
    .filter((j) => j.id.startsWith('treatment.'))
    .map((j) => {
      const row = j.id.slice('treatment.'.length);
      const copy = TREATMENT_COPY[row];
      const o = treatmentOverrides[row];
      const rule = copy?.options[j.value]?.label || j.value;
      return `<li>${esc(copy?.label || row)}: ${esc(rule)}${o ? `, overridden for this deal. Reason: ${esc(o.reason)}` : ', firm rule'}</li>`;
    }).join('');

  const addBacks = (f.adjustedEbitda?.addBacks || []).filter((a) => a.amount !== null && a.amount !== undefined);
  const addBackHtml = addBacks.length ? `
    <div style="font-size:12px;color:#1f2937;margin-top:8px"><strong>Add-backs</strong> (${addBacks.filter((a) => a.decision === 'accepted').length} of ${addBacks.length} accepted)</div>
    <ul style="margin:2px 0 0;padding-left:18px;font-size:11.5px;color:#334155">
      ${addBacks.map((a) => `<li>${esc(a.label || 'Unnamed')} ${esc(money(a.amount))}: ${a.decision === 'accepted' ? 'accepted' : a.decision === 'rejected' ? 'rejected' : 'not reviewed, excluded'}</li>`).join('')}
    </ul>` : '';

  const comparisons = build.comparisons.map((c) => `<li>Built ${esc(money(c.built))} against ${esc(c.companyLabel)} ${esc(money(c.company))}. Gap ${esc(money(c.gap))}${c.against === 'adjusted' ? `, add-backs ${esc(money(c.explainedByAddBacks))}` : ''}${c.explainedByTreatment ? `, treatment ${esc(money(c.explainedByTreatment))}` : ''}, unexplained ${esc(money(c.unexplained))}${c.unexplainedPct != null ? ` (${pct(c.unexplainedPct)} of built)` : ''}. Caveat above ${pct(c.tolerance).replace('.0%', '%')}, firm policy.</li>`).join('');

  const judgments = build.judgments;
  const confirmed = judgments.filter((j) => j.confirmed).length;
  const confirmers = Array.from(new Set(Object.values(f.judgments || {}).map((j) => j?.by).filter(Boolean)));
  const judgmentLine = judgments.length === 0
    ? ''
    : confirmed === judgments.length
      ? `All ${judgments.length} judgments confirmed${confirmers.length ? ` by ${esc(confirmers.join(', '))}` : ''}.`
      : `<span style="color:#92400e">${judgments.length - confirmed} of ${judgments.length} judgments not confirmed.</span>`;

  const notes = [...build.caveats.filter((c) => !c.startsWith('Proposed, not confirmed')), ...state.pairingCaveats];

  return `<div class="section">
    <div class="section-title">How the Numbers Were Built</div>
    <div style="font-size:12px;color:#334155;margin-bottom:6px">
      ${esc(build.derivations.ebitda.label)}.${f.fiscalYearEnd ? ` Fiscal year ended ${esc(f.fiscalYearEnd)}.` : ''} ${judgmentLine}
    </div>
    <table><tbody>${rows}</tbody></table>
    ${treatments ? `<div style="font-size:12px;color:#1f2937;margin-top:8px"><strong>Treatment</strong></div><ul style="margin:2px 0 0;padding-left:18px;font-size:11.5px;color:#334155">${treatments}</ul>` : ''}
    ${addBackHtml}
    ${comparisons ? `<ul style="margin:6px 0 0;padding-left:18px;font-size:11.5px;color:#334155">${comparisons}</ul>` : ''}
    ${notes.length ? `<div style="font-size:12px;color:#1f2937;margin-top:8px"><strong>Notes</strong></div><ul style="margin:2px 0 0;padding-left:18px;font-size:11.5px;color:#475569">${notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul>` : ''}
  </div>`;
}
