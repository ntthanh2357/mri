import { Platform } from 'react-native';

const Config = {
  // Tự động cập nhật bởi script update-ip.js
  API_URL: Platform.OS === 'web' ? 'http://localhost:3000' : 'http://172.20.10.4:3000',
  APP_NAME: 'NeuroScan AI',
};

export default Config;
