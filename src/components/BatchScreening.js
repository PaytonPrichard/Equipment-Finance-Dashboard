import React, { useRef, useState, useMemo, useCallback } from 'react';
import { formatCurrency, DEFAULT_SOFR } from '../utils/calculations';
import { getModule, getAvailableModules } from '../modules';
import { exportBatchCsv } from '../utils/csvExport';
import { generateXlsxTemplate } from '../utils/templateGenerator';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { createPipelineDeal } from '../lib/pipeline';

// ── Module-specific table columns ────────────────────────────
function getColumns(moduleKey) {
  const common = [
    { key: 'companyName', label: 'Company Name', accessor: (d) => d.inputs.companyName },
    { key: 'industrySector', label: 'Industry', accessor: (d) => d.inputs.industrySector },
  ];

  const assetCol = {
    equipment_finance: {
      key: 'equipmentCost', label: 'Equipment Cost',
      accessor: (d) => d.inputs.equipmentCost, format: (v) => formatCurrency(v),
    },
    accounts_receivable: {
      key: 'totalAR', label: 'Total AR',
      accessor: (d) => d.inputs.totalAROutstanding, format: (v) => formatCurrency(v),
    },
    inventory_finance: {
      key: 'totalInventory', label: 'Total Inventory',
      accessor: (d) => d.inputs.totalInventory, format: (v) => formatCurrency(v),
    },
  };

  return [
    ...common,
    assetCol[moduleKey] || assetCol.equipment_finance,
    { key: 'dscr', label: 'DSCR', accessor: (d) => d.metrics.dscr, format: (v) => v.toFixed(2) + 'x' },
    { key: 'leverage', label: 'Leverage', accessor: (d) => d.metrics.leverage, format: (v) => v.toFixed(1) + 'x' },
    { key: 'score', label: 'Risk Score', accessor: (d) => d.riskScore.composite, badge: true },
    { key: 'recommendation', label: 'Recommendation', accessor: (d) => d.rec.category, recStyle: true },
  ];
}

// ── Score helpers ─────────────────────────────────────────────
function scoreBadgeBg(s) {
  if (s >= 75) return 'bg-emerald-500/[0.08] border-emerald-500/15';
  if (s >= 55) return 'bg-lime-500/[0.08] border-lime-500/15';
  if (s >= 35) return 'bg-amber-500/[0.08] border-amber-500/15';
  return 'bg-rose-500/[0.08] border-rose-500/15';
}
function scoreColor(s) {
  if (s >= 75) return 'text-emerald-400';
  if (s >= 55) return 'text-lime-400';
  if (s >= 35) return 'text-amber-400';
  return 'text-rose-400';
}

// ── Distribution bucket colors ────────────────────────────────
const DIST_COLORS = {
  Strong:     { bar: 'bg-emerald-500', text: 'text-emerald-400', bg: 'bg-emerald-500/[0.06] border border-emerald-500/15' },
  Moderate:   { bar: 'bg-lime-500',    text: 'text-lime-400',    bg: 'bg-lime-500/[0.06] border border-lime-500/15' },
  Borderline: { bar: 'bg-amber-500',   text: 'text-amber-400',   bg: 'bg-amber-500/[0.06] border border-amber-500/15' },
  Weak:       { bar: 'bg-rose-500',    text: 'text-rose-400',    bg: 'bg-rose-500/[0.06] border border-rose-500/15' },
};

// ── Module label map ─────────────────────────────────────────
const MODULE_LABELS = {
  equipment_finance: 'Equipment',
  accounts_receivable: 'Accounts Receivable',
  inventory_finance: 'Inventory',
};

// ── Required-field validation ────────────────────────────────
// A required currency/number field that came back as 0 is almost certainly
// missing from the upload (parser defaults blank cells to 0). The edge case
// of a legitimate zero (e.g. distressed borrower with 0 EBITDA) gets flagged
// here too — user can fix by entering 0.01 or contact support.
function findMissingFields(inputs, schema) {
  const missing = [];
  // Always require a company name even if not formally marked required —
  // can't sensibly screen a deal that can't be identified.
  if (!inputs?.companyName || String(inputs.companyName).trim() === '') {
    missing.push('Company Name');
  }
  schema.sections.forEach((section) => {
    section.fields.forEach((field) => {
      if (!field.required) return;
      if (field.key === 'companyName') return; // handled above
      const v = inputs?.[field.key];
      const isMissing =
        v == null ||
        v === '' ||
        (typeof v === 'number' && v === 0);
      if (isMissing) {
        missing.push(field.label || field.key);
      }
    });
  });
  return missing;
}

export default function BatchScreening({ sofr = DEFAULT_SOFR, onLoadDeal, activeModule: initialModule = 'equipment_finance' }) {
  const fileRef = useRef(null);
  const { user, profile } = useAuth();
  const { addToast } = useToast();
  const [status, setStatus] = useState(null);
  const [scoredDeals, setScoredDeals] = useState([]);
  const [incompleteDeals, setIncompleteDeals] = useState([]);
  const [sortKey, setSortKey] = useState('score');
  const [sortAsc, setSortAsc] = useState(false);
  const [batchModule, setBatchModule] = useState(initialModule);
  const [savingAll, setSavingAll] = useState(false);
  const [savedRowIds, setSavedRowIds] = useState(new Set());

  const mod = useMemo(() => getModule(batchModule), [batchModule]);
  const columns = useMemo(() => getColumns(batchModule), [batchModule]);
  const availableModules = useMemo(() => getAvailableModules(), []);

  // Clear results when switching modules
  const handleModuleSwitch = useCallback((key) => {
    if (key === batchModule) return;
    setBatchModule(key);
    setScoredDeals([]);
    setIncompleteDeals([]);
    setSavedRowIds(new Set());
    setSortKey('score');
    setSortAsc(false);
    setStatus(null);
  }, [batchModule]);

  // ── File Upload (CSV or .xlsx) ────────────────────────────
  const processCsvText = useCallback((text) => {
    if (!text || !text.trim()) {
      setStatus({ type: 'error', message: 'File is empty.' });
      return;
    }
    // Strip parenthesized unit hints from the header line so labels like
    // "Annual Revenue (USD)" still match the parser's field map.
    const lines = text.split('\n');
    if (lines.length > 0) {
      lines[0] = lines[0].replace(/\s*\([^)]*\)/g, '');
    }
    const rawDeals = mod.parseCsvDeals(lines.join('\n'));
    // Drop any rows that still carry the sample sentinel (user forgot to
    // delete). Catches "(sample)", "SAMPLE — delete this row", etc.
    const deals = (rawDeals || []).filter(
      (d) => !/sample/i.test(d.inputs?.companyName || ''),
    );
    if (!deals || deals.length === 0) {
      setStatus({ type: 'error', message: 'No valid rows found in the file.' });
      return;
    }
    if (deals.length > 500) {
      setStatus({ type: 'error', message: `File has ${deals.length} rows. Maximum is 500 deals per batch.` });
      return;
    }

    const validDeals = [];
    const incomplete = [];
    deals.forEach((deal) => {
      const missing = findMissingFields(deal.inputs, mod.FORM_SCHEMA);
      if (missing.length === 0) {
        validDeals.push(deal);
      } else {
        incomplete.push({
          id: deal.id,
          companyName: deal.inputs?.companyName || '',
          missing,
        });
      }
    });

    const scored = validDeals.map((deal) => {
      const metrics = mod.calculateMetrics(deal.inputs, sofr);
      const riskScore = mod.calculateRiskScore(deal.inputs, metrics);
      const rec = mod.getRecommendation(riskScore.composite);
      return { ...deal, metrics, riskScore, rec };
    });

    setScoredDeals(scored);
    setIncompleteDeals(incomplete);
    setSavedRowIds(new Set());

    const moduleLabel = MODULE_LABELS[batchModule] || '';
    if (scored.length === 0 && incomplete.length > 0) {
      setStatus({ type: 'error', message: `${incomplete.length} row${incomplete.length === 1 ? '' : 's'} missing required data. None were screened.` });
    } else if (incomplete.length > 0) {
      setStatus({ type: 'warning', message: `Screened ${scored.length} ${moduleLabel} deal${scored.length === 1 ? '' : 's'}. ${incomplete.length} skipped (missing required data).` });
    } else {
      setStatus({ type: 'success', message: `Screened ${scored.length} ${moduleLabel} deal${scored.length === 1 ? '' : 's'}` });
      setTimeout(() => setStatus(null), 4000);
    }
  }, [sofr, mod, batchModule]);

  const handleFile = useCallback(async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();

    try {
      if (ext === 'xlsx') {
        const ExcelJS = (await import('exceljs')).default;
        const buffer = await file.arrayBuffer();
        const wb = new ExcelJS.Workbook();
        await wb.xlsx.load(buffer);
        const sheet = wb.worksheets[0];
        if (!sheet) {
          setStatus({ type: 'error', message: 'No sheets found in workbook.' });
          return;
        }
        const cellToString = (v) => {
          if (v == null) return '';
          if (typeof v === 'object') {
            if (Array.isArray(v.richText)) return v.richText.map(t => t.text).join('');
            if (v.text != null) return String(v.text);
            if (v.result != null) return String(v.result);
            if (v instanceof Date) return v.toISOString();
            return '';
          }
          return String(v);
        };
        const colCount = sheet.columnCount || 0;
        const rowCount = sheet.rowCount || 0;
        const lines = [];
        // Skip sparse rows (title + section group rows have merged cells, so
        // most cells are blank) until we find the dense header row.
        let foundHeaders = false;
        const sparseThreshold = Math.max(3, Math.floor(colCount * 0.3));
        for (let r = 1; r <= rowCount; r++) {
          const row = sheet.getRow(r);
          const cells = [];
          let nonEmpty = 0;
          for (let c = 1; c <= colCount; c++) {
            const v = cellToString(row.getCell(c).value);
            cells.push(v.replace(/,/g, ' '));
            if (v.trim()) nonEmpty++;
          }
          if (!foundHeaders) {
            if (nonEmpty < sparseThreshold) continue;
            foundHeaders = true;
          }
          if (cells.some((v) => v.trim() !== '')) {
            lines.push(cells.join(','));
          }
        }
        processCsvText(lines.join('\n'));
        return;
      }

      // CSV path
      const reader = new FileReader();
      reader.onload = (evt) => processCsvText(evt.target.result);
      reader.onerror = () => setStatus({ type: 'error', message: 'Failed to read file.' });
      reader.readAsText(file);
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Failed to read file.' });
    }
  }, [processCsvText]);

  // ── Template Download ─────────────────────────────────────
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const downloadTemplate = useCallback(async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await generateXlsxTemplate(batchModule, mod);
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `tranche_${batchModule}_template.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setStatus({ type: 'error', message: 'Failed to generate template.' });
    } finally {
      setDownloadingTemplate(false);
    }
  }, [batchModule, mod]);

  // ── Distribution stats ────────────────────────────────────
  const distribution = useMemo(() => {
    const buckets = { Strong: 0, Moderate: 0, Borderline: 0, Weak: 0 };
    scoredDeals.forEach((d) => {
      const s = d.riskScore.composite;
      if (s >= 75) buckets.Strong++;
      else if (s >= 55) buckets.Moderate++;
      else if (s >= 35) buckets.Borderline++;
      else buckets.Weak++;
    });
    return buckets;
  }, [scoredDeals]);

  // ── Sorting ───────────────────────────────────────────────
  const handleSort = useCallback((key) => {
    setSortAsc((prev) => (sortKey === key ? !prev : true));
    setSortKey(key);
  }, [sortKey]);

  const sortedDeals = useMemo(() => {
    const col = columns.find((c) => c.key === sortKey);
    if (!col) return scoredDeals;
    return [...scoredDeals].sort((a, b) => {
      let va = col.accessor(a);
      let vb = col.accessor(b);
      if (typeof va === 'string') va = va.toLowerCase();
      if (typeof vb === 'string') vb = vb.toLowerCase();
      if (va < vb) return sortAsc ? -1 : 1;
      if (va > vb) return sortAsc ? 1 : -1;
      return 0;
    });
  }, [scoredDeals, sortKey, sortAsc, columns]);

  // ── Render ────────────────────────────────────────────────
  const total = scoredDeals.length;

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Upload area */}
      <div className="glass-card rounded-2xl p-6">
        <h3 className="text-sm font-semibold text-gray-800 mb-3">Batch Deal Screening</h3>
        <p className="text-[11px] text-gray-400 mb-4">
          Upload an .xlsx or .csv to screen multiple deals at once. Download the template to see required columns and formats.
        </p>

        {/* Asset class selector */}
        <div className="flex items-center gap-1.5 mb-4">
          {availableModules.map((m) => (
            <button
              key={m.key}
              onClick={() => handleModuleSwitch(m.key)}
              className={`px-3 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${
                batchModule === m.key
                  ? 'bg-gray-900 text-white'
                  : 'pill-btn text-gray-500 hover:text-gray-700'
              }`}
            >
              {MODULE_LABELS[m.key] || m.name}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <button
            type="button"
            className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 flex items-center gap-1.5"
            onClick={() => fileRef.current?.click()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5-5m0 0l5 5m-5-5v12" />
            </svg>
            Upload File
          </button>

          <input
            ref={fileRef}
            type="file"
            accept=".csv,.xlsx"
            className="hidden"
            onChange={handleFile}
          />

          <button
            type="button"
            disabled={downloadingTemplate}
            className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-600 hover:text-gray-700 disabled:opacity-50 disabled:cursor-wait flex items-center gap-1.5"
            onClick={downloadTemplate}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="w-3.5 h-3.5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M7 10l5 5m0 0l5-5m-5 5V3" />
            </svg>
            {downloadingTemplate ? 'Preparing...' : `Download ${MODULE_LABELS[batchModule]} Template`}
          </button>

          {scoredDeals.length > 0 && (
            <>
              <button
                className="px-3 py-1.5 rounded-lg text-[11px] font-semibold text-gray-900 hover:opacity-90 disabled:opacity-50 transition-all flex items-center gap-1.5"
                style={{ backgroundColor: '#D4A843' }}
                disabled={savingAll || scoredDeals.every((d) => savedRowIds.has(d.id))}
                onClick={async () => {
                  if (!user?.id || !profile?.org_id) {
                    setStatus({ type: 'error', message: 'Profile is still loading.' });
                    return;
                  }
                  setSavingAll(true);
                  const toSave = scoredDeals.filter((d) => !savedRowIds.has(d.id));
                  let saved = 0;
                  let failed = 0;
                  const newSavedIds = new Set(savedRowIds);
                  for (const deal of toSave) {
                    const dealName = (deal.inputs?.companyName || '').trim() || `Untitled Deal ${deal.id}`;
                    const { data, error } = await createPipelineDeal(
                      user.id,
                      profile.org_id,
                      dealName,
                      deal.inputs,
                      deal.riskScore?.composite ?? null,
                    );
                    if (data && !error) {
                      saved++;
                      newSavedIds.add(deal.id);
                    } else {
                      failed++;
                    }
                  }
                  setSavedRowIds(newSavedIds);
                  setSavingAll(false);
                  if (failed === 0) {
                    addToast(`Saved ${saved} deal${saved === 1 ? '' : 's'} to pipeline`, 'success');
                  } else {
                    addToast(`Saved ${saved}, ${failed} failed`, 'warning');
                  }
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                  <polyline points="17 21 17 13 7 13 7 21" />
                </svg>
                {savingAll
                  ? 'Saving...'
                  : scoredDeals.every((d) => savedRowIds.has(d.id))
                    ? 'All Saved'
                    : `Save ${scoredDeals.filter((d) => !savedRowIds.has(d.id)).length} to Pipeline`}
              </button>
              <button
                className="pill-btn px-3 py-1.5 rounded-lg text-[11px] font-medium text-gray-500 hover:text-gray-800 flex items-center gap-1.5"
                onClick={() => exportBatchCsv(scoredDeals.map(d => ({
                  ...d,
                  score: d.riskScore.composite,
                  recommendation: d.rec,
                  metrics: d.metrics,
                })))}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                  <polyline points="7 10 12 15 17 10"/>
                  <line x1="12" y1="15" x2="12" y2="3"/>
                </svg>
                Export Results CSV
              </button>
            </>
          )}

          {status?.type === 'success' && (
            <span className="text-emerald-400 text-[11px]">{status.message}</span>
          )}
          {status?.type === 'warning' && (
            <span className="text-amber-500 text-[11px]">{status.message}</span>
          )}
          {status?.type === 'error' && (
            <span className="text-rose-400 text-[11px]">{status.message}</span>
          )}
        </div>
      </div>

      {/* Needs more data — incomplete rows that couldn't be scored */}
      {incompleteDeals.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-5">
          <div className="flex items-start gap-3 mb-3">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-amber-500 flex-shrink-0 mt-0.5">
              <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
            <div>
              <h4 className="text-[13px] font-semibold text-gray-900">
                {incompleteDeals.length} row{incompleteDeals.length === 1 ? '' : 's'} need{incompleteDeals.length === 1 ? 's' : ''} more data
              </h4>
              <p className="text-[11px] text-gray-500 mt-0.5">
                These rows weren't screened. Add the missing fields to your file and re-upload.
              </p>
            </div>
          </div>
          <div className="space-y-1.5">
            {incompleteDeals.slice(0, 10).map((d) => (
              <div key={d.id} className="flex items-baseline gap-3 px-3 py-2 rounded-lg bg-white border border-amber-500/15">
                <span className="text-[12px] font-medium text-gray-900 min-w-[140px] truncate">
                  {d.companyName || d.id}
                </span>
                <span className="text-[11px] text-amber-700">
                  Missing: {d.missing.join(', ')}
                </span>
              </div>
            ))}
            {incompleteDeals.length > 10 && (
              <div className="text-[11px] text-gray-500 px-3 pt-1">
                And {incompleteDeals.length - 10} more.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Summary dashboard — only show after deals are screened */}
      {total > 0 && (
        <>
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="glass-card rounded-2xl p-5 text-center">
              <p className="text-2xl font-bold font-mono text-gray-900">{total}</p>
              <p className="text-[11px] text-gray-400 mt-1">Deals Screened</p>
            </div>
            {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => {
              const c = DIST_COLORS[bucket];
              return (
                <div key={bucket} className={`${c.bg} rounded-2xl p-5 text-center`}>
                  <p className={`text-2xl font-bold font-mono ${c.text}`}>{distribution[bucket]}</p>
                  <p className="text-[11px] text-gray-400 mt-1">{bucket}</p>
                </div>
              );
            })}
          </div>

          {/* Distribution bar */}
          <div className="glass-card rounded-2xl p-5">
            <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">
              Score Distribution
            </h4>
            <div className="flex rounded-lg overflow-hidden h-5">
              {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => {
                const pct = total > 0 ? (distribution[bucket] / total) * 100 : 0;
                if (pct === 0) return null;
                return (
                  <div
                    key={bucket}
                    className={`${DIST_COLORS[bucket].bar} relative group transition-all`}
                    style={{ width: `${pct}%` }}
                    title={`${bucket}: ${distribution[bucket]} (${pct.toFixed(0)}%)`}
                  >
                    {pct >= 12 && (
                      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-900/90">
                        {distribution[bucket]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex items-center gap-4 mt-2">
              {(['Strong', 'Moderate', 'Borderline', 'Weak']).map((bucket) => (
                <span key={bucket} className="flex items-center gap-1.5 text-[10px] text-gray-400">
                  <span className={`inline-block w-2 h-2 rounded-sm ${DIST_COLORS[bucket].bar}`} />
                  {bucket} ({bucket === 'Strong' ? '75+' : bucket === 'Moderate' ? '55-74' : bucket === 'Borderline' ? '35-54' : '<35'})
                </span>
              ))}
            </div>
          </div>

          {/* Sortable table */}
          <div className="glass-card rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="border-b border-gray-200">
                    {columns.map((col) => {
                      const active = sortKey === col.key;
                      return (
                        <th
                          key={col.key}
                          className="px-5 py-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest cursor-pointer select-none hover:text-gray-700 transition-colors"
                          onClick={() => handleSort(col.key)}
                        >
                          <span className="inline-flex items-center gap-1">
                            {col.label}
                            {active && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2.5"
                                className={`transition-transform ${sortAsc ? '' : 'rotate-180'}`}
                              >
                                <polyline points="18 15 12 9 6 15" />
                              </svg>
                            )}
                            {!active && (
                              <svg
                                width="10"
                                height="10"
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="1.5"
                                className="text-gray-300"
                              >
                                <polyline points="7 10 12 5 17 10" />
                                <polyline points="7 14 12 19 17 14" />
                              </svg>
                            )}
                          </span>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody>
                  {sortedDeals.map((deal) => (
                    <tr
                      key={deal.id}
                      className="border-b border-white/[0.02] hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => onLoadDeal && onLoadDeal(deal.inputs)}
                      title="Click to load into screening form"
                    >
                      {columns.map((col) => {
                        const raw = col.accessor(deal);

                        // Risk score badge
                        if (col.badge) {
                          return (
                            <td key={col.key} className="px-5 py-3">
                              <span
                                className={`inline-flex items-center justify-center px-2.5 py-1 rounded-lg text-[11px] font-bold border ${scoreBadgeBg(raw)} ${scoreColor(raw)} font-mono`}
                              >
                                {raw}
                              </span>
                            </td>
                          );
                        }

                        // Recommendation with color
                        if (col.recStyle) {
                          return (
                            <td key={col.key} className={`px-5 py-3 text-[11px] font-semibold ${deal.rec.textClass}`}>
                              {raw}
                            </td>
                          );
                        }

                        // Default formatted cell
                        const display = col.format ? col.format(raw) : raw;
                        return (
                          <td key={col.key} className="px-5 py-3 text-[12px] text-gray-700 font-mono whitespace-nowrap">
                            {display}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Footer hint */}
            <div className="px-5 py-3 border-t border-gray-200 text-[10px] text-gray-400">
              Click any row to load the deal into the screening form &middot; Click column headers to sort
            </div>
          </div>
        </>
      )}
    </div>
  );
}
