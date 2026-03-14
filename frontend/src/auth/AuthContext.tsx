import React, { createContext, useContext, useState } from 'react';
import type { Session } from './types';
import { LocalStorageAuthProvider } from './LocalStorageAuthProvider';

const provider = new LocalStorageAuthProvider();

interface AuthContextValue {
  session: Session | null;
  createSession: (displayName: string, district: string) => Session;
  clearSession: () => void;
  getSessionToken: () => string | null;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => provider.getSession());

  function createSession(displayName: string, district: string): Session {
    const s = provider.createSession(displayName, district);
    setSession(s);
    return s;
  }

  function clearSession(): void {
    provider.clearSession();
    setSession(null);
  }

  function getSessionToken(): string | null {
    return provider.getSessionToken();
  }

  return (
    <AuthContext.Provider value={{ session, createSession, clearSession, getSessionToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
