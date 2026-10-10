import { DEFAULT_SOFR } from './calculations';

// The SOFR banner: did the rate move since the previous session? `stored`
// is the raw localStorage value. Returns the previous rate when the move is
// over 25 bps, else null. A stored value equal to the 4.25% placeholder
// came from an old bug that saved it before the live rate loaded, so it
// never counts.
export const SOFR_ALERT_BPS = 0.0025;

export function sofrMoveSinceLastSession(stored, sofr) {
  if (stored === null || stored === undefined || !sofr) return null;
  const last = parseFloat(stored);
  if (isNaN(last) || last === DEFAULT_SOFR) return null;
  return Math.abs(sofr - last) > SOFR_ALERT_BPS ? last : null;
}
