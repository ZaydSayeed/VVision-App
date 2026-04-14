import { API_BASE_URL } from "../config/api";

let _authToken: string | null = null;

export function setAuthFetchToken(token: string | null) {
  _authToken = token;
}

/**
 * Thin fetch wrapper that injects the auth token and resolves paths
 * against the API base URL. Returns a raw Response (not parsed JSON)
 * so callers can handle streaming, blobs, or JSON themselves.
 */
export async function authFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(_authToken ? { Authorization: `Bearer ${_authToken}` } : {}),
    ...(init.headers as Record<string, string>),
  };
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  return fetch(url, { ...init, headers });
}
