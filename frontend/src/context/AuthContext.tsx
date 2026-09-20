import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useQuery, useAction, useMutation } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { UserRole } from '../lib/types';
import { hasRole } from '../lib/utils';

const TOKEN_KEY = 'labos_auth_token';

interface AuthContextValue {
  user: any | null;
  loading: boolean;
  token: string | null;
  totpRequired: { email: string; password: string } | null;
  login: (email: string, password: string, totp_code?: string) => Promise<void>;
  clearTotpRequired: () => void;
  logout: () => Promise<void>;
  hasRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [loading, setLoading] = useState(true);
  const [totpRequired, setTotpRequired] = useState<{ email: string; password: string } | null>(null);

  const loginAction = useAction(api.customAuth.login);
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

  const login = useCallback(async (email: string, password: string, totp_code?: string) => {
    const result = await loginAction({ email, password, totp_code });
    if (result.totp_required) {
      setTotpRequired({ email, password });
      return;
    }
    setTotpRequired(null);
    localStorage.setItem(TOKEN_KEY, result.token);
    setToken(result.token);
    setLoading(true);
  }, [loginAction]);

  const clearTotpRequired = useCallback(() => {
    setTotpRequired(null);
  }, []);

  const logout = useCallback(async () => {
    if (token) {
      try { await logoutMutation({ token }); } catch (_) { /* ignore */ }
    }
    localStorage.removeItem(TOKEN_KEY);
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
