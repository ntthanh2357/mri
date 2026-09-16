const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // 1. Ưu tiên card mạng vật lý (Wi-Fi, Ethernet) và bỏ qua card ảo
  for (const interfaceName in interfaces) {
    const nameLower = interfaceName.toLowerCase();
    
    if (
      nameLower.includes('virtual') ||
      nameLower.includes('vmnet') ||
      nameLower.includes('vbox') ||
      nameLower.includes('wsl') ||
      nameLower.includes('loopback') ||
      nameLower.includes('pseudo') ||
      nameLower.includes('hyper-v') ||
      nameLower.includes('host-only')
    ) {
      continue;
    }
    
    for (const iface of interfaces[interfaceName]) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }

  // 2. Fallback sang bất kỳ IPv4 hoạt động nào
  for (const interfaceName in interfaces) {
    for (const iface of interfaces[interfaceName]) {
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }
  
  return '127.0.0.1';
}

try {
  const ip = getLocalIP();
  // Ghi vào .env.local (đã nằm trong .gitignore) thay vì ghi đè file mã nguồn config.js
  const envLocalPath = path.join(__dirname, '.env.local');
  const envContent = `# NeuroScan AI - Auto-generated local environment for Expo
# Generated at: ${new Date().toISOString()}
EXPO_PUBLIC_API_URL=http://${ip}:3000
EXPO_PUBLIC_LAN_IP=${ip}
`;

  fs.writeFileSync(envLocalPath, envContent, 'utf8');
  console.log(`\x1b[32m[IP Auto-Updater] Đã cập nhật .env.local với IP LAN động: http://${ip}:3000 (Mã nguồn config.js được giữ sạch trên Git)\x1b[0m`);
} catch (error) {
  console.error('\x1b[31m[IP Auto-Updater] Lỗi cập nhật .env.local:\x1b[0m', error);
}
