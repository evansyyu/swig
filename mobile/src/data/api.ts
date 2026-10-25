import { fetch } from 'expo/fetch';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'https://wateralarmi-production.up.railway.app').replace(
  /\/+$/,
  ''
);

export class ApiError extends Error {
  constructor(
    message: string,
    /** HTTP status, or 0 when the request never reached the server. */
    readonly status: number,
    readonly code: string
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isNetwork() {
    return this.status === 0;
  }

  /** Worth retrying later: offline, timeout, or a server-side failure. */
  get isTransient() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  timeoutMs?: number;
  signal?: AbortSignal;
};

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, token, timeoutMs = 15_000, signal } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  signal?.addEventListener('abort', () => controller.abort());

  let response: Response;
  try {
    response = (await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined && { 'Content-Type': 'application/json' }),
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    })) as unknown as Response;
  } catch {
    throw new ApiError("Can't reach the server. Check your connection.", 0, 'network');
  } finally {
    clearTimeout(timer);
  }

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const error = data?.error;
    throw new ApiError(error?.message ?? `Request failed (${response.status})`, response.status, error?.code ?? 'http_error');
  }
  return data as T;
}
