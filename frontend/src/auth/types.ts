export interface Session {
  displayName: string;
  district: string;
  residentId: string; // btoa(displayName + ':' + district)
}

export interface IAuthProvider {
  getSession(): Session | null;
  createSession(displayName: string, district: string): Session;
  clearSession(): void;
  getSessionToken(): string | null; // returns residentId (the base64 token)
}
