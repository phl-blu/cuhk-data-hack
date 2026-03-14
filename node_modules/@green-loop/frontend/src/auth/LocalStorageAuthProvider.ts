import type { IAuthProvider, Session } from './types';

const STORAGE_KEY = 'gl_session';

export class LocalStorageAuthProvider implements IAuthProvider {
  getSession(): Session | null {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as Session;
    } catch {
      return null;
    }
  }

  createSession(displayName: string, district: string): Session {
    const residentId = btoa(`${displayName}:${district}`);
    const session: Session = { displayName, district, residentId };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    return session;
  }

  clearSession(): void {
    localStorage.removeItem(STORAGE_KEY);
  }

  getSessionToken(): string | null {
    const session = this.getSession();
    return session ? session.residentId : null;
  }
}
