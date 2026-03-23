// ============================================================
// Incomplete Fields Detection
//
// Identifies missing required fields for screening based on
// the active module's schema. Used for badges, highlights,
// and Request Info email generation.
// ============================================================

/**
 * Get list of missing required fields for the current inputs and schema.
 * Returns array of { key, label } for each missing field.
 */
export function getMissingFields(inputs, schema) {
  const missing = [];

  if (!schema?.sections) return missing;

  for (const section of schema.sections) {
    for (const field of section.fields) {
      if (!field.required) continue;

      const value = inputs[field.key];
      const isEmpty = value === undefined || value === null || value === '' || value === 0;

      if (isEmpty) {
        missing.push({ key: field.key, label: field.label, section: section.title });
      }
    }
  }

  // Also check company name (not marked required in schema but important for tracking)
  if (!inputs.companyName || inputs.companyName.trim() === '') {
    missing.unshift({ key: 'companyName', label: 'Company Name', section: 'Borrower Profile' });
  }

  return missing;
}

/**
 * Generate a Request Info email body with missing fields checklist.
 */
export function generateRequestInfoEmail({ dealName, brokerName, missingFields, analystName, analystEmail }) {
  const obligor = dealName || 'the proposed deal';
  const broker = brokerName || 'Team';
  const analyst = analystName || 'the screening team';

  const fieldList = missingFields.map(f => `  - ${f.label}`).join('\n');

  const subject = encodeURIComponent(`Additional Information Needed — ${obligor} Equipment Financing`);

  const body = encodeURIComponent(
    `Hi ${broker},\n\n` +
    `We're reviewing the ${obligor} deal and need the following to complete our screening:\n\n` +
    `${fieldList}\n\n` +
    `Please send at your earliest convenience.\n\n` +
    `Thanks,\n${analyst}`
  );

  return `mailto:?subject=${subject}&body=${body}`;
}
