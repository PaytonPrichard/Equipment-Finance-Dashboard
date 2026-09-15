// Factor weights, shared.
//
// These lived inside ScoringWeights.js, which is lazy-loaded and only mounts
// inside the screening results pane. That made the component the only thing
// that ever read a firm's saved weights, so collapsing the pane silently
// reverted every deal to the defaults. App.js needs them at startup, and it
// cannot pull in a lazy chunk to get them.

export const DEFAULT_WEIGHTS = {
  dscr: 25,
  leverage: 20,
  industry: 15,
  essentiality: 10,
  equipmentLtv: 10,
  yearsInBusiness: 10,
  termCoverage: 10,
};

/** Saved weights, or null if the stored value is not a usable weight set. */
export function validateWeights(obj) {
  if (!obj) return null;
  const valid = Object.keys(DEFAULT_WEIGHTS).every(
    (k) => typeof obj[k] === 'number' && obj[k] >= 0 && obj[k] <= 40,
  );
  return valid ? obj : null;
}
