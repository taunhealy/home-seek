import { auth } from './firebase';

const API_BASE_URL = process.env.NEXT_PUBLIC_CLOUD_API || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export async function fetchWithAuth(endpoint: string, options: RequestInit = {}) {
  const user = auth.currentUser;
  
  // If no user is logged in, we still might want to allow some public calls 
  // (like geofence/suburbs) but most will fail at the backend level.
  const token = user ? await user.getIdToken() : null;

  const url = endpoint.startsWith('http') ? endpoint : `${API_BASE_URL}${endpoint}`;

  const headers = {
    ...options.headers,
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
  } as Record<string, string>;

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Fetches the list of elite suburbs for autocomplete (public endpoint).
 */
export async function fetchSuburbs(): Promise<string[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/geofence/suburbs`);
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export { API_BASE_URL };
