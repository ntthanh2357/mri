import { Platform } from 'react-native';

const Config = {
  // Tự động cập nhật bởi script update-ip.js
  API_URL: Platform.OS === 'web' ? 'http://localhost:3000' : 'http://192.168.1.6:3000',
  APP_NAME: 'NeuroScan AI',
};

export default Config;
