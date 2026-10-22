// Nhúng font Feather (glyph icon) trực tiếp vào bundle WEB bằng data-URI base64.
//
// VẤN ĐỀ: @expo/vector-icons trên web render icon bằng glyph fontFamily 'feather', font tải
// qua URL `/assets/?unstable_path=...Feather.ttf` của Metro. Khi app chạy sau reverse-proxy /
// preview-gateway, request font này dễ bị chặn hoặc rewrite → font không áp dụng → MỌI icon
// Feather hiện thành ô vuông (tofu) dù CSS đã khai báo đúng.
//
// GIẢI PHÁP CHỐNG ĐẠN: đăng ký TRƯỚC một @font-face cho family 'feather' từ data-URI nhúng
// trong bundle (không qua mạng). Cơ chế expo-font (ExpoFontLoader.loadAsync) thấy rule
// `font-family:'feather'` + `font-display:auto` đã tồn tại trong sheet #expo-generated-fonts
// → KHÔNG thêm rule tải-font-theo-URL nữa → icon luôn render từ font nhúng, không có request.
//
// Chỉ chạy trên web; bản native không đổi (native bundle ttf sẵn, và file base64 cũng
// không bị kéo vào bundle native nhờ phần mở rộng .web.js).

import { Platform } from 'react-native';
import * as Font from 'expo-font';
import FEATHER_BASE64 from '../constants/featherFontBase64.js';

if (Platform.OS === 'web' && typeof document !== 'undefined') {
  // display phải là 'auto' (mặc định) để khớp với asset resource của Feather icon set
  // (getFontFaceRulesMatchingResource so sánh cả fontDisplay) — tránh bị thêm rule URL trùng.
  Font.loadAsync('feather', `data:font/ttf;base64,${FEATHER_BASE64}`).catch((e) => {
    // Fallback: để expo-font tự xử lý như cũ (tải qua /assets/).
    console.warn('[featherFont] Nhúng font qua base64 thất bại, fallback tải qua mạng:', e?.message || e);
  });
}

export default null;
