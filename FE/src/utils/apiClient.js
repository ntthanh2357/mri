import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Config from '../constants/config.js';
import { request } from '../api/client.js';
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
 * - On 401: thử làm mới token (refresh); hết phiên thì xóa token, về màn đăng nhập và ném lỗi
 * - On non-2xx (non-401): throws Error with message from response body
 * - On 2xx: returns parsed JSON
 */
export async function apiRequest(path, options) {
  // Dùng chung request() của api/client.js: 401 thì thử làm mới token trước khi đăng xuất,
  // gửi header X-Client-Platform, lỗi có err.status / err.code như các màn khác.
  return request(path, options || {});
}
