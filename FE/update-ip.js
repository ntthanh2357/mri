const os = require('os');
const fs = require('fs');
const path = require('path');

function getLocalIP() {
  const interfaces = os.networkInterfaces();
  
  // 1. Prefer physical interfaces (Wi-Fi, Ethernet) and skip virtual ones
  for (const interfaceName in interfaces) {
    const nameLower = interfaceName.toLowerCase();
    
    // Ignore common virtual adapters
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
      // Find IPv4 that is not internal
      if ((iface.family === 'IPv4' || iface.family === 4) && !iface.internal) {
        return iface.address;
      }
    }
  }

  // 2. Fallback to any active non-internal IPv4
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
  const configPath = path.join(__dirname, 'src', 'constants', 'config.js');
  
  const configContent = `const Config = {
  // Tự động cập nhật bởi script update-ip.js
  API_URL: 'http://${ip}:3000',
  APP_NAME: 'NeuroScan AI',
};

export default Config;
`;

  fs.writeFileSync(configPath, configContent, 'utf8');
  console.log(`\x1b[32m[IP Auto-Updater] Successfully updated config.js with current local IP: http://${ip}:3000\x1b[0m`);
} catch (error) {
  console.error('\x1b[31m[IP Auto-Updater] Failed to update config.js:\x1b[0m', error);
}
