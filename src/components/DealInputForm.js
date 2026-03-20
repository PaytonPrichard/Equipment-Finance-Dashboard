import React, { useState, useRef, useEffect } from 'react';
import { FINANCING_TYPES, TRAC_ELIGIBLE_TYPES, EQUIPMENT_DEFAULTS, formatCurrency, formatCurrencyFull, EXISTING_DEBT_SERVICE_RATE } from '../utils/calculations';
import companyProfiles from '../data/companyProfiles';

const INDUSTRY_OPTIONS = [
  'Manufacturing', 'Construction', 'Transportation/Logistics', 'Marine',
  'Rail', 'Energy', 'Healthcare', 'Infrastructure', 'Mining',
  'Agriculture', 'Aviation', 'Other',
];

const EQUIPMENT_OPTIONS = [
  'Heavy Machinery', 'Vehicles/Fleet', 'Rail Cars', 'Marine Vessels',
  'Aircraft/Helicopters', 'Medical Equipment', 'IT/Data Center',
  'Construction Equipment', 'Energy/Power Generation', 'Other',
];

const CREDIT_OPTIONS = ['Strong', 'Adequate', 'Weak', 'Not Rated'];

// ---- Inline Tooltip ----
function Tip({ text }) {
  return (
    <span className="relative group ml-1.5 inline-flex align-middle">
      <span className="w-4 h-4 rounded-full bg-slate-700/60 text-slate-500 text-[10px] font-bold inline-flex items-center justify-center cursor-help hover:text-gold-400 hover:bg-gold-500/10 transition-colors">
        ?
      </span>
      <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2.5 rounded-xl bg-slate-800 border border-slate-700/50 text-xs text-slate-300 w-60 text-left leading-relaxed shadow-2xl opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity duration-200 z-50">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-[5px] border-transparent border-t-slate-800" />
      </span>
    </span>
  );
}

// ---- Label ----
function Label({ children, required, tip }) {
  return (
    <label className="flex items-center gap-0 text-[11px] font-semibold text-slate-500 mb-2 uppercase tracking-wider">
      {children}
      {required && <span className="text-gold-400 ml-0.5">*</span>}
      {tip && <Tip text={tip} />}
    </label>
  );
}

// ---- Currency Input ----
function CurrencyInput({ label, value, onChange, placeholder, tip, required }) {
  return (
    <div>
      <Label required={required} tip={tip}>{label}</Label>
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-medium">$</span>
        <input
          type="text"
          inputMode="numeric"
          value={value ? Number(value).toLocaleString() : ''}
          onChange={(e) => {
            const raw = e.target.value.replace(/[^0-9.]/g, '');
            onChange(parseFloat(raw) || 0);
          }}
          placeholder={placeholder}
          className="form-input"
          style={{ paddingLeft: '2rem' }}
        />
      </div>
    </div>
  );
}

// ---- Select Input ----
function SelectInput({ label, value, onChange, options, tip, disabled }) {
  return (
    <div>
      <Label tip={tip}>{label}</Label>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={'form-select' + (disabled ? ' opacity-40 cursor-not-allowed' : '')}
          disabled={disabled}
        >
          {options.map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <svg className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </div>
  );
}

// ---- Company Search ----
function CompanySearch({ value, onSelect, onManualChange }) {
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
    ? companyProfiles.filter(c =>
        c.companyName.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 6)
    : [];

  return (
    <div ref={ref} className="relative">
      <Label tip="Start typing to search the company database. Select a match to auto-populate borrower financials.">
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
          placeholder="Search company database..."
          className="form-input"
          style={{ paddingLeft: '2.75rem' }}
        />
      </div>

      {/* Source badge */}
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

      {/* Dropdown */}
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
                  {company.industrySector} &middot; {formatCurrency(company.annualRevenue)} rev &middot; {company.creditRating}
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
function getInputWarnings(inputs) {
  const warnings = [];

  if (inputs.ebitda > 0 && inputs.annualRevenue > 0 && inputs.ebitda > inputs.annualRevenue) {
    warnings.push({
      id: 'ebitda-revenue',
      severity: 'error',
      text: 'EBITDA exceeds revenue — this is unusual. Verify both figures.',
    });
  }

  if (inputs.ebitda > 0 && inputs.annualRevenue > 0) {
    const margin = (inputs.ebitda / inputs.annualRevenue) * 100;
    if (margin > 50) {
      warnings.push({
        id: 'high-margin',
        severity: 'warn',
        text: `EBITDA margin of ${margin.toFixed(0)}% is unusually high. Confirm EBITDA excludes one-time items.`,
      });
    }
  }

  if (inputs.downPayment > 0 && inputs.equipmentCost > 0 && inputs.downPayment >= inputs.equipmentCost) {
    warnings.push({
      id: 'down-exceeds',
      severity: 'error',
      text: 'Down payment meets or exceeds equipment cost — no financing needed.',
    });
  }

  if (inputs.loanTerm > 0 && inputs.usefulLife > 0 && inputs.loanTerm > inputs.usefulLife * 12) {
    warnings.push({
      id: 'term-exceeds-life',
      severity: 'error',
      text: `Loan term (${inputs.loanTerm} mo) exceeds useful life (${inputs.usefulLife * 12} mo). Adjust term or useful life.`,
    });
  }

  if (inputs.totalExistingDebt > 0 && inputs.ebitda > 0 && inputs.totalExistingDebt > inputs.ebitda * 8) {
    warnings.push({
      id: 'extreme-leverage',
      severity: 'warn',
      text: `Existing debt is ${(inputs.totalExistingDebt / inputs.ebitda).toFixed(1)}x EBITDA — verify debt figure.`,
    });
  }

  if (inputs.actualAnnualDebtService > 0 && inputs.ebitda > 0 && inputs.actualAnnualDebtService > inputs.ebitda) {
    warnings.push({
      id: 'ds-exceeds-ebitda',
      severity: 'warn',
      text: 'Existing debt service exceeds EBITDA — borrower cannot cover current obligations from operations.',
    });
  }

  if (inputs.equipmentCost > 0 && inputs.annualRevenue > 0 && inputs.equipmentCost > inputs.annualRevenue) {
    warnings.push({
      id: 'cost-exceeds-rev',
      severity: 'warn',
      text: 'Equipment cost exceeds annual revenue — very large transaction relative to borrower size.',
    });
  }

  return warnings;
}

// ============ MAIN FORM ============

export default function DealInputForm({ inputs, onChange }) {
  const update = (field) => (value) => {
    onChange({ ...inputs, [field]: value });
  };

  const updateEvent = (field) => (e) => {
    const val = e.target.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
    onChange({ ...inputs, [field]: val });
  };

  const handleCompanySelect = (company) => {
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
  };

  const isTRACEligible = TRAC_ELIGIBLE_TYPES.includes(inputs.equipmentType);
  const financingType = inputs.financingType || 'EFA';

  if (financingType === 'TRAC' && !isTRACEligible) {
    onChange({ ...inputs, financingType: 'EFA' });
  }

  const termYears = inputs.loanTerm ? (inputs.loanTerm / 12).toFixed(1) : null;

  return (
    <div className="space-y-5">
      {/* Required note */}
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">
        <span className="text-gold-400">*</span> Required for screening
      </p>

      {/* ---- Borrower Profile ---- */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-300">
            Borrower Profile
          </h3>
        </div>

        <div className="space-y-4">
          {/* Company Search — full width */}
          <CompanySearch
            value={inputs.companyName}
            onSelect={handleCompanySelect}
            onManualChange={(val) => onChange({ ...inputs, companyName: val })}
          />

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label tip="How long the borrower has been operating. Longer track records reduce risk.">
                Years in Business
              </Label>
              <input
                type="number"
                value={inputs.yearsInBusiness || ''}
                onChange={updateEvent('yearsInBusiness')}
                placeholder="e.g. 10"
                className="form-input"
                min="0"
              />
            </div>
            <CurrencyInput
              label="Annual Revenue"
              value={inputs.annualRevenue}
              onChange={update('annualRevenue')}
              placeholder="50,000,000"
              required
              tip="Total annual revenue from most recent fiscal year."
            />
            <CurrencyInput
              label="EBITDA"
              value={inputs.ebitda}
              onChange={update('ebitda')}
              placeholder="8,000,000"
              required
              tip="Earnings Before Interest, Taxes, Depreciation & Amortization. Primary measure of cash flow for debt service."
            />
            <CurrencyInput
              label="Existing Debt"
              value={inputs.totalExistingDebt}
              onChange={update('totalExistingDebt')}
              placeholder="20,000,000"
              tip="All outstanding debt (loans, leases, lines). Used for leverage and existing debt service estimates."
            />
            <div>
              <CurrencyInput
                label="Actual Annual DS"
                value={inputs.actualAnnualDebtService}
                onChange={update('actualAnnualDebtService')}
                placeholder="Optional"
                tip={`If known, enter actual annual debt service. Otherwise we estimate at ${(EXISTING_DEBT_SERVICE_RATE * 100).toFixed(0)}% of total existing debt.`}
              />
              {!(inputs.actualAnnualDebtService > 0) && inputs.totalExistingDebt > 0 && (
                <p className="text-[10px] text-slate-600 mt-1 pl-1">
                  Est: {formatCurrencyFull(inputs.totalExistingDebt * EXISTING_DEBT_SERVICE_RATE)}/yr
                </p>
              )}
            </div>
            <SelectInput
              label="Industry"
              value={inputs.industrySector}
              onChange={update('industrySector')}
              options={INDUSTRY_OPTIONS}
              tip="Affects risk tier and rate. Healthcare & Infrastructure = low risk. Construction, Mining & Aviation = higher risk."
            />
            <SelectInput
              label="Credit Rating"
              value={inputs.creditRating}
              onChange={update('creditRating')}
              options={CREDIT_OPTIONS}
              tip="Borrower credit quality. Strong = investment-grade equivalent. Adequate = middle market. Weak = below average."
            />
          </div>
        </div>
      </div>

      {/* ---- Equipment & Deal ---- */}
      <div className="glass-card rounded-2xl p-6">
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-7 h-7 rounded-lg bg-gold-500/10 flex items-center justify-center">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" className="text-gold-400" strokeWidth="2">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </div>
          <h3 className="text-sm font-semibold text-slate-300">
            Equipment & Deal
          </h3>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <SelectInput
                label="Equipment Type"
                value={inputs.equipmentType}
                onChange={update('equipmentType')}
                options={EQUIPMENT_OPTIONS}
              />
              {EQUIPMENT_DEFAULTS[inputs.equipmentType] && (
                <p className="text-[10px] text-slate-600 mt-1 pl-1">
                  Typical life: {EQUIPMENT_DEFAULTS[inputs.equipmentType].usefulLifeRange[0]}–{EQUIPMENT_DEFAULTS[inputs.equipmentType].usefulLifeRange[1]} yrs
                  {EQUIPMENT_DEFAULTS[inputs.equipmentType].suggestedType !== (inputs.financingType || 'EFA') && (
                    <span className="text-gold-400 ml-1">
                      &middot; Common: {EQUIPMENT_DEFAULTS[inputs.equipmentType].suggestedType}
                    </span>
                  )}
                </p>
              )}
            </div>
            <div>
              <Label>Condition</Label>
              <div className="flex gap-2">
                {['New', 'Used'].map((cond) => (
                  <button
                    key={cond}
                    onClick={() => onChange({ ...inputs, equipmentCondition: cond })}
                    className={`pill-btn flex-1 py-2.5 rounded-xl text-sm font-medium text-center ${
                      inputs.equipmentCondition === cond ? 'pill-btn-active' : 'text-slate-400'
                    }`}
                  >
                    {cond}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CurrencyInput
              label="Equipment Cost"
              value={inputs.equipmentCost}
              onChange={update('equipmentCost')}
              placeholder="5,000,000"
              required
              tip="Total purchase price of the equipment."
            />
            <CurrencyInput
              label="Down Payment"
              value={inputs.downPayment}
              onChange={update('downPayment')}
              placeholder="500,000"
              tip="Upfront equity. Reduces financed amount and LTV. Typical: 10-20% of cost."
            />
          </div>

          {/* Financing Type */}
          <div>
            <Label tip="EFA = secured loan, borrower owns. FMV = operating lease, return at end. TRAC = fleet lease with guaranteed residual (vehicles/rail only).">
              Financing Structure
            </Label>
            <div className="grid grid-cols-3 gap-2">
              {Object.entries(FINANCING_TYPES).map(([key, ft]) => {
                const disabled = key === 'TRAC' && !isTRACEligible;
                const active = financingType === key;
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
                      {key === 'EFA' ? 'Borrower owns' : key === 'FMV' ? 'Return option' : 'Guaranteed residual'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label required tip="Expected economic useful life. Term should generally not exceed 80%.">
                Useful Life (Yrs)
              </Label>
              <input
                type="number"
                value={inputs.usefulLife || ''}
                onChange={updateEvent('usefulLife')}
                placeholder="15"
                className="form-input"
                min="1"
              />
            </div>
            <div>
              <Label required tip="Loan or lease duration. Compared against useful life.">
                Term (Months)
              </Label>
              <input
                type="number"
                value={inputs.loanTerm || ''}
                onChange={updateEvent('loanTerm')}
                placeholder="84"
                className="form-input"
                min="1"
              />
              {termYears && (
                <p className="text-[11px] text-slate-600 mt-1.5 pl-1 font-mono">
                  = {termYears} years
                </p>
              )}
            </div>
          </div>

          {/* Essential use toggle */}
          <div>
            <Label tip="Is this equipment critical to core revenue? Essential-use assets have stronger recovery profiles.">
              Essential-Use Equipment
            </Label>
            <button
              onClick={() => onChange({ ...inputs, essentialUse: !inputs.essentialUse })}
              className="flex items-center gap-3"
            >
              <div className={`toggle-track relative w-11 h-6 rounded-full ${inputs.essentialUse ? 'bg-gold-500' : 'bg-slate-700'}`}>
                <div className={`toggle-thumb absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md ${inputs.essentialUse ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
              </div>
              <span className={`text-sm font-medium ${inputs.essentialUse ? 'text-gold-300' : 'text-slate-500'}`}>
                {inputs.essentialUse ? 'Yes — Core Operations' : 'No'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Input Validation Warnings */}
      {(() => {
        const warnings = getInputWarnings(inputs);
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
