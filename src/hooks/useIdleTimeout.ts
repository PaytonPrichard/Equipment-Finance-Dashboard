import { useEffect, useRef, useCallback } from 'react';

const IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000; // 8 hours
const EVENTS = ['mousedown', 'keydown', 'scroll', 'touchstart'];

export function useIdleTimeout(onIdle: () => void, timeoutMs: number = IDLE_TIMEOUT_MS): void {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
