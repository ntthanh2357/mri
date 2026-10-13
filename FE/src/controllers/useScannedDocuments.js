import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { get, put, del, postFormData } from '../services/api.service';

const BASE = '/api/v1/patient/scanned-documents';
const REFRESH_MS = 10 * 60 * 1000; // link ảnh sống 15 phút: tải lại danh sách trước khi hết hạn

// Web: ô chọn file của trình duyệt (trên điện thoại, capture mở thẳng camera sau)
const pickOnWeb = (camera) => new Promise((resolve) => {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = camera ? 'image/*' : 'image/jpeg,image/png,image/webp';
  if (camera) input.capture = 'environment';
  input.onchange = (e) => resolve(e.target.files?.[0] || null);
  input.oncancel = () => resolve(null);
  input.click();
});

const pickOnNative = async (camera) => {
  const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (perm.status !== 'granted') {
    throw new Error(camera ? 'Cần cấp quyền camera để chụp giấy tờ.' : 'Cần cấp quyền thư viện ảnh để chọn giấy tờ.');
  }
  const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: false, quality: 0.8 };
  const result = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  const asset = result.canceled ? null : result.assets?.[0];
  if (!asset) return null;
  return { uri: asset.uri, name: asset.fileName || `giay-to-${Date.now()}.jpg`, type: asset.mimeType || 'image/jpeg' };
};

/** UC-PAT-09 (mở rộng) — bệnh nhân chụp giấy tờ, AI đọc chữ, kiểm tra rồi lưu để chia sẻ qua QR. */
export function useScannedDocuments() {
  const [state, setState] = useState({ loading: true, docs: [], error: null });
  const [scanning, setScanning] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await get(BASE);
      setState({ loading: false, docs: res?.data || [], error: null });
    } catch (err) {
      console.error('Lỗi tải giấy tờ đã quét:', err);
      setState((s) => ({ ...s, loading: false, error: 'Không tải được danh sách giấy tờ.' }));
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  /** Chụp (camera = true) hoặc chọn ảnh có sẵn → gửi lên để đọc chữ. Trả doc mới (chưa kiểm tra). */
  const scan = useCallback(async (camera) => {
    try {
      const part = Platform.OS === 'web' ? await pickOnWeb(camera) : await pickOnNative(camera);
      if (!part) return { ok: false, cancelled: true };
      setScanning(true);
      const form = new FormData();
      form.append('file', part);
      const res = await postFormData(BASE, form);
      await load();
      return { ok: true, doc: res?.data, message: res?.message };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không quét được giấy tờ. Vui lòng thử lại.' };
    } finally {
      setScanning(false);
    }
  }, [load]);

  const save = useCallback(async (id, { title, text }) => {
    try {
      await put(`${BASE}/${id}`, { title, text });
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không lưu được giấy tờ. Vui lòng thử lại.' };
    }
  }, [load]);

  const remove = useCallback(async (id) => {
    try {
      await del(`${BASE}/${id}`);
      await load();
      return { ok: true };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không xoá được giấy tờ. Vui lòng thử lại.' };
    }
  }, [load]);

  return { ...state, scanning, scan, save, remove, reload: load };
}
