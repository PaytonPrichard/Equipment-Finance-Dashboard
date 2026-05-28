import { useEffect, useRef, useCallback } from 'react';
import { registerSession, checkSession, heartbeatSession, clearSession } from '../lib/sessions';

const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const CHECK_INTERVAL = 30000; // 30 seconds

export function useSessionGuard(
  userId: string | null | undefined,
  enforce: boolean,
  onSessionConflict: () => void,
): void {
  const conflictRef = useRef<() => void>(onSessionConflict);
  conflictRef.current = onSessionConflict;

  const handleConflict = useCallback(() => {
    if (conflictRef.current) conflictRef.current();
  }, []);

  useEffect(() => {
    if (!enforce || !userId) return;

    registerSession(userId);

    const checkInterval = setInterval(async () => {
      const isValid = await checkSession(userId);
      if (!isValid) handleConflict();
    }, CHECK_INTERVAL);

    const heartbeatInterval = setInterval(() => {
      heartbeatSession(userId);
    }, HEARTBEAT_INTERVAL);

    const handleFocus = async () => {
      const isValid = await checkSession(userId);
      if (!isValid) handleConflict();
    };
    window.addEventListener('focus', handleFocus);

    return () => {
      clearInterval(checkInterval);
      clearInterval(heartbeatInterval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [userId, enforce, handleConflict]);

  useEffect(() => {
    return () => {
      if (enforce && userId) clearSession(userId);
    };
  }, [userId, enforce]);
}
