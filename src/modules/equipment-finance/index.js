// ============================================================
// Equipment Finance Module — Barrel Export
// ============================================================

export const META = {
  key: 'equipment_finance',
  name: 'Equipment Finance',
  description: 'Deal screening for equipment loans, EFA, FMV leases, and TRAC leases',
  icon: 'briefcase',
};

// Re-export everything from constants, scoring, and schema
export * from './constants';
export * from './scoring';
export { FORM_SCHEMA } from './schema';
