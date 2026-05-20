import React, { createContext, useContext, useEffect, useState } from 'react';
import type { User, UserRole } from '../lib/types';
import { hasRole } from '../lib/utils';
import client from '../lib/api';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (minRole: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextValue>({} as AuthContextValue);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('lab_token'));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      client.get('/auth/me')
        .then((r) => setUser(r.data))
        .catch(() => logout())
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const resp = await client.post('/auth/login', { email, password });
    const { access_token, user: u } = resp.data;
    localStorage.setItem('lab_token', access_token);
    localStorage.setItem('lab_user', JSON.stringify(u));
    setToken(access_token);
    setUser(u);
  }

  function logout() {
    localStorage.removeItem('lab_token');
    localStorage.removeItem('lab_user');
    setToken(null);
    setUser(null);
  }

  function checkRole(minRole: UserRole): boolean {
    if (!user) return false;
    return hasRole(user.role, minRole);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, logout, hasRole: checkRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
