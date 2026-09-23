import {
  STAGE_ORDER,
  STAGE_MOVES,
  backStage,
  blockedReason,
  canTransition,
  forwardStage,
  isTerminalStage,
} from './pipelineStages';

describe('the happy path', () => {
  test('walks forward to Funded and stops', () => {
    expect(forwardStage('Screening')).toBe('Under Review');
    expect(forwardStage('Under Review')).toBe('Approved');
    expect(forwardStage('Approved')).toBe('Funded');
    expect(forwardStage('Funded')).toBeNull();
  });

  test('walks back to Screening and stops', () => {
    expect(backStage('Funded')).toBe('Approved');
    expect(backStage('Approved')).toBe('Under Review');
    expect(backStage('Under Review')).toBe('Screening');
    expect(backStage('Screening')).toBeNull();
  });
});

describe('Declined is a branch, not the stage after Funded', () => {
  // Both of these were live on the board. Declined sits last in the array,
  // so stepping forward from Funded landed on it and stepping back from
  // Declined landed on Funded.
  test('a funded deal cannot be declined', () => {
    expect(forwardStage('Funded')).not.toBe('Declined');
    expect(canTransition('Funded', 'Declined')).toBe(false);
  });

  test('a declined deal does not step back into Funded', () => {
    expect(backStage('Declined')).toBe('Screening');
    expect(canTransition('Declined', 'Funded')).toBe(false);
  });

  test('every working stage can decline a deal', () => {
    expect(canTransition('Screening', 'Declined')).toBe(true);
    expect(canTransition('Under Review', 'Declined')).toBe(true);
    expect(canTransition('Approved', 'Declined')).toBe(true);
  });

  test('a declined deal reopens at Screening and nowhere else', () => {
    expect(STAGE_MOVES.Declined.allowed).toEqual(['Screening']);
  });

  test('a funded deal can only be unwound to Approved', () => {
    expect(STAGE_MOVES.Funded.allowed).toEqual(['Approved']);
  });
});

describe('aging', () => {
  test('applies to the stages a deal is worked in', () => {
    expect(isTerminalStage('Screening')).toBe(false);
    expect(isTerminalStage('Under Review')).toBe(false);
    expect(isTerminalStage('Approved')).toBe(false);
  });

  test('and not to the ones it comes to rest in', () => {
    expect(isTerminalStage('Funded')).toBe(true);
    expect(isTerminalStage('Declined')).toBe(true);
  });
});

describe('the model holds together', () => {
  test('every stage has an entry', () => {
    STAGE_ORDER.forEach((stage) => {
      expect(STAGE_MOVES[stage]).toBeDefined();
    });
  });

  test('forward and back are always themselves allowed', () => {
    STAGE_ORDER.forEach((stage) => {
      const { forward, back, allowed } = STAGE_MOVES[stage];
      if (forward) expect(allowed).toContain(forward);
      if (back) expect(allowed).toContain(back);
    });
  });

  test('every target is a real stage, and never the stage itself', () => {
    STAGE_ORDER.forEach((stage) => {
      STAGE_MOVES[stage].allowed.forEach((target) => {
        expect(STAGE_ORDER).toContain(target);
        expect(target).not.toBe(stage);
      });
    });
  });

  test('a deal never transitions to where it already is', () => {
    STAGE_ORDER.forEach((stage) => {
      expect(canTransition(stage, stage)).toBe(false);
    });
  });
});

describe('blockedReason tells the user which of the three it is', () => {
  test('the end of the line reads as a workflow rule, not a dead button', () => {
    expect(blockedReason('Funded', null, true)).toMatch(/monitoring/i);
    expect(blockedReason('Declined', null, true)).toMatch(/reopen/i);
  });

  test('an illegal move names both stages', () => {
    expect(blockedReason('Funded', 'Declined', true)).toBe(
      'A deal cannot move from Funded to Declined.',
    );
  });

  test('a missing permission is distinguishable from an illegal move', () => {
    expect(blockedReason('Approved', 'Funded', false)).toMatch(/permission/i);
  });

  test('and a legal move reports nothing', () => {
    expect(blockedReason('Approved', 'Funded', true)).toBeNull();
  });
});
