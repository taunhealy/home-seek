import { auth } from './firebase';

export function getApiBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_CLOUD_API) {
    return process.env.NEXT_PUBLIC_CLOUD_API.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    return 'http://localhost:8000';
  }
  return 'http://127.0.0.1:8000';
}

const API_BASE_URL = getApiBaseUrl();

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  // Dynamically resolve base URL matching current browser origin
  const base = getApiBaseUrl();
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${base}${cleanEndpoint}`;

  // Robust Header Merging (v128.1)
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No error body');
      throw new Error(`[API ERROR] ${response.status} ${response.statusText}: ${errorBody}`);
    }

    return response;
  } catch (error: any) {
    if (error instanceof TypeError && error.message === 'Failed to fetch') {
      console.warn(`[API] Backend unreachable at ${url}. Is the backend API running on port 8000?`);
    } else {
      console.error(`[API ERROR] Failed to fetch from ${url}:`, error);
    }
    throw error;
  }
}

/**
 * Fetches the list of elite suburbs for autocomplete (public endpoint).
 */
export async function fetchSuburbs(): Promise<string[]> {
  try {
    const res = await fetchWithAuth(`/geofence/suburbs`);
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('[API ERROR] Failed to fetch suburbs:', error);
    return [];
  }
}

export { API_BASE_URL };
