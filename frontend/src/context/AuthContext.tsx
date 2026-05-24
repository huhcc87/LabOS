import React, { createContext, useContext } from 'react';
import { useQuery } from 'convex/react';
import { useAuthActions } from '@convex-dev/auth/react';
import { useConvexAuth } from 'convex/react';
import { api } from '../../convex/_generated/api';
import type { UserRole } from '../lib/types';
import { hasRole } from '../lib/utils';

interface AuthContextValue {
  user: any | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hasRole: (minRole: UserRole) => boolean;
  // Keep token field for backward compat (null with Convex — auth is cookie-based)
  token: string | null;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();

  // Fetch the current user's profile from Convex once authenticated
  const user = useQuery(
    api.users.getMe,
    isAuthenticated ? {} : 'skip'
  ) ?? null;

  async function login(email: string, password: string) {
    await signIn('password', { email, password, flow: 'signIn' });
  }

  async function logout() {
    await signOut();
  }

  function checkRole(minRole: UserRole): boolean {
    if (!user) return false;
    return hasRole(user.role, minRole);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        token: null,
        loading: isLoading,
        login,
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
