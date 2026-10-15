import { Platform } from 'react-native';

/**
 * Cấu hình động API URL cho NeuroScan AI:
 * - Ưu tiên 1: Biến môi trường EXPO_PUBLIC_API_URL (tự động nạp từ .env.local, Docker hoặc CI/CD)
 * - Môi trường Web:
 *   + Khi chạy sau Nginx Reverse Proxy (Docker / Production / Port 80 / Port 443 / Port rỗng):
 *     Tự động trỏ về window.location.origin để Nginx tự điều phối sang Backend (Port 5000), loại bỏ lỗi hardcode localhost
 *   + Khi dev cục bộ với Expo dev server (Port 8083 / 8081):
 *     Tự động trỏ sang Backend cổng 3000 (http://<hostname>:3000)
 * - Môi trường Mobile (Android/iOS): Ưu tiên EXPO_PUBLIC_API_URL (IP LAN) hoặc fallback localhost:3000
 */
// Web mở từ Expo dev server: gọi API theo đúng tên máy của trang (localhost hoặc IP mà trình duyệt đang dùng).
// Không dùng EXPO_PUBLIC_API_URL ở đây: update-ip.js ghi IP LAN lúc khởi động, IP đổi (DHCP) là web gọi IP cũ và treo.
const isWebDevServer = () =>
  Platform.OS === 'web' && typeof window !== 'undefined' && !!window.location && ['8081', '8083'].includes(window.location.port);

const getBaseApiUrl = () => {
  // 1. Ưu tiên biến môi trường EXPO_PUBLIC_API_URL (app điện thoại, bản build web sau proxy)
  if (process.env.EXPO_PUBLIC_API_URL && !isWebDevServer()) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/+$/, '');
  }

  // 2. Môi trường Web chạy trên trình duyệt
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.location) {
      const port = window.location.port;
      // Khi truy cập qua Reverse Proxy chuẩn (Port 80, 443) hoặc bản build tĩnh Production
      const isBehindProxy = port === '' || port === '80' || port === '443' || process.env.NODE_ENV === 'production';
      if (isBehindProxy) {
        return window.location.origin;
      }
      // Khi dev cục bộ với Expo dev server (Port 8083 / 8081)
      const hostname = window.location.hostname || 'localhost';
      return 'http://' + hostname + ':3000';
    }
    return 'http://localhost:3000';
  }

  // 3. Môi trường Mobile Native (Android / iOS)
  return 'http://localhost:3000';
};

const Config = {
  API_URL: getBaseApiUrl(),
  APP_NAME: 'NeuroScan AI',
};

export default Config;

