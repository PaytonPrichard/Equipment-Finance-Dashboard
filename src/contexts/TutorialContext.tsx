import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchPreferences, upsertPreferences } from '../lib/preferences';
import { isDemoMode } from '../lib/demoMode';

interface TutorialState {
  welcome_completed: boolean;
  beacons_dismissed: string[];
}

export interface TutorialContextValue {
  showWelcome: boolean;
  hasActiveBeacons: boolean;
  completeWelcome: () => void;
  dismissBeacon: (beaconId: string) => void;
  isBeaconActive: (beaconId: string) => boolean;
  resetTutorial: () => void;
  loaded: boolean;
}

const TutorialContext = createContext<TutorialContextValue | null>(null);

export function useTutorial(): TutorialContextValue {
  return useContext(TutorialContext) as TutorialContextValue;
}

const CACHE_KEY = 'efd_tutorial_state';
const ALL_BEACONS = ['form', 'score', 'stress', 'pipeline', 'nav', 'guide'];

function loadCachedState(): TutorialState | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached) as TutorialState;
  } catch { /* ignore */ }
  return null;
}

function saveCachedState(state: TutorialState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function TutorialProvider({ children, userId }: { children: React.ReactNode; userId?: string }): React.ReactElement {
  const [state, setState] = useState<TutorialState>(() => {
    if (isDemoMode()) return { welcome_completed: true, beacons_dismissed: [] };
    return loadCachedState() || { welcome_completed: false, beacons_dismissed: [] };
  });
  const [loaded, setLoaded] = useState<boolean>(isDemoMode());

  // Load from Supabase on mount
  useEffect(() => {
    if (!userId) { setLoaded(true); return; }
    const cached = loadCachedState();
    if (cached?.welcome_completed !== undefined) {
      setState(cached);
      setLoaded(true);
    }
    fetchPreferences(userId).then(({ data }) => {
      if (data?.tutorial_state) {
        setState(data.tutorial_state as TutorialState);
        saveCachedState(data.tutorial_state as TutorialState);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [userId]);

  const persistState = useCallback((newState: TutorialState) => {
    saveCachedState(newState);
    if (userId) {
      upsertPreferences(userId, { tutorial_state: newState }).catch(console.error);
    }
  }, [userId]);

  const completeWelcome = useCallback(() => {
    const next: TutorialState = { ...state, welcome_completed: true };
    setState(next);
    persistState(next);
  }, [state, persistState]);

  const dismissBeacon = useCallback((beaconId: string) => {
    setState((prev) => {
      if (prev.beacons_dismissed.includes(beaconId)) return prev;
      const next: TutorialState = { ...prev, beacons_dismissed: [...prev.beacons_dismissed, beaconId] };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const isBeaconActive = useCallback((beaconId: string): boolean => {
    return state.welcome_completed && !state.beacons_dismissed.includes(beaconId);
  }, [state]);

  const resetTutorial = useCallback(() => {
    const next: TutorialState = { welcome_completed: false, beacons_dismissed: [] };
    setState(next);
    persistState(next);
  }, [persistState]);

  const showWelcome = loaded && !state.welcome_completed;
  const hasActiveBeacons = state.welcome_completed && state.beacons_dismissed.length < ALL_BEACONS.length;

  return (
    <TutorialContext.Provider value={{
      showWelcome,
      hasActiveBeacons,
      completeWelcome,
      dismissBeacon,
      isBeaconActive,
      resetTutorial,
      loaded,
    }}>
      {children}
    </TutorialContext.Provider>
  );
}
