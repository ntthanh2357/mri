import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');
const scriptPath = path.join(projectRoot, '.vn-law-check', 'scripts', 'scan.sh');

console.log('='.repeat(65));
console.log('   VN-LAW-CHECK: RÀ SOÁT TUÂN THỦ PHÁP LÝ VIỆT NAM (2026)');
console.log('='.repeat(65));

if (!fs.existsSync(scriptPath)) {
  console.error(`[Lỗi] Không tìm thấy script tại: ${scriptPath}`);
  process.exit(1);
}

// Tìm bash trên Windows hoặc POSIX
let bashCmd = 'bash';
if (process.platform === 'win32') {
  const gitBashPath = 'C:\\Program Files\\Git\\bin\\bash.exe';
  if (fs.existsSync(gitBashPath)) {
    bashCmd = gitBashPath;
  }
}

const child = spawn(bashCmd, [scriptPath, projectRoot], {
  cwd: projectRoot,
  stdio: 'inherit'
});

child.on('close', (code) => {
  console.log('\n' + '='.repeat(65));
  console.log(`Hoàn tất quét sơ bộ (Exit code: ${code}).`);
  console.log('Xem tài liệu chi tiết tại: .vn-law-check/references/');
  console.log('Xem báo cáo chuyên sâu tại: docs/legal/BAO_CAO_TUAN_THU_PHAP_LY_VN_2026.md');
  console.log('='.repeat(65));
  process.exit(code || 0);
});

