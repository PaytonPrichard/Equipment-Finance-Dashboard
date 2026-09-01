// ============================================================
// Server-side score recomputation.
//
// Bridges CJS api/* to ESM src/modules/* via dynamic import().
// The loader map keys directly to import() with static specifiers,
// so Vercel's file tracer can statically resolve each path and
// bundle the module graph (format.ts + borrowerMetrics + constants).
//
// Errors carry a `kind`: 'request' means the caller sent something
// unusable (400), 'server' means scoring itself failed (500). Callers
// that already validated asset_class and inputs will only ever see
// 'server'. Returning 400 for those masked real failures as client
// errors (AUDIT P1-11).
//
// SOFR: we deliberately pass no sofr argument, so each module's
// DEFAULT_SOFR is used. The browser may use a live SOFR via
// useSofrRate; the server uses the calibrated default to keep
// the authoritative score deterministic for a given inputs payload.
// ============================================================

const MODULE_LOADERS = {
  equipment_finance: () => import('../src/modules/equipment-finance/scoring.ts'),
  accounts_receivable: () => import('../src/modules/accounts-receivable/scoring.ts'),
  inventory_finance: () => import('../src/modules/inventory-finance/scoring.ts'),
};

const VALID_ASSET_CLASSES = Object.keys(MODULE_LOADERS);

async function recomputeScore(assetClass, inputs) {
  console.log('[scoring] recomputeScore called', {
    assetClass,
    hasInputs: !!inputs,
    inputKeys: inputs ? Object.keys(inputs).slice(0, 8) : [],
  });
  if (!MODULE_LOADERS[assetClass]) {
    return {
      score: null,
      error: `Unknown asset_class "${assetClass}". Valid: ${VALID_ASSET_CLASSES.join(', ')}`,
      kind: 'request',
    };
  }
  if (!inputs || typeof inputs !== 'object') {
    return { score: null, error: 'inputs is required to compute a score', kind: 'request' };
  }

  try {
    const mod = await MODULE_LOADERS[assetClass]();
    const metrics = mod.calculateMetrics(inputs);
    const risk = mod.calculateRiskScore(inputs, metrics);
    const score = risk && risk.composite;
    if (typeof score !== 'number' || !Number.isFinite(score)) {
      return { score: null, error: 'Scoring produced an invalid composite', kind: 'server' };
    }
    console.log('[scoring] recomputeScore success', { assetClass, score });
    return { score, error: null, kind: null };
  } catch (err) {
    console.error('[scoring] recomputeScore error:', err);
    // err.message can carry internals (module paths, stack detail). Log it,
    // don't return it.
    return { score: null, error: 'Scoring failed', kind: 'server' };
  }
}

module.exports = { recomputeScore, VALID_ASSET_CLASSES };
