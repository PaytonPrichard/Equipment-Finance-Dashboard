// ============================================================
// CSV Export Utility
// ============================================================

/**
 * Escape a CSV cell value. Wraps in quotes if it contains commas, quotes, or newlines.
 */
function escapeCell(value) {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

/**
 * Convert an array of objects to a CSV string.
 * @param {Array<Object>} rows — data rows
 * @param {Array<{key: string, label: string}>} columns — column definitions
 */
export function toCsv(rows, columns) {
  const header = columns.map(c => escapeCell(c.label)).join(',');
  const body = rows.map(row =>
    columns.map(c => escapeCell(typeof c.key === 'function' ? c.key(row) : row[c.key])).join(',')
  ).join('\n');
  return header + '\n' + body;
}

/**
 * Trigger a CSV file download in the browser.
 */
export function downloadCsv(csvString, filename) {
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export a single screening result as CSV.
 */
export function exportScreeningCsv(inputs, metrics, riskScore, recommendation, verdict) {
  const fmtCurrency = (v) => v ? `$${Math.round(v).toLocaleString()}` : '$0';
  const fmtPct = (v) => v !== undefined ? `${(v * 100).toFixed(1)}%` : '';
  const fmtRatio = (v) => v !== undefined ? `${v.toFixed(2)}x` : '';

  const columns = [
    { key: 'label', label: 'Metric' },
    { key: 'value', label: 'Value' },
  ];

  const rows = [
    { label: 'Company', value: inputs.companyName || 'N/A' },
    { label: 'Industry', value: inputs.industrySector },
    { label: 'Credit Rating', value: inputs.creditRating },
    { label: 'Years in Business', value: inputs.yearsInBusiness || 'N/A' },
    { label: 'Annual Revenue', value: fmtCurrency(inputs.annualRevenue) },
    { label: 'EBITDA', value: fmtCurrency(inputs.ebitda) },
    { label: 'Existing Debt', value: fmtCurrency(inputs.totalExistingDebt) },
    { label: '', value: '' },
    { label: 'Risk Score', value: `${riskScore.composite}/100` },
    { label: 'Recommendation', value: recommendation?.category || '' },
    { label: 'Screening Verdict', value: verdict?.verdict?.toUpperCase() || 'N/A' },
    ...(verdict?.reasons?.length ? verdict.reasons.map((r, i) => ({ label: `Verdict Reason ${i + 1}`, value: r.text })) : []),
    { label: '', value: '' },
    { label: 'DSCR', value: fmtRatio(metrics.dscr) },
    { label: 'Leverage', value: fmtRatio(metrics.leverage) },
    { label: 'Screening Rate', value: metrics.rate ? `${(metrics.rate * 100).toFixed(2)}%` : metrics.effectiveRate ? `${(metrics.effectiveRate * 100).toFixed(2)}%` : '' },
    { label: 'Annual DS (New)', value: fmtCurrency(metrics.newAnnualDebtService) },
    { label: 'Annual DS (Existing)', value: fmtCurrency(metrics.existingDebtService) },
  ];

  // Add module-specific rows
  if (metrics.ltv !== undefined) {
    rows.push({ label: 'LTV', value: fmtPct(metrics.ltv) });
    rows.push({ label: 'Term Coverage', value: `${metrics.termCoverage?.toFixed(0)}%` });
    rows.push({ label: 'Net Financed', value: fmtCurrency(metrics.netFinanced) });
  }
  if (metrics.borrowingBase !== undefined) {
    rows.push({ label: 'Borrowing Base', value: fmtCurrency(metrics.borrowingBase) });
  }
  if (metrics.dso !== undefined) {
    rows.push({ label: 'DSO', value: `${Math.round(metrics.dso)} days` });
    rows.push({ label: 'Concentration', value: fmtPct(metrics.concentrationRisk) });
    rows.push({ label: 'Dilution Rate', value: fmtPct(metrics.dilutionRate) });
  }
  if (metrics.turnoverRatio !== undefined) {
    rows.push({ label: 'Turnover', value: fmtRatio(metrics.turnoverRatio) });
    rows.push({ label: 'Days on Hand', value: `${Math.round(metrics.daysOnHand || 0)}` });
    rows.push({ label: 'Obsolescence', value: fmtPct(metrics.obsolescenceRate) });
  }

  const csv = toCsv(rows, columns);
  const filename = `${(inputs.companyName || 'deal').replace(/[^a-zA-Z0-9]/g, '_')}_screening_${new Date().toISOString().slice(0, 10)}.csv`;
  downloadCsv(csv, filename);
}

/**
 * Export pipeline deals as CSV.
 */
export function exportPipelineCsv(deals) {
  const columns = [
    { key: 'name', label: 'Company' },
    { key: (r) => r.inputs?.industrySector || '', label: 'Industry' },
    { key: (r) => r.inputs?.creditRating || '', label: 'Credit Rating' },
    { key: 'score', label: 'Score' },
    { key: 'stage', label: 'Stage' },
    { key: (r) => r.inputs?.annualRevenue ? `$${Math.round(r.inputs.annualRevenue).toLocaleString()}` : '', label: 'Revenue' },
    { key: (r) => r.inputs?.ebitda ? `$${Math.round(r.inputs.ebitda).toLocaleString()}` : '', label: 'EBITDA' },
    { key: 'notes', label: 'Notes' },
    { key: (r) => r.created_at ? new Date(r.created_at).toLocaleDateString() : '', label: 'Added' },
    { key: (r) => r.updated_at ? new Date(r.updated_at).toLocaleDateString() : '', label: 'Updated' },
  ];

  const csv = toCsv(deals, columns);
  downloadCsv(csv, `pipeline_export_${new Date().toISOString().slice(0, 10)}.csv`);
}

/**
 * Export batch screening results as CSV.
 */
export function exportBatchCsv(results) {
  const columns = [
    { key: (r) => r.inputs?.companyName || r.id, label: 'Company' },
    { key: (r) => r.inputs?.industrySector || '', label: 'Industry' },
    { key: (r) => r.inputs?.creditRating || '', label: 'Credit Rating' },
    { key: (r) => r.score ?? '', label: 'Score' },
    { key: (r) => r.recommendation?.category || '', label: 'Rating' },
    { key: (r) => r.inputs?.annualRevenue ? `$${Math.round(r.inputs.annualRevenue).toLocaleString()}` : '', label: 'Revenue' },
    { key: (r) => r.inputs?.ebitda ? `$${Math.round(r.inputs.ebitda).toLocaleString()}` : '', label: 'EBITDA' },
    { key: (r) => r.metrics?.dscr ? r.metrics.dscr.toFixed(2) + 'x' : '', label: 'DSCR' },
    { key: (r) => r.metrics?.leverage ? r.metrics.leverage.toFixed(2) + 'x' : '', label: 'Leverage' },
  ];

  const csv = toCsv(results, columns);
  downloadCsv(csv, `batch_screening_${new Date().toISOString().slice(0, 10)}.csv`);
}
