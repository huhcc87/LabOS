import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { UserRole } from '../lib/types';
import { hasRole } from '../lib/utils';

const TOKEN_KEY = 'labos_auth_token';

/** "Remember me" keeps the session in localStorage; otherwise it lasts until the browser closes. */
function saveToken(token: string, remember: boolean) {
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
  (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
}
function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

interface AuthContextValue {
  user: any | null;
  loading: boolean;
  token: string | null;
  totpRequired: { email: string; password: string; remember: boolean } | null;
  login: (email: string, password: string, totp_code?: string, remember?: boolean) => Promise<void>;
  register: (email: string, password: string, full_name: string) => Promise<void>;
  clearTotpRequired: () => void;
  logout: () => Promise<void>;
  hasRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [totpRequired, setTotpRequired] = useState<{ email: string; password: string; remember: boolean } | null>(null);

  const loginAction = useAction(api.customAuth.login);
  const registerAction = useAction(api.customAuth.register);
  const logoutMutation = useMutation(api.customAuth.logout);

  // Fetch current user by token — skip when no token
  const user = useQuery(
    api.users.getMe,
    token ? { token } : 'skip'
  ) ?? null;

  // Once useQuery has resolved (either a user or null), we're done loading
  useEffect(() => {
    if (user !== undefined) {
      setLoading(false);
    }
  }, [user]);

  // If there's no token at all, loading is immediately false
  useEffect(() => {
    if (!token) setLoading(false);
  }, [token]);

  const login = useCallback(async (email: string, password: string, totp_code?: string, remember = true) => {
    const result = await loginAction({ email, password, totp_code });
    if (result.totp_required) {
      setTotpRequired({ email, password, remember });
      return;
    }
    setTotpRequired(null);
    saveToken(result.token, remember);
    setToken(result.token);
    setLoading(true);
  }, [loginAction]);

  const register = useCallback(async (email: string, password: string, full_name: string) => {
    const result = await registerAction({ email, password, full_name });
    saveToken(result.token, true);
    setToken(result.token);
    setLoading(true);
  }, [registerAction]);

  const clearTotpRequired = useCallback(() => {
    setTotpRequired(null);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try { await logoutMutation({ token }); } catch (_) { /* ignore */ }
    }
    clearToken();
    setToken(null);
  }, [token, logoutMutation]);

  function checkRole(minRole: UserRole): boolean {
    if (!user) return false;
    return hasRole(user.role, minRole);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        loading,
        totpRequired,
        login,
        register,
        clearTotpRequired,
        logout,
        hasRole: checkRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
