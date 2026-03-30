const BASE_URL = (import.meta.env['VITE_API_BASE_URL'] as string | undefined)
  ? `${import.meta.env['VITE_API_BASE_URL'] as string}/api`
  : '/api';

// Simple in-memory cache for GET requests
const _cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL = 30_000; // 30 seconds

function getSessionToken(): string | null {
  try {
    const raw = localStorage.getItem('gl_session');
    if (!raw) return null;
    const session = JSON.parse(raw) as { residentId?: string };
    return session.residentId ?? null;
  } catch {
    return null;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getSessionToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };
  if (token) {
    headers['X-Session-Token'] = token;
  }

  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });

  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    let errorData: Record<string, unknown> = {};
    try {
      const body = (await res.json()) as { error?: { message?: string } & Record<string, unknown> };
      message = body.error?.message ?? message;
      errorData = (body.error as Record<string, unknown>) ?? {};
    } catch {
      // ignore parse errors
    }
    throw new ApiError(message, res.status, errorData);
  }

  return res.json() as Promise<T>;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly data: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const apiClient = {
  get<T>(path: string, cacheable = false): Promise<T> {
    if (cacheable) {
      const hit = _cache.get(path);
      if (hit && Date.now() - hit.ts < CACHE_TTL) return Promise.resolve(hit.data as T);
    }
    return request<T>(path).then((data) => {
      if (cacheable) _cache.set(path, { data, ts: Date.now() });
      return data;
    });
  },
  post<T>(path: string, body?: unknown): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  },
  put<T>(url: string, body: Blob | File): Promise<T> {
    return fetch(url, { method: 'PUT', body }).then((r) => r.json() as Promise<T>);
  },
};
