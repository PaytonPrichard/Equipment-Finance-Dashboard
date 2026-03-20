import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

/**
 * Calls `onIdle` after `timeoutMs` of no user interaction.
 * Resets the timer on mouse, keyboard, scroll, or touch events.
 */
export function useIdleTimeout(onIdle, timeoutMs = IDLE_TIMEOUT_MS) {
  const timerRef = useRef(null);

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(onIdle, timeoutMs);
  }, [onIdle, timeoutMs]);

  useEffect(() => {
    resetTimer();

    EVENTS.forEach((event) => window.addEventListener(event, resetTimer, { passive: true }));

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      EVENTS.forEach((event) => window.removeEventListener(event, resetTimer));
    };
  }, [resetTimer]);
}
