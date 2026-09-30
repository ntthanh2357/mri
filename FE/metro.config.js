const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

// Sandbox: fs.inotify max_user_watches = 8192 (không nâng được do thiếu root).
// Metro mặc định theo dõi cả các thư mục cache tự sinh (.expo) → dễ vượt giới hạn
// watcher khi Expo regenerate cache favicon/assets lúc chạy web dev server.
// → blockList .expo + .git + dist để Metro không watch các thư mục sinh ra ở runtime.
const escape = (s) => s.replace(/[/\\]/g, '/').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const toBlockRe = (p) => new RegExp(`^${escape(path.join(__dirname, p)).replace(/\\\\/g, '\\\\')}(/|$)`);

const config = getDefaultConfig(__dirname);

const blockedDirs = ['.expo', '.git', 'dist', 'web-build'];
const blocked = blockedDirs.map((d) => toBlockRe(d));

config.resolver.blockList = (config.resolver.blockList || []).concat(blocked);

module.exports = config;
