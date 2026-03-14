const BASE_URL = '/api';

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
  get<T>(path: string): Promise<T> {
    return request<T>(path);
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
