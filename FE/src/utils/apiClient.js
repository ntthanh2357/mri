import { Platform } from 'react-native';
import Config from '../constants/config.js';
import { navigateTo } from './navigationRef.js';

// AsyncStorage is not installed — provide a no-op fallback for non-web platforms.
// The MVP targets web (Platform.OS === 'web'), so this is fine.
const asyncStorageNoOp = {
  getItem: (_key) => {
    console.warn('[apiClient] @react-native-async-storage/async-storage is not installed. Token persistence is disabled on non-web platforms.');
    return Promise.resolve(null);
  },
  removeItem: (_key) => {
    return Promise.resolve();
  },
};

async function getToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem('token');
  }
  return asyncStorageNoOp.getItem('token');
}

async function clearToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem('token');
  } else {
    await asyncStorageNoOp.removeItem('token');
  }
}

/**
 * Shared fetch wrapper for all Admin UI API calls.
 *
 * - Reads base URL from Config.API_URL
 * - Automatically attaches Authorization: Bearer <token> if a token is stored
 * - On 401: clears token and navigates to "Login" (no throw)
 * - On non-2xx (non-401): throws Error with message from response body
 * - On 2xx: returns parsed JSON
 */
export async function apiRequest(path, options) {
  const url = `${Config.API_URL}${path}`;

  const token = await getToken();

  const headers = {
    'Content-Type': 'application/json',
    ...(options?.headers),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    await clearToken();
    navigateTo('Login');
    // Resolve silently — caller does not need to handle this case
    return undefined;
  }

  if (!response.ok) {
    let message = 'Request failed';
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
    } catch {
      // ignore JSON parse errors — keep default message
    }
    throw new Error(message);
  }

  return response.json();
}
