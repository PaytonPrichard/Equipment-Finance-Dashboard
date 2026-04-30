import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { fetchPreferences, upsertPreferences } from '../lib/preferences';
import { isDemoMode } from '../lib/demoMode';

const TutorialContext = createContext(null);

export function useTutorial() {
  return useContext(TutorialContext);
}

const CACHE_KEY = 'efd_tutorial_state';
const ALL_BEACONS = ['form', 'score', 'stress', 'pipeline', 'nav', 'guide'];

function loadCachedState() {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) return JSON.parse(cached);
  } catch { /* ignore */ }
  return null;
}

function saveCachedState(state) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state));
  } catch { /* ignore */ }
}

export function TutorialProvider({ children, userId }) {
  const [state, setState] = useState(() => {
    if (isDemoMode()) return { welcome_completed: true, beacons_dismissed: [] };
    return loadCachedState() || { welcome_completed: false, beacons_dismissed: [] };
  });
  const [loaded, setLoaded] = useState(isDemoMode());

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
        setState(data.tutorial_state);
        saveCachedState(data.tutorial_state);
      }
      setLoaded(true);
    }).catch(() => setLoaded(true));
  }, [userId]);

  // Persist to Supabase + cache on state change
  const persistState = useCallback((newState) => {
    saveCachedState(newState);
    if (userId) {
      upsertPreferences(userId, { tutorial_state: newState }).catch(console.error);
    }
  }, [userId]);

  const completeWelcome = useCallback(() => {
    const next = { ...state, welcome_completed: true };
    setState(next);
    persistState(next);
  }, [state, persistState]);

  const dismissBeacon = useCallback((beaconId) => {
    setState(prev => {
      if (prev.beacons_dismissed.includes(beaconId)) return prev;
      const next = { ...prev, beacons_dismissed: [...prev.beacons_dismissed, beaconId] };
      persistState(next);
      return next;
    });
  }, [persistState]);

  const isBeaconActive = useCallback((beaconId) => {
    return state.welcome_completed && !state.beacons_dismissed.includes(beaconId);
  }, [state]);

  const resetTutorial = useCallback(() => {
    const next = { welcome_completed: false, beacons_dismissed: [] };
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
