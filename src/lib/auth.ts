/**
 * src/lib/auth.ts
 *
 * Auth context + token management for Supabase Auth.
 * Stores tokens in localStorage. Auto-refreshes on page load.
 *
 * Usage:
 *   const { user, signIn, signUp, signOut, loading } = useAuth();
 */

import { createContext, useContext, useEffect, useState, useCallback } from "react";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id           : string;
  email        : string;
  name         : string | null;
  avatarUrl    : string | null;
  provider     : string;
  emailConfirmed: boolean;
}

export interface AuthSession {
  access_token : string;
  refresh_token: string;
  expires_in   : number;
}

export interface AuthState {
  user    : AuthUser | null;
  session : AuthSession | null;
  loading : boolean;
  signIn  : (email: string, password: string) => Promise<{ error?: string }>;
  signUp  : (email: string, password: string, name?: string) => Promise<{ error?: string; needsConfirmation?: boolean }>;
  signOut : () => Promise<void>;
  getToken: () => string | null;
}

// ── Storage keys ──────────────────────────────────────────────────────────────

const ACCESS_KEY  = "apt_access_token";
const REFRESH_KEY = "apt_refresh_token";
const USER_KEY    = "apt_user";

// ── Helpers ───────────────────────────────────────────────────────────────────

function saveSession(session: AuthSession, user: AuthUser) {
  localStorage.setItem(ACCESS_KEY,  session.access_token);
  localStorage.setItem(REFRESH_KEY, session.refresh_token);
  localStorage.setItem(USER_KEY,    JSON.stringify(user));
}

function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

function loadStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function loadStoredToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

function loadStoredRefreshToken(): string | null {
  return localStorage.getItem(REFRESH_KEY);
}

// ── Auth API calls ────────────────────────────────────────────────────────────

async function apiSignIn(email: string, password: string) {
  const resp = await fetch("/api/auth/signin", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ email, password }),
  });
  return resp.json();
}

async function apiSignUp(email: string, password: string, name?: string) {
  const resp = await fetch("/api/auth/signup", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ email, password, name }),
  });
  return resp.json();
}

async function apiSignOut(token: string) {
  try {
    await fetch("/api/auth/signout", {
      method : "POST",
      headers: { "Authorization": `Bearer ${token}` },
    });
  } catch { /* ignore — clear locally regardless */ }
}

async function apiRefresh(refreshToken: string) {
  const resp = await fetch("/api/auth/refresh", {
    method : "POST",
    headers: { "Content-Type": "application/json" },
    body   : JSON.stringify({ refresh_token: refreshToken }),
  });
  return resp.json();
}

// ── Context ───────────────────────────────────────────────────────────────────

import React from "react";

export const AuthContext = createContext<AuthState>({
  user    : null,
  session : null,
  loading : true,
  signIn  : async () => ({}),
  signUp  : async () => ({}),
  signOut : async () => {},
  getToken: () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUser]    = useState<AuthUser | null>(loadStoredUser);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  // On mount: try to restore session from stored refresh token
  useEffect(() => {
    const refresh = loadStoredRefreshToken();
    const stored  = loadStoredToken();

    if (!refresh) {
      setLoading(false);
      return;
    }

    // Validate by refreshing
    apiRefresh(refresh)
      .then((data) => {
        if (data.success && data.session) {
          setSession(data.session);
          setUser(data.user);
          saveSession(data.session, data.user);
        } else {
          clearSession();
          setUser(null);
          setSession(null);
        }
      })
      .catch(() => {
        // Network error — keep stored user optimistically but clear on next auth call
        if (stored) {
          setSession({ access_token: stored, refresh_token: refresh, expires_in: 3600 });
        }
      })
      .finally(() => setLoading(false));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await apiSignIn(email, password);
    if (!data.success) return { error: data.error || "Sign in failed" };
    setSession(data.session);
    setUser(data.user);
    saveSession(data.session, data.user);
    return {};
  }, []);

  const signUp = useCallback(async (email: string, password: string, name?: string) => {
    const data = await apiSignUp(email, password, name);
    if (!data.success) return { error: data.error || "Sign up failed" };

    if (data.session) {
      // Email confirmation not required — signed in immediately
      setSession(data.session);
      setUser(data.user);
      saveSession(data.session, data.user);
      return {};
    }
    // Email confirmation required
    return { needsConfirmation: true };
  }, []);

  const signOut = useCallback(async () => {
    const token = loadStoredToken();
    if (token) await apiSignOut(token);
    clearSession();
    setUser(null);
    setSession(null);
  }, []);

  const getToken = useCallback(() => {
    return session?.access_token || loadStoredToken();
  }, [session]);

  return React.createElement(
    AuthContext.Provider,
    { value: { user, session, loading, signIn, signUp, signOut, getToken } },
    children,
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

/** Returns Authorization header object if user is logged in, else empty object */
export function authHeaders(getToken: () => string | null): Record<string, string> {
  const token = getToken();
  return token ? { "Authorization": `Bearer ${token}` } : {};
}
