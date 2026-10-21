import React, { useEffect, useRef } from 'react';
import jsQR from 'jsqr';

// Bản WEB (Metro chọn QrScanner.native.js trên điện thoại). Đọc mã QR ngay trong trình duyệt bằng jsQR:
// khung hình camera không rời khỏi máy, không gửi lên máy chủ nào.

export const CAMERA_SCAN_AVAILABLE = true;
const MAX_SIDE = 640; // thu nhỏ khung hình trước khi đọc mã cho nhanh
const MAX_IMAGE_BYTES = 15 * 1024 * 1024; // ảnh chọn từ máy: chặn ảnh khổng lồ làm treo trình duyệt
const SCAN_EVERY_MS = 120;
const SAME_CODE_AGAIN_MS = 3000;

const decode = (source, width, height, canvas) => {
  const scale = Math.min(1, MAX_SIDE / Math.max(width, height));
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
  const frame = ctx.getImageData(0, 0, canvas.width, canvas.height);
  return jsQR(frame.data, frame.width, frame.height, { inversionAttempts: 'dontInvert' })?.data || null;
};

/** Mở hộp chọn ảnh, đọc mã QR trong ảnh. Trả chữ trong mã, '' nếu ảnh không có mã, null nếu người dùng huỷ. */
export const pickQrImage = () => new Promise((resolve, reject) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.oncancel = () => resolve(null);
  input.onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) { resolve(null); return; }
    if (file.size > MAX_IMAGE_BYTES) { reject(new Error('Ảnh quá lớn (tối đa 15 MB). Hãy chọn ảnh chụp màn hình hoặc ảnh nhỏ hơn.')); return; }
    try {
      const bitmap = await createImageBitmap(file);
      const text = decode(bitmap, bitmap.width, bitmap.height, document.createElement('canvas'));
      bitmap.close?.();
      resolve(text || '');
    } catch (err) {
      reject(new Error('Không đọc được ảnh này. Hãy chọn ảnh JPEG hoặc PNG.'));
    }
  };
  input.click();
});

/**
 * Khung camera quét mã QR. `active` bật/tắt camera; `onDetect(text)` gọi khi đọc được mã;
 * `onError(message)` gọi khi không dùng được camera.
 */
const QrScanner = ({ active, onDetect, onError }) => {
  const videoRef = useRef(null);
  const handlers = useRef({ onDetect, onError });
  handlers.current = { onDetect, onError };

  useEffect(() => {
    if (!active) return undefined;
    let stream = null;
    let raf = 0;
    let stopped = false;
    let lastScanAt = 0;
    let lastText = '';
    let lastTextAt = 0;
    const canvas = document.createElement('canvas');

    const tick = (now) => {
      if (stopped) return;
      const video = videoRef.current;
      if (video && video.readyState >= 2 && video.videoWidth && now - lastScanAt >= SCAN_EVERY_MS) {
        lastScanAt = now;
        const text = decode(video, video.videoWidth, video.videoHeight, canvas);
        if (text && (text !== lastText || now - lastTextAt > SAME_CODE_AGAIN_MS)) {
          lastText = text;
          lastTextAt = now;
          handlers.current.onDetect(text);
        }
      }
      raf = requestAnimationFrame(tick);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        handlers.current.onError('Trình duyệt chỉ cho dùng camera trên địa chỉ https hoặc localhost. Hãy chọn ảnh có mã QR hoặc dán liên kết.');
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (stopped) { stream.getTracks().forEach((t) => t.stop()); return; }
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        raf = requestAnimationFrame(tick);
      } catch (err) {
        if (stream) stream.getTracks().forEach((t) => t.stop()); // vd. video.play() bị từ chối sau khi đã mở camera
        handlers.current.onError(err?.name === 'NotAllowedError'
          ? 'Bạn chưa cho phép dùng camera. Hãy cấp quyền camera cho trang này, hoặc chọn ảnh có mã QR.'
          : 'Không mở được camera trên thiết bị này. Hãy chọn ảnh có mã QR hoặc dán liên kết.');
      }
    })();

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((t) => t.stop());
    };
  }, [active]);

  if (!active) return null;
  return (
    <video ref={videoRef} muted playsInline aria-label="Khung camera quét mã QR"
      style={{ width: '100%', maxHeight: 380, borderRadius: 10, backgroundColor: '#0B1220', objectFit: 'cover', display: 'block' }} />
  );
};

export default QrScanner;
