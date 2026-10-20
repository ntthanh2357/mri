import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/config.js';
import { goToPortalLogin } from './navigationRef.js';

async function getToken() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const webToken = localStorage.getItem('token');
      if (webToken) return webToken;
    }
    return await AsyncStorage.getItem('token');
  } catch (err) {
    console.warn('[apiClient] Lỗi đọc token từ storage:', err);
    return null;
  }
}

async function clearToken() {
  try {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.removeItem('token');
    }
    await AsyncStorage.removeItem('token');
  } catch (err) {
    console.warn('[apiClient] Lỗi xóa token khỏi storage:', err);
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
    cache: 'no-store', // [FIX 0014] tránh 304 conditional GET bị coi là lỗi
  });

  if (response.status === 401) {
    await clearToken();
    goToPortalLogin();
    // Resolve silently — caller does not need to handle this case
    return undefined;
  }

  if (!response.ok) {
    // [FIX 0014] Gắn status + code để caller phân biệt 429 với 401/403
    let message = 'Request failed';
    let code;
    try {
      const body = await response.json();
      if (body?.message) {
        message = body.message;
      }
      if (body?.code) {
        code = body.code;
      }
    } catch {
      // ignore JSON parse errors — keep default message
    }
    const err = new Error(message);
    err.status = response.status;
    if (code) err.code = code;
    throw err;
  }

  return response.json();
}
