import React, { useState, useRef, useEffect } from 'react';

// A number field where blank stays blank. Used by the cash-flow inputs,
// which must tell "not provided" from 0 (src/modules/cashFlowFields.js).
// Holds its own text so a lone "-" or a trailing "." survives typing.
export default function NullableNumberInput({ value, onChange, prefix, suffix, allowNegative, max, placeholder, ariaLabel }) {
  const format = (v) => (v === null || v === undefined || v === '' ? '' : Number(v).toLocaleString('en-US', { maximumFractionDigits: 2 }));
  const [text, setText] = useState(() => format(value));
  const editing = useRef(false);
  useEffect(() => {
    if (!editing.current) setText(format(value));
  }, [value]);

  const handle = (raw) => {
    const pattern = allowNegative ? /[^0-9.-]/g : /[^0-9.]/g;
    let cleaned = raw.replace(pattern, '');
    if (allowNegative) cleaned = (cleaned.startsWith('-') ? '-' : '') + cleaned.replace(/-/g, '');
    setText(cleaned);
    if (cleaned === '' || cleaned === '-' || cleaned === '.') { onChange(null); return; }
    let n = parseFloat(cleaned);
    if (!Number.isFinite(n)) { onChange(null); return; }
    if (max != null && n > max) n = max;
    onChange(n);
  };

  return (
    <div className="relative">
      {prefix && <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{prefix}</span>}
      <input
        type="text"
        inputMode="decimal"
        value={text}
        onFocus={() => { editing.current = true; }}
        onBlur={() => { editing.current = false; setText(format(value)); }}
        onChange={(e) => handle(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="form-input"
        style={{ ...(prefix ? { paddingLeft: '2rem' } : {}), ...(suffix ? { paddingRight: '2rem' } : {}) }}
      />
      {suffix && <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">{suffix}</span>}
    </div>
  );
}
