// ============================================================
// Module Registry — Asset Class Modules
//
// To add a new asset class:
// 1. Create src/modules/your-module/ with constants.js, scoring.js, index.js
// 2. Import and register it below
// 3. Add to the org_modules table for orgs that need it
// ============================================================

import * as equipmentFinance from './equipment-finance';
import * as accountsReceivable from './accounts-receivable';
import * as inventoryFinance from './inventory-finance';

const MODULES = {
  equipment_finance: equipmentFinance,
  accounts_receivable: accountsReceivable,
  inventory_finance: inventoryFinance,
};

/**
 * Get a module by key. Falls back to equipment_finance.
 */
export function getModule(key) {
  return MODULES[key] || MODULES.equipment_finance;
}

/**
 * Get all available modules (for admin UI / plan gating).
 */
export function getAvailableModules() {
  return Object.entries(MODULES).map(([key, mod]) => ({
    key,
    ...mod.META,
  }));
}

/**
 * Default module key.
 */
export const DEFAULT_MODULE = 'equipment_finance';
