// One definition of the pipeline's stages and the moves between them.
//
// There were two lists before, `STAGES` in DealPipeline.js as objects and
// `STAGES` in DealDetail.js as strings, and neither carried any rule about
// which move is legal. Both surfaces just walked the array, so a deal could
// only ever step one index at a time and Declined, being last, behaved as
// though it came after Funded. The board offered "Declined ›" on a funded
// deal and "‹ Funded" on a declined one. Neither is a thing a lender does.
//
// Declined is a terminal branch off the working stages, not the end of the
// line. That is a fact about credit workflow, so it belongs in one place
// rather than being re-derived from array positions by each component.

/** Left to right on the board. Declined sits last because it is where declined deals collect, not because it follows Funded. */
export const STAGE_ORDER = ['Screening', 'Under Review', 'Approved', 'Funded', 'Declined'];

/**
 * Every move a deal is allowed to make, by current stage.
 *
 * - `forward` / `back` are the happy path, and are what the board's two
 *   arrows offer. Either can be null, which is what disables the arrow.
 * - `allowed` is every legal target, which is what the drawer's stage picker
 *   is checked against. It is a superset of forward and back.
 *
 * Why each terminal rule is here:
 * - Funded has no forward move. A funded deal is not declined later; it is
 *   monitored, and if it goes bad that is a covenant breach, not a stage.
 *   Back to Approved stays open so a funding booked in error can be undone.
 * - Declined goes back to Screening, not to Funded. Reopening a declined
 *   file means working it again from the top.
 */
export const STAGE_MOVES = {
  'Screening': { forward: 'Under Review', back: null, allowed: ['Under Review', 'Declined'] },
  'Under Review': { forward: 'Approved', back: 'Screening', allowed: ['Screening', 'Approved', 'Declined'] },
  'Approved': { forward: 'Funded', back: 'Under Review', allowed: ['Under Review', 'Funded', 'Declined'] },
  'Funded': { forward: null, back: 'Approved', allowed: ['Approved'] },
  'Declined': { forward: null, back: 'Screening', allowed: ['Screening'] },
};

/** Stages a deal is still being worked in. Aging matters here and nowhere else. */
export const ACTIVE_STAGES = ['Screening', 'Under Review', 'Approved'];

/** True when a deal has reached a stage it does not age out of. */
export function isTerminalStage(stage) {
  return !ACTIVE_STAGES.includes(stage);
}

/** The next stage on the happy path, or null at the end of it. */
export function forwardStage(stage) {
  return STAGE_MOVES[stage]?.forward ?? null;
}

/** The previous stage on the happy path, or null at the start of it. */
export function backStage(stage) {
  return STAGE_MOVES[stage]?.back ?? null;
}

/** Whether a deal in `from` may be moved to `to`. */
export function canTransition(from, to) {
  if (from === to) return false;
  return Boolean(STAGE_MOVES[from]?.allowed.includes(to));
}

/**
 * Why a move is not offered, for the button's tooltip.
 *
 * Returns null when the move is legal. The three cases read differently to
 * the user and used to be collapsed into one greyed-out button with an empty
 * title, so a missing permission looked identical to the end of the pipeline.
 */
export function blockedReason(from, to, hasPermission) {
  if (!to) {
    return from === 'Funded'
      ? 'A funded deal does not move forward. Set up monitoring instead.'
      : from === 'Declined'
        ? 'Declined is the end of the line. Move it back to Screening to reopen it.'
        : 'No stage before this one.';
  }
  if (!canTransition(from, to)) return `A deal cannot move from ${from} to ${to}.`;
  if (!hasPermission) return `You do not have permission to move deals to ${to}.`;
  return null;
}
