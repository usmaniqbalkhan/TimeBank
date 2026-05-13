import { useCallback, useEffect, useState } from 'react';
import { AuthContext } from './auth-context';
import {
  clearStoredSession,
  fetchAuthenticatedUser,
  fetchCurrentUserProfile,
  getStoredSession,
  isSupabaseConfigured,
  signInWithEmail,
  signOut,
  signUpWithEmail,
  storeSession,
} from '../lib/supabase';

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);

  const hydrateSession = useCallback(async (nextSession) => {
    if (!nextSession?.access_token) {
      setSession(null);
      setUser(null);
      setProfile(null);
      return null;
    }

    const nextUser = await fetchAuthenticatedUser(nextSession.access_token);
    const nextProfile = await fetchCurrentUserProfile(nextSession.access_token, nextUser.id);

    setSession(nextSession);
    setUser(nextUser);
    setProfile(nextProfile);

    return { nextUser, nextProfile };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrapAuth() {
      if (!isSupabaseConfigured()) {
        setAuthReady(true);
        return;
      }

      const storedSession = getStoredSession();

      if (!storedSession) {
        setAuthReady(true);
        return;
      }

      try {
        await hydrateSession(storedSession);
      } catch {
        clearStoredSession();

        if (!cancelled) {
          setSession(null);
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setAuthReady(true);
        }
      }
    }

    bootstrapAuth();

    return () => {
      cancelled = true;
    };
  }, [hydrateSession]);

  const login = useCallback(async (email, password) => {
    setAuthLoading(true);

    try {
      const nextSession = await signInWithEmail({ email, password });
      storeSession(nextSession);
      await hydrateSession(nextSession);
      return nextSession;
    } catch (error) {
      clearStoredSession();
      throw error;
    } finally {
      setAuthLoading(false);
      setAuthReady(true);
    }
  }, [hydrateSession]);

  const signup = useCallback(async ({ name, email, password }) => {
    setAuthLoading(true);

    try {
      const nextSession = await signUpWithEmail({ name, email, password });
      storeSession(nextSession);
      await hydrateSession(nextSession);
      return nextSession;
    } catch (error) {
      clearStoredSession();
      throw error;
    } finally {
      setAuthLoading(false);
      setAuthReady(true);
    }
  }, [hydrateSession]);

  const logout = useCallback(async () => {
    const accessToken = session?.access_token;

    clearStoredSession();
    setSession(null);
    setUser(null);
    setProfile(null);

    if (accessToken) {
      await signOut(accessToken);
    }
  }, [session]);

  const refreshProfile = useCallback(async () => {
    if (!session?.access_token || !user?.id) {
      return null;
    }

    const nextProfile = await fetchCurrentUserProfile(session.access_token, user.id);
    setProfile(nextProfile);
    return nextProfile;
  }, [session, user]);

  return (
    <AuthContext.Provider
      value={{
        authLoading,
        authReady,
        configured: isSupabaseConfigured(),
        login,
        logout,
        profile,
        refreshProfile,
        session,
        signup,
        user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
