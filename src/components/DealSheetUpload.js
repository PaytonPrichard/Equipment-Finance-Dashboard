// ============================================================
// DealSheetUpload — upload the document set for a deal, extract each
// document server-side, merge them, and prefill the form for review.
//
// A deal does not arrive as one file. It arrives as an application,
// financials, a quote, a cover email. This panel takes up to four at once,
// keeps each document's result separately, and merges them with
// src/lib/extractionMerge.
//
// Two properties this component exists to hold:
//
//   1. Nothing is silently chosen. Where documents disagree, the analyst
//      sees both values and both sources and can switch.
//   2. Nothing typed is silently destroyed. Adding a document re-merges
//      the set; it does not reset the form. See the note on onExtracted.
// ============================================================

import { useRef, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { isDemoMode } from '../lib/demoMode';
import { mergeExtractions, chooseAlternative, DOCUMENT_TYPE_LABELS } from '../lib/extractionMerge';
import demoExtraction from '../data/demoExtraction.json';

const ACCEPT = '.pdf,.png,.jpg,.jpeg,.webp,.gif,.txt,.csv';
const MAX_FILES = 4;
const MAX_FILE_BYTES = 3 * 1024 * 1024;

// Attachments accept these; extraction does not. Saying so beats a generic
// "unsupported file type" from the server.
const ATTACHABLE_NOT_PARSEABLE = ['.doc', '.docx', '.xls', '.xlsx'];

// Field keys to short labels, for the conflict list and the summary.
const FIELD_LABELS = {
  companyName: 'Company',
  annualRevenue: 'Revenue',
  priorYearRevenue: 'Prior revenue',
  ebitda: 'EBITDA',
  priorYearEbitda: 'Prior EBITDA',
  yearsInBusiness: 'Years in business',
  totalExistingDebt: 'Existing debt',
  actualAnnualDebtService: 'Annual DS',
  maintenanceCapex: 'Maintenance capex',
  cashOnHand: 'Cash',
  availableLiquidity: 'Liquidity',
  industrySector: 'Industry',
  creditRating: 'Credit rating',
  equipmentType: 'Equipment type',
  equipmentCondition: 'Condition',
  equipmentCost: 'Equipment cost',
  downPayment: 'Down payment',
  financingType: 'Structure',
  usefulLife: 'Useful life',
  loanTerm: 'Term',
  essentialUse: 'Essential use',
  totalAROutstanding: 'Total AR',
  requestedAdvanceRate: 'Advance rate',
  arUnder30: 'AR 0-30',
  arOver30: 'AR 31-60',
  arOver60: 'AR 61-90',
  arOver90: 'AR 90+',
  topCustomerConcentration: 'Top customer',
  dilutionRate: 'Dilution',
  ineligiblesPct: 'Ineligibles',
  existingABLFacility: 'Existing ABL',
  totalInventory: 'Total inventory',
  rawMaterials: 'Raw materials',
  workInProgress: 'WIP',
  finishedGoods: 'Finished goods',
  obsoleteInventory: 'Obsolete',
  inventoryTurnover: 'Turnover',
  averageDaysOnHand: 'Days on hand',
  nolvPct: 'NOLV',
  perishable: 'Perishable',
};

function labelFor(key) {
  return FIELD_LABELS[key] || key;
}

function displayValue(v) {
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  if (typeof v === 'number') return v.toLocaleString('en-US');
  return String(v);
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const idx = result.indexOf('base64,');
      resolve(idx >= 0 ? result.slice(idx + 7) : result);
    };
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.readAsDataURL(file);
  });
}

export default function DealSheetUpload({ activeModule, onExtracted, onDocumentsChange }) {
  const fileInputRef = useRef(null);
  const [status, setStatus] = useState('idle'); // idle | parsing | done | error
  const [documents, setDocuments] = useState([]); // per-document extraction results
  const [merged, setMerged] = useState(null);
  const [error, setError] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  // Staged File objects, kept so they can be attached to the deal once it
  // has an id. Parsing alone used to throw the source documents away.
  const stagedFiles = useRef([]);

  const demo = isDemoMode();

  const publish = useCallback(
    (nextDocs, nextMerged) => {
      setDocuments(nextDocs);
      setMerged(nextMerged);
      onExtracted(nextMerged ? nextMerged.inputs : {}, nextMerged);
      if (onDocumentsChange) {
        onDocumentsChange(
          stagedFiles.current.filter((f) => nextDocs.some((d) => d.fileName === f.name)),
        );
      }
    },
    [onExtracted, onDocumentsChange],
  );

  function rejectionReason(files) {
    if (documents.length + files.length > MAX_FILES) {
      return `Up to ${MAX_FILES} documents per deal. You have ${documents.length}.`;
    }
    for (const f of files) {
      const ext = f.name.slice(f.name.lastIndexOf('.')).toLowerCase();
      if (ATTACHABLE_NOT_PARSEABLE.includes(ext)) {
        return `${f.name} cannot be read for extraction. Word and Excel files can be attached to the deal after saving, but not parsed. Export to PDF to extract from it.`;
      }
      if (f.size > MAX_FILE_BYTES) {
        return `${f.name} is too large. Maximum is 3MB per document.`;
      }
    }
    return null;
  }

  async function handleFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;

    const reason = rejectionReason(files);
    if (reason) {
      setStatus('error');
      setError(reason);
      return;
    }

    setStatus('parsing');
    setError(null);

    try {
      let newDocs;

      if (demo) {
        // Demo mode runs the real merge and the real conflict UI against a
        // captured extraction, so the panel behaves exactly as it does with
        // an account. No API key, no auth, no cost.
        await new Promise((r) => setTimeout(r, 900));
        newDocs = demoExtraction.documents;
        stagedFiles.current = [];
      } else {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) throw new Error('Not authenticated');

        const payload = await Promise.all(
          files.map(async (f) => ({
            name: f.name,
            media_type: f.type || 'application/pdf',
            data: await fileToBase64(f),
          })),
        );

        const res = await fetch('/api/parse-deal', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ asset_class: activeModule, files: payload }),
        });

        let body = null;
        try { body = await res.json(); } catch { body = null; }
        if (!res.ok) throw new Error(body?.error || `Parsing failed (HTTP ${res.status})`);

        newDocs = body.documents || [];
        stagedFiles.current = [...stagedFiles.current, ...files];
      }

      const allDocs = demo ? newDocs : [...documents, ...newDocs];
      publish(allDocs, mergeExtractions(allDocs));
      setStatus('done');
    } catch (err) {
      setStatus('error');
      setError(err.message || 'Parsing failed');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  function removeDocument(fileName) {
    const remaining = documents.filter((d) => d.fileName !== fileName);
    stagedFiles.current = stagedFiles.current.filter((f) => f.name !== fileName);
    if (remaining.length === 0) {
      stagedFiles.current = [];
      publish([], null);
      setStatus('idle');
      return;
    }
    // Re-merge from the results we already have. No re-parsing, no cost.
    publish(remaining, mergeExtractions(remaining));
  }

  function switchTo(field, alternative) {
    const next = chooseAlternative(merged, field, alternative);
    setMerged(next);
    onExtracted(next.inputs, next);
  }

  function reset() {
    stagedFiles.current = [];
    publish([], null);
    setStatus('idle');
    setError(null);
  }

  if (!activeModule) return null;

  const conflicts = merged?.conflicts || [];
  const warnings = documents.flatMap((d) =>
    (d.warnings || []).map((w) => ({ fileName: d.fileName, text: w })),
  );
  const failures = documents.filter((d) => d.error);
  const fieldCount = merged ? Object.keys(merged.inputs).length : 0;

  return (
    <div
      className={`rounded-2xl border bg-white px-4 py-3 mb-3 transition-colors ${
        dragging ? 'border-[#D4A843] bg-[#fffdf7]' : 'border-gray-200'
      }`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept={ACCEPT}
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />

      {/* ---- Header ---- */}
      {status !== 'parsing' && (
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-[13px] font-semibold text-gray-900">
              {documents.length > 0 ? 'Deal documents' : 'Upload the deal documents'}
            </div>
            <div className="text-[12px] text-gray-500">
              {documents.length > 0
                ? `${fieldCount} fields from ${documents.length} document${documents.length > 1 ? 's' : ''}. Review before saving.`
                : 'Application, financials, quote, cover email. Up to four at once, PDF or image.'}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {documents.length > 0 && documents.length < MAX_FILES && (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 transition-all"
              >
                Add document
              </button>
            )}
            {documents.length === 0 ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-[12px] font-semibold text-white bg-black hover:bg-gray-800 transition-colors"
              >
                Choose files
              </button>
            ) : (
              <button
                onClick={reset}
                className="text-[12px] font-semibold text-gray-500 hover:text-gray-800 transition-colors"
              >
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      {status === 'parsing' && (
        <div className="flex items-center gap-2 text-[13px] text-gray-600">
          <svg className="animate-spin h-4 w-4 text-gray-400" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
          Reading documents...
        </div>
      )}

      {/* ---- The document set ---- */}
      {documents.length > 0 && (
        <div className="mt-2.5 space-y-1">
          {documents.map((d) => (
            <div
              key={d.fileName}
              className="flex items-center justify-between gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <div className="text-[12px] font-medium text-gray-900 truncate">{d.fileName}</div>
                <div className="text-[11px] text-gray-500">
                  {d.error ? (
                    <span className="text-red-700">{d.error}</span>
                  ) : (
                    <>
                      {DOCUMENT_TYPE_LABELS[d.documentType] || 'Document'}
                      <span className="text-gray-400"> · {d.found.length} fields</span>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={() => removeDocument(d.fileName)}
                className="flex-shrink-0 text-gray-300 hover:text-gray-600 transition-colors text-[14px] leading-none px-1"
                aria-label={`Remove ${d.fileName}`}
                title="Remove and re-merge"
              >
                &times;
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ---- Conflicts: the reason this panel exists ---- */}
      {conflicts.length > 0 && (
        <div className="mt-2.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <div className="text-[12px] font-semibold text-amber-900 mb-1.5">
            {conflicts.length} field{conflicts.length > 1 ? 's' : ''} where the documents disagree
          </div>
          <div className="space-y-1.5">
            {conflicts.map((c) => (
              <div key={c.field} className="text-[11px] leading-snug">
                <span className="font-semibold text-gray-900">{labelFor(c.field)}:</span>{' '}
                <span className="text-gray-900">{displayValue(c.chosen.value)}</span>{' '}
                <span className="text-gray-500">from {c.chosen.fileName}.</span>
                {c.alternatives.map((alt) => (
                  <span key={alt.fileName}>
                    {' '}
                    <span className="text-gray-500">
                      {alt.fileName} says {displayValue(alt.value)}.
                    </span>{' '}
                    <button
                      onClick={() => switchTo(c.field, alt)}
                      className="font-semibold text-amber-800 hover:text-amber-900 underline underline-offset-2"
                    >
                      Use that
                    </button>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ---- Warnings from extraction (percent-vs-dollar lives here) ---- */}
      {warnings.length > 0 && (
        <ul className="mt-2 space-y-0.5">
          {warnings.map((w, i) => (
            <li key={i} className="text-[11px] text-amber-700 leading-snug">
              <span className="text-amber-900 font-medium">{w.fileName}:</span> {w.text}
            </li>
          ))}
        </ul>
      )}

      {failures.length > 0 && failures.length < documents.length && (
        <div className="mt-2 text-[11px] text-gray-500">
          {failures.length} document{failures.length > 1 ? 's' : ''} could not be read. The rest were
          used.
        </div>
      )}

      {/* ---- What came from where, and what is still blank ---- */}
      {merged && (
        <div className="mt-2">
          <button
            onClick={() => setShowDetail(!showDetail)}
            className="text-[11px] text-gray-500 hover:text-gray-700 transition-colors"
          >
            {showDetail ? 'Hide' : 'Show'} what came from where {showDetail ? '▴' : '▾'}
          </button>
          {showDetail && (
            <div className="mt-1.5 space-y-0.5">
              {Object.entries(merged.fieldSources).map(([field, src]) => (
                <div key={field} className="text-[11px] text-gray-500 flex gap-2">
                  <span className="text-gray-700 min-w-[110px]">{labelFor(field)}</span>
                  <span className="text-gray-900">{displayValue(src.value)}</span>
                  <span className="text-gray-400 truncate">{src.fileName}</span>
                </div>
              ))}
              {merged.missing.length > 0 && (
                <div className="text-[11px] text-gray-400 pt-1">
                  Not found in any document: {merged.missing.map(labelFor).join(', ')}
                </div>
              )}
              {documents.some((d) => d.notes) && (
                <div className="pt-1 space-y-0.5">
                  {documents
                    .filter((d) => d.notes)
                    .map((d) => (
                      <div key={d.fileName} className="text-[11px] text-gray-500 italic leading-snug">
                        {d.fileName}: {d.notes}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {status === 'error' && (
        <div className="mt-2 flex items-start justify-between gap-3">
          <div className="text-[12px] text-red-700 leading-snug">{error}</div>
          <button
            onClick={() => { setStatus(documents.length ? 'done' : 'idle'); setError(null); }}
            className="flex-shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 transition-all"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
