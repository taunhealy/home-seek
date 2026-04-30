import { auth } from './firebase';

const API_BASE_URL = (process.env.NEXT_PUBLIC_CLOUD_API || process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000').replace(/\/$/, '');

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  const token = user ? await user.getIdToken() : null;

  // Normalize endpoint and construct URL
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${cleanEndpoint}`;

  // Robust Header Merging (v128.1)
  const headers = new Headers(options.headers);
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  try {
    console.log(`[DEBUG] Fetching: ${url}`);
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => 'No error body');
      throw new Error(`[API ERROR] ${response.status} ${response.statusText}: ${errorBody}`);
    }

    return response;
  } catch (error) {
    console.error(`[API ERROR] Failed to fetch from ${url}:`, error);
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
