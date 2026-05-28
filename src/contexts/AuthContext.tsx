import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import type { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { resolvePermissions } from '../lib/permissions';
import { isDemoMode } from '../lib/demoMode';
import { DEMO_PROFILE, DEMO_USER } from '../data/demoPipeline';
import type { UserRole, PermissionsMap } from '../types';

export interface ProfileRow {
  id: string;
  org_id: string | null;
  role: UserRole;
  full_name: string | null;
  email: string | null;
  avatar_url?: string | null;
  created_at: string;
  organizations?: {
    name: string;
    branding?: unknown;
    org_settings?: unknown;
  } | null;
}

export interface AuthContextValue {
  user: User | null;
  profile: ProfileRow | null;
  session: Session | null;
  permissions: PermissionsMap | null;
  loading: boolean;
  passwordRecovery: boolean;
  emailVerified: boolean;
  signIn: (email: string, password: string) => Promise<{ data: unknown; error: unknown }>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ data: unknown; error: unknown }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

const OFFLINE_CONTEXT: AuthContextValue = {
  user: null,
  profile: null,
  session: null,
  permissions: null,
  loading: false,
  passwordRecovery: false,
  emailVerified: false,
  signIn: async () => ({ data: null, error: { message: 'Auth unavailable in offline mode' } }),
  signUp: async () => ({ data: null, error: { message: 'Auth unavailable in offline mode' } }),
  signOut: async () => {},
  refreshProfile: async () => {},
};

const DEMO_CONTEXT: AuthContextValue = {
  user: DEMO_USER as unknown as User,
  profile: DEMO_PROFILE as unknown as ProfileRow,
  session: { user: DEMO_USER as unknown as User, access_token: 'demo' } as Session,
  permissions: resolvePermissions('admin', []),
  loading: false,
  passwordRecovery: false,
  emailVerified: true,
  signIn: async () => ({ data: null, error: { message: 'Sign in disabled in demo mode' } }),
  signUp: async () => ({ data: null, error: { message: 'Sign up disabled in demo mode' } }),
  signOut: async () => { window.location.href = '/'; },
  refreshProfile: async () => {},
};

const CACHE_KEY = 'efd_profile_cache';

function getAuthStorageKey(): string | null {
  try {
    return `sb-${new URL(process.env.REACT_APP_SUPABASE_URL!).hostname.split('.')[0]}-auth-token`;
  } catch {
    return null;
  }
}

function readCachedProfile(userId: string): ProfileRow | null {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed?.id === userId) return parsed as ProfileRow;
    }
  } catch { /* ignore */ }
  return null;
}

function writeCachedProfile(profile: ProfileRow): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(profile));
  } catch { /* ignore */ }
}

export function AuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  if (isDemoMode()) {
    return <DemoAuthProvider>{children}</DemoAuthProvider>;
  }
  return <RealAuthProvider>{children}</RealAuthProvider>;
}

function DemoAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  return (
    <AuthContext.Provider value={DEMO_CONTEXT}>
      {children}
    </AuthContext.Provider>
  );
}

function RealAuthProvider({ children }: { children: React.ReactNode }): React.ReactElement {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [permissions, setPermissions] = useState<PermissionsMap | null>(null);
  const [loading, setLoading] = useState<boolean>(!!supabase);
  const [passwordRecovery, setPasswordRecovery] = useState<boolean>(false);
  const [emailVerified, setEmailVerified] = useState<boolean>(false);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchingRef = useRef<boolean>(false);

  const fetchProfile = useCallback(async (authUser: User) => {
    if (!supabase || !authUser || fetchingRef.current) return;
    fetchingRef.current = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*, organizations(name, branding, org_settings)')
        .eq('id', authUser.id)
        .maybeSingle();

      if (error) {
        const fallback = await supabase
          .from('profiles')
          .select('*, organizations(name, branding)')
          .eq('id', authUser.id)
          .maybeSingle();

        if (fallback.data) {
          setProfile(fallback.data as ProfileRow);
          writeCachedProfile(fallback.data as ProfileRow);
          const role = (fallback.data as ProfileRow).role || 'analyst';
          setPermissions(resolvePermissions(role, []));
          fetchingRef.current = false;
          return;
        }

        console.warn('Profile fetch failed, retrying in 5s:', error.message);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          fetchingRef.current = false;
          fetchProfile(authUser);
        }, 5000);
        fetchingRef.current = false;
        return;
      }

      if (data) {
        setProfile(data as ProfileRow);
        writeCachedProfile(data as ProfileRow);

        let orgOverrides: any[] = [];
        if ((data as ProfileRow).org_id) {
          const { data: overrides } = await supabase
            .from('org_permissions')
            .select('*')
            .eq('org_id', (data as ProfileRow).org_id);
          orgOverrides = overrides || [];
        }

        const role = (data as ProfileRow).role || 'analyst';
        setPermissions(resolvePermissions(role, orgOverrides));
      }
    } catch (err) {
      console.error('Profile fetch error:', err);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
      retryTimerRef.current = setTimeout(() => {
        fetchingRef.current = false;
        fetchProfile(authUser);
      }, 5000);
    }

    fetchingRef.current = false;
  }, []);

  useEffect(() => {
    if (!supabase) return;

    let mounted = true;

    const init = () => {
      const storageKey = getAuthStorageKey();
      if (!storageKey) { setLoading(false); return; }

      let authUser: User | null = null;
      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          const parsed = JSON.parse(stored);
          authUser = parsed?.user ?? null;
          if (mounted && authUser) {
            setSession(parsed);
            setUser(authUser);
            setEmailVerified(!!(authUser as User & { email_confirmed_at?: string }).email_confirmed_at);
          }
        }
      } catch { /* ignore */ }

      if (authUser) {
        const cached = readCachedProfile(authUser.id);
        if (cached && mounted) {
          setProfile(cached);
          const role = cached.role || 'analyst';
          setPermissions(resolvePermissions(role, []));
        }
      }

      if (mounted) setLoading(false);

      if ((authUser as any)?.email_confirmed_at) {
        fetchProfile(authUser!);
      }

      supabase!.auth.getSession().catch(() => {});
    };

    init();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, newSession) => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY') {
          setPasswordRecovery(true);
        }

        const authUser = newSession?.user ?? null;
        setSession(newSession);
        setUser(authUser);
        setEmailVerified(!!(authUser as any)?.email_confirmed_at);

        if (event === 'SIGNED_IN' && (authUser as any)?.email_confirmed_at) {
          fetchProfile(authUser!);
        } else if (event === 'SIGNED_OUT') {
          setProfile(null);
          setPermissions(null);
        }

        setLoading(false);
      },
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [fetchProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) return { data: null, error: { message: 'Auth unavailable in offline mode' } };
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) return { data: null, error: { message: 'Auth unavailable in offline mode' } };
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    return { data, error };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;

    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.removeItem('efd_tutorial_state');
      localStorage.removeItem('efd_session_token');
      const storageKey = getAuthStorageKey();
      if (storageKey) localStorage.removeItem(storageKey);
    } catch { /* ignore */ }

    setSession(null);
    setUser(null);
    setProfile(null);
    setPermissions(null);
    setEmailVerified(false);

    await supabase.auth.signOut().catch(() => {});

    window.location.href = '/';
  }, []);

  const refreshProfile = useCallback(async () => {
    if (user) {
      fetchingRef.current = false;
      await fetchProfile(user);
    }
  }, [user, fetchProfile]);

  if (!supabase) {
    return (
      <AuthContext.Provider value={OFFLINE_CONTEXT}>
        {children}
      </AuthContext.Provider>
    );
  }

  return (
    <AuthContext.Provider value={{
      user,
      profile,
      session,
      permissions,
      loading,
      passwordRecovery,
      emailVerified,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export default AuthContext;
