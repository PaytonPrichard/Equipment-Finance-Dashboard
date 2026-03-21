import React, { useState, useRef, useEffect } from 'react';
import companyProfiles from '../data/companyProfiles';
import { formatCurrencyFull } from '../utils/format';
import TutorialBeacon from './TutorialBeacon';

const DS_ESTIMATE_RATE = 0.08;

// ---- Section / Module Icons ----
const ICONS = {
  user: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  ),
  settings: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
  'file-text': (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
    </svg>
  ),
  package: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <line x1="16.5" y1="9.4" x2="7.5" y2="4.21" />
      <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
      <line x1="12" y1="22.08" x2="12" y2="12" />
    </svg>
  ),
  briefcase: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
      <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16" />
    </svg>
  ),
  layers: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
};

// ---- Inline Tooltip ----
function Tip({ text }) {
  return (
    <span className="relative group ml-1.5 inline-flex align-middle">
      <span
        className="w-4 h-4 rounded-full bg-slate-700/60 text-slate-500 text-[10px] font-bold inline-flex items-center justify-center cursor-help hover:text-gold-400 hover:bg-gold-500/10 transition-colors focus:text-gold-400 focus:bg-gold-500/10 focus:outline-none"
        tabIndex={0}
        role="button"
        aria-label="More info"
      >
        ?
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700/50 text-xs text-slate-300 w-60 text-left leading-relaxed shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto transition-opacity duration-200 z-50" role="tooltip">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}

// ---- Label ----
function Label({ children, required, tip }) {
  return (
    <label className="flex items-center gap-0 text-[11px] font-semibold text-slate-500 mb-2.5 uppercase tracking-wider">
      {children}
      {required && <span className="text-gold-400 ml-0.5">*</span>}
      {tip && <Tip text={tip} />}
    </label>
  );
}

// ---- Company Search ----
function CompanySearch({ value, onSelect, onManualChange, tip, pipelineDeals }) {
  const [query, setQuery] = useState(value || '');
  const [open, setOpen] = useState(false);
  const [selectedSource, setSelectedSource] = useState(null);
  const ref = useRef(null);

  useEffect(() => { setQuery(value || ''); }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const results = query.length >= 2
    ? (() => {
        const q = query.toLowerCase();
        // Pipeline deals first (user's own data), then static profiles
        const pipelineMatches = (pipelineDeals || [])
          .filter(d => {
            const name = d.inputs?.companyName || d.name || '';
            return name.toLowerCase().includes(q);
          })
          .map(d => ({
            companyName: d.inputs?.companyName || d.name,
            yearsInBusiness: d.inputs?.yearsInBusiness || 0,
            annualRevenue: d.inputs?.annualRevenue || 0,
            ebitda: d.inputs?.ebitda || 0,
            totalExistingDebt: d.inputs?.totalExistingDebt || 0,
            industrySector: d.inputs?.industrySector || 'Other',
            creditRating: d.inputs?.creditRating || 'Not Rated',
            source: 'Pipeline',
          }));
        const staticMatches = companyProfiles
          .filter(c => c.companyName.toLowerCase().includes(q));
        // Deduplicate by company name
        const seen = new Set();
        return [...pipelineMatches, ...staticMatches].filter(c => {
          const key = c.companyName.toLowerCase();
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        }).slice(0, 8);
      })()
    : [];

  const fmtCurrency = (v) => {
    if (!v && v !== 0) return '$0';
    if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
    if (v >= 1e6) return `$${(v / 1e6).toFixed(1)}M`;
    if (v >= 1e3) return `$${(v / 1e3).toFixed(0)}K`;
    return `$${v.toLocaleString()}`;
  };

  return (
    <div ref={ref} className="relative">
      <Label tip={tip || 'Search your pipeline deals or type a new company name. Selecting a match auto-populates borrower financials.'}>
        Company Name
      </Label>
      <div className="relative">
        <svg className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onManualChange(e.target.value);
            setOpen(true);
            setSelectedSource(null);
          }}
          onFocus={() => query.length >= 2 && setOpen(true)}
          placeholder="Search or enter company name..."
          className="form-input"
          style={{ paddingLeft: '2.75rem' }}
        />
      </div>

      {selectedSource && (
        <div className="mt-1.5 flex items-center gap-1.5 animate-fade-in">
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gold-500/10 border border-gold-500/20 text-[10px] text-gold-400 font-medium">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
              <polyline points="20 6 9 17 4 12" />
            </svg>
            Data from {selectedSource}
          </span>
          <span className="text-[10px] text-slate-600">Fields auto-populated</span>
        </div>
      )}

      {open && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 company-dropdown rounded-xl z-50 py-1 max-h-72 overflow-y-auto animate-fade-in">
          <div className="px-3 py-2 text-[10px] text-slate-500 uppercase tracking-wider font-semibold border-b border-slate-800/50">
            {results.length} match{results.length !== 1 ? 'es' : ''} found
          </div>
          {results.map((company) => (
            <button
              key={company.companyName}
              onClick={() => {
                onSelect(company);
                setQuery(company.companyName);
                setSelectedSource(company.source);
                setOpen(false);
              }}
              className="w-full px-3 py-2.5 text-left hover:bg-slate-800/60 transition-colors flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-800 border border-slate-700/50 flex items-center justify-center flex-shrink-0">
                <span className="text-xs font-bold text-slate-400">
                  {company.companyName.charAt(0)}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-200 font-medium truncate">
                  {company.companyName}
                </p>
                <p className="text-[11px] text-slate-500">
                  {company.industrySector} &middot; {fmtCurrency(company.annualRevenue)} rev &middot; {company.creditRating}
                </p>
              </div>
              <span className="text-[10px] text-slate-600 flex-shrink-0">
                {company.source}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---- Input Warnings ----
function getInputWarnings(inputs, pipelineDeals) {
  const warnings = [];

  if (inputs.ebitda > 0 && inputs.annualRevenue > 0 && inputs.ebitda > inputs.annualRevenue) {
    warnings.push({
      id: 'ebitda-revenue', severity: 'error',
      text: 'EBITDA exceeds revenue. This is unusual. Verify both figures.',
    });
  }

  if (inputs.ebitda > 0 && inputs.annualRevenue > 0) {
    const margin = (inputs.ebitda / inputs.annualRevenue) * 100;
    if (margin > 50) {
      warnings.push({
        id: 'high-margin', severity: 'warn',
        text: `EBITDA margin of ${margin.toFixed(0)}% is unusually high. Confirm EBITDA excludes one-time items.`,
      });
    }
  }

  if (inputs.downPayment > 0 && inputs.equipmentCost > 0 && inputs.downPayment >= inputs.equipmentCost) {
    warnings.push({
      id: 'down-exceeds', severity: 'error',
      text: 'Down payment meets or exceeds equipment cost. No financing needed.',
    });
  }

  if (inputs.loanTerm > 0 && inputs.usefulLife > 0 && inputs.loanTerm > inputs.usefulLife * 12) {
    warnings.push({
      id: 'term-exceeds-life', severity: 'error',
      text: `Loan term (${inputs.loanTerm} mo) exceeds useful life (${inputs.usefulLife * 12} mo). Adjust term or useful life.`,
    });
  }

  if (inputs.totalExistingDebt > 0 && inputs.ebitda > 0 && inputs.totalExistingDebt > inputs.ebitda * 8) {
    warnings.push({
      id: 'extreme-leverage', severity: 'warn',
      text: `Existing debt is ${(inputs.totalExistingDebt / inputs.ebitda).toFixed(1)}x EBITDA. Verify debt figure.`,
    });
  }

  if (inputs.actualAnnualDebtService > 0 && inputs.ebitda > 0 && inputs.actualAnnualDebtService > inputs.ebitda) {
    warnings.push({
      id: 'ds-exceeds-ebitda', severity: 'warn',
      text: 'Existing debt service exceeds EBITDA. Borrower cannot cover current obligations from operations.',
    });
  }

  if (inputs.equipmentCost > 0 && inputs.annualRevenue > 0 && inputs.equipmentCost > inputs.annualRevenue) {
    warnings.push({
      id: 'cost-exceeds-rev', severity: 'warn',
      text: 'Equipment cost exceeds annual revenue. Very large transaction relative to borrower size.',
    });
  }

  // AR-specific: aging buckets should sum to ~100%
  if (inputs.totalAROutstanding > 0 && inputs.arUnder30 !== undefined) {
    const agingSum = (inputs.arUnder30 || 0) + (inputs.arOver30 || 0) + (inputs.arOver60 || 0) + (inputs.arOver90 || 0);
    if (agingSum > 0 && Math.abs(agingSum - 100) > 5) {
      warnings.push({
        id: 'aging-sum', severity: 'warn',
        text: `AR aging buckets sum to ${agingSum.toFixed(0)}% — expected ~100%. Verify percentages.`,
      });
    }
  }

  // Inventory: composition should sum to ~100%
  if (inputs.totalInventory > 0 && inputs.rawMaterials !== undefined) {
    const compSum = (inputs.rawMaterials || 0) + (inputs.workInProgress || 0) + (inputs.finishedGoods || 0) + (inputs.obsoleteInventory || 0);
    if (compSum > 0 && Math.abs(compSum - 100) > 5) {
      warnings.push({
        id: 'inv-comp-sum', severity: 'warn',
        text: `Inventory composition sums to ${compSum.toFixed(0)}% — expected ~100%. Verify percentages.`,
      });
    }
  }

  // Duplicate company in pipeline
  if (inputs.companyName && pipelineDeals?.length > 0) {
    const match = pipelineDeals.find(d =>
      (d.inputs?.companyName || d.name || '').toLowerCase() === inputs.companyName.toLowerCase()
    );
    if (match) {
      warnings.push({
        id: 'duplicate-company', severity: 'warn',
        text: `"${inputs.companyName}" already exists in your pipeline (${match.stage || 'Screening'}).`,
      });
    }
  }

  return warnings;
}

// ============ FIELD RENDERER ============

function renderField(field, inputs, onChange, schema, pipelineDeals) {
  const value = inputs[field.key];
  const update = (val) => onChange({ ...inputs, [field.key]: val });

  switch (field.type) {
    case 'company-search':
      return (
        <CompanySearch
          value={value}
          tip={field.tip}
          pipelineDeals={pipelineDeals}
          onSelect={(company) => {
            onChange({
              ...inputs,
              companyName: company.companyName,
              yearsInBusiness: company.yearsInBusiness,
              annualRevenue: company.annualRevenue,
              ebitda: company.ebitda,
              totalExistingDebt: company.totalExistingDebt,
              industrySector: company.industrySector,
              creditRating: company.creditRating,
            });
          }}
          onManualChange={(val) => onChange({ ...inputs, companyName: val })}
        />
      );

    case 'currency':
      return (
        <div>
          <Label required={field.required} tip={field.tip}>{field.label}</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">$</span>
            <input
              type="text"
              inputMode="numeric"
              value={value ? Number(value).toLocaleString() : ''}
              onChange={(e) => {
                const raw = e.target.value.replace(/[^0-9.]/g, '');
                update(parseFloat(raw) || 0);
              }}
              placeholder={field.placeholder}
              className="form-input"
              style={{ paddingLeft: '2rem' }}
            />
          </div>
          {field.key === 'actualAnnualDebtService' && !(value > 0) && inputs.totalExistingDebt > 0 && (
            <p className="text-[10px] text-slate-600 mt-1 pl-1">
              Est: {formatCurrencyFull(inputs.totalExistingDebt * DS_ESTIMATE_RATE)}/yr
            </p>
          )}
        </div>
      );

    case 'number':
      return (
        <div>
          <Label required={field.required} tip={field.tip}>{field.label}</Label>
          <input
            type="number"
            value={value || ''}
            onChange={(e) => update(parseFloat(e.target.value) || 0)}
            placeholder={field.placeholder}
            className="form-input"
            min="0"
          />
          {field.key === 'loanTerm' && value > 0 && (
            <p className="text-[11px] text-slate-600 mt-1.5 pl-1 font-mono">
              = {(value / 12).toFixed(1)} years
            </p>
          )}
        </div>
      );

    case 'percent':
      return (
        <div>
          <Label required={field.required} tip={field.tip}>{field.label}</Label>
          <div className="relative">
            <input
              type="number"
              value={value || ''}
              onChange={(e) => update(parseFloat(e.target.value) || 0)}
              placeholder={field.placeholder}
              className="form-input"
              style={{ paddingRight: '2rem' }}
              min="0"
              max="100"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">%</span>
          </div>
        </div>
      );

    case 'select':
      return (
        <div>
          <Label tip={field.tip}>{field.label}</Label>
          <div className="relative">
            <select
              value={value}
              onChange={(e) => update(e.target.value)}
              className="form-select"
            >
              {(field.options || []).map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          {field.key === 'equipmentType' && schema.equipmentDefaults && schema.equipmentDefaults[value] && (
            <p className="text-[10px] text-slate-600 mt-1 pl-1">
              Typical life: {schema.equipmentDefaults[value].usefulLifeRange[0]}–{schema.equipmentDefaults[value].usefulLifeRange[1]} yrs
              {schema.equipmentDefaults[value].suggestedType !== (inputs.financingType || 'EFA') && (
                <span className="text-gold-400 ml-1">
                  &middot; Common: {schema.equipmentDefaults[value].suggestedType}
                </span>
              )}
            </p>
          )}
        </div>
      );

    case 'toggle':
      return (
        <div>
          <Label tip={field.tip}>{field.label}</Label>
          <div className="flex gap-2">
            {(field.options || []).map((opt) => (
              <button
                key={opt}
                onClick={() => update(opt)}
                className={`pill-btn flex-1 py-2.5 rounded-xl text-sm font-medium text-center ${
                  value === opt ? 'pill-btn-active' : 'text-slate-400'
                }`}
              >
                {opt}
              </button>
            ))}
          </div>
        </div>
      );

    case 'boolean':
      return (
        <div>
          <Label tip={field.tip}>{field.label}</Label>
          <button
            onClick={() => update(!value)}
            className="flex items-center gap-3"
          >
            <div className={`toggle-track relative w-11 h-6 rounded-full ${value ? 'bg-gold-500' : 'bg-slate-700'}`}>
              <div className={`toggle-thumb absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ${value ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
            </div>
            <span className={`text-sm font-medium ${value ? 'text-gold-300' : 'text-slate-500'}`}>
              {value ? 'Yes' : 'No'}
            </span>
          </button>
        </div>
      );

    case 'financing-type': {
      const isTRACEligible = field.tracEligible?.includes(inputs.equipmentType);
      const currentFT = inputs.financingType || 'EFA';
      const ftDesc = { EFA: 'Borrower owns', FMV: 'Return option', TRAC: 'Guaranteed residual' };
      return (
        <div>
          <Label tip={field.tip}>{field.label}</Label>
          <div className="grid grid-cols-3 gap-2">
            {Object.entries(field.options || {}).map(([key, ft]) => {
              const disabled = key === 'TRAC' && !isTRACEligible;
              const active = currentFT === key;
              return (
                <button
                  key={key}
                  onClick={() => !disabled && onChange({ ...inputs, financingType: key })}
                  disabled={disabled}
                  title={disabled ? 'TRAC: Vehicles/Fleet and Rail Cars only' : ft.description}
                  className={`pill-btn rounded-xl py-2.5 px-2 text-center ${
                    disabled ? 'opacity-30 cursor-not-allowed' :
                    active ? 'pill-btn-active' : 'text-slate-400'
                  }`}
                >
                  <span className="text-xs font-semibold block">{ft.label}</span>
                  <span className="text-[10px] text-slate-500 block mt-0.5 leading-tight">
                    {ftDesc[key] || ft.description}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      );
    }

    default:
      return null;
  }
}

// ============ LAYOUT HELPER ============

function renderFieldsLayout(fields, inputs, onChange, schema, pipelineDeals) {
  const groups = [];
  let currentHalfGroup = [];

  fields.forEach((field) => {
    if (field.half) {
      currentHalfGroup.push(field);
      if (currentHalfGroup.length === 2) {
        groups.push({ type: 'grid', fields: [...currentHalfGroup] });
        currentHalfGroup = [];
      }
    } else {
      if (currentHalfGroup.length > 0) {
        groups.push({ type: 'grid', fields: [...currentHalfGroup] });
        currentHalfGroup = [];
      }
      groups.push({ type: 'full', field });
    }
  });

  if (currentHalfGroup.length > 0) {
    groups.push({ type: 'grid', fields: [...currentHalfGroup] });
  }

  return groups.map((group, i) => {
    if (group.type === 'grid') {
      return (
        <div key={i} className="grid grid-cols-2 gap-3">
          {group.fields.map((f) => (
            <React.Fragment key={f.key}>
              {renderField(f, inputs, onChange, schema, pipelineDeals)}
            </React.Fragment>
          ))}
        </div>
      );
    }
    return (
      <React.Fragment key={group.field.key}>
        {renderField(group.field, inputs, onChange, schema, pipelineDeals)}
      </React.Fragment>
    );
  });
}

// ============ MAIN FORM ============

export default function DealInputForm({ inputs, onChange, schema, modules, activeModule, onModuleChange, pipelineDeals }) {
  // Guard: if equipment module has TRAC selected but equipment type doesn't support it
  if (schema.equipmentDefaults && inputs.financingType === 'TRAC') {
    const ftField = schema.sections.flatMap(s => s.fields).find(f => f.key === 'financingType');
    if (ftField && !ftField.tracEligible?.includes(inputs.equipmentType)) {
      onChange({ ...inputs, financingType: 'EFA' });
    }
  }

  return (
    <div className="space-y-5">
      {/* Quick instruction */}
      <div className="bg-gold-500/[0.04] border border-gold-500/10 rounded-xl px-5 py-3">
        <p className="text-[12px] text-slate-300 leading-relaxed">
          Select an asset class, fill in required fields (<span className="text-gold-400 font-semibold">*</span>), and results will appear as you type.
        </p>
      </div>

      {/* Asset Class Selector */}
      {modules && modules.length > 1 && (
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
              {ICONS.layers}
            </div>
            <h3 className="text-sm font-semibold text-slate-300">Asset Class</h3>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {modules.map((m) => (
              <button
                key={m.key}
                onClick={() => onModuleChange(m.key)}
                className={`pill-btn rounded-xl py-3 px-2 text-center transition-all ${
                  activeModule === m.key ? 'pill-btn-active' : 'text-slate-400 hover:text-slate-300'
                }`}
              >
                <div className="flex items-center justify-center mb-1.5">
                  {ICONS[m.icon] || ICONS.briefcase}
                </div>
                <span className="text-[11px] font-semibold block leading-tight">{m.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Required note */}
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">
        <span className="text-gold-400">*</span> Required for screening
      </p>

      {/* Dynamic Sections */}
      {schema.sections.map((section) => (
        <div key={section.key} className="glass-card rounded-2xl p-6">
          <div className="flex items-center gap-2.5 mb-6">
            <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
              {ICONS[section.icon] || ICONS.settings}
            </div>
            <h3 className="text-sm font-semibold text-slate-300">
              {section.title}
            </h3>
            {section.key === 'borrower' && (
              <TutorialBeacon id="form" title="Start Here" description="Enter financials or search for a company to auto-fill." position="right" />
            )}
          </div>

          <div className="space-y-4">
            {renderFieldsLayout(section.fields, inputs, onChange, schema, pipelineDeals)}
          </div>
        </div>
      ))}

      {/* Input Validation Warnings */}
      {(() => {
        const warnings = getInputWarnings(inputs, pipelineDeals);
        if (warnings.length === 0) return null;
        return (
          <div className="space-y-2">
            {warnings.map((w) => (
              <div
                key={w.id}
                className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${
                  w.severity === 'error'
                    ? 'bg-rose-500/[0.06] border-rose-500/15'
                    : 'bg-amber-500/[0.06] border-amber-500/15'
                }`}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                  className={`mt-0.5 flex-shrink-0 ${w.severity === 'error' ? 'text-rose-400' : 'text-amber-400'}`}
                  strokeWidth="2"
                >
                  <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
                <p className={`text-[12px] leading-relaxed ${w.severity === 'error' ? 'text-rose-300' : 'text-amber-300'}`}>
                  {w.text}
                </p>
              </div>
            ))}
          </div>
        );
      })()}
    </div>
  );
}
