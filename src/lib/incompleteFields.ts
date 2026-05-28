// ============================================================
// Incomplete Fields Detection
//
// Identifies missing required fields for screening based on
// the active module's schema. Used for badges, highlights,
// and Request Info email generation.
// ============================================================

interface SchemaField {
  key: string;
  label: string;
  required?: boolean;
}

interface SchemaSection {
  title: string;
  fields: SchemaField[];
}

export interface DealSchema {
  sections: SchemaSection[];
}

export interface MissingField {
  key: string;
  label: string;
  section: string;
}

interface RequestInfoEmailParams {
  dealName?: string;
  brokerName?: string;
  missingFields: MissingField[];
  analystName?: string;
  analystEmail?: string;
}

export function getMissingFields(inputs: Record<string, unknown>, schema: DealSchema | null | undefined): MissingField[] {
  const missing: MissingField[] = [];

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
  if (!inputs.companyName || (inputs.companyName as string).trim() === '') {
    missing.unshift({ key: 'companyName', label: 'Company Name', section: 'Borrower Profile' });
  }

  return missing;
}

export function generateRequestInfoEmail({ dealName, brokerName, missingFields, analystName }: RequestInfoEmailParams): string {
  const obligor = dealName || 'the proposed deal';
  const broker = brokerName || 'Team';
  const analyst = analystName || 'the screening team';

  const fieldList = missingFields.map((f) => `  - ${f.label}`).join('\n');

  const subject = encodeURIComponent(`Additional Information Needed — ${obligor} Equipment Financing`);

  const body = encodeURIComponent(
    `Hi ${broker},\n\n` +
    `We're reviewing the ${obligor} deal and need the following to complete our screening:\n\n` +
    `${fieldList}\n\n` +
    `Please send at your earliest convenience.\n\n` +
    `Thanks,\n${analyst}`,
  );

  return `mailto:?subject=${subject}&body=${body}`;
}
