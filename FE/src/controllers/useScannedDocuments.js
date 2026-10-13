import { useCallback, useEffect, useRef, useState } from 'react';
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

/** UC-PAT-09 (mở rộng) — bệnh nhân chụp giấy tờ, AI tự cắt nền + đọc chữ + tách thông tin, kiểm tra rồi lưu để chia sẻ qua QR. */
export function useScannedDocuments() {
  const [state, setState] = useState({ loading: true, docs: [], error: null });
  const [scanning, setScanning] = useState(false);
  // Lần quét gần nhất trong phiên này: giữ ảnh gốc CÙNG mã giấy tờ của nó, để quét lại không tự cắt nếu máy cắt sai
  const lastPart = useRef(null); // { part, docId }
  const [lastScan, setLastScan] = useState(null); // { docId, cropped }

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

  const upload = useCallback(async (part, autocrop) => {
    setScanning(true);
    try {
      const form = new FormData();
      form.append('file', part);
      const res = await postFormData(autocrop ? BASE : `${BASE}?autocrop=0`, form);
      lastPart.current = { part, docId: res?.data?._id };
      setLastScan({ docId: res?.data?._id, cropped: !!res?.data?.cropped });
      await load();
      return { ok: true, doc: res?.data, message: res?.message };
    } catch (err) {
      return { ok: false, message: err?.message || 'Không quét được giấy tờ. Vui lòng thử lại.' };
    } finally {
      setScanning(false);
    }
  }, [load]);

  /** Chụp (camera = true) hoặc chọn ảnh có sẵn → gửi lên để đọc chữ. Trả doc mới (chưa kiểm tra). */
  const scan = useCallback(async (camera) => {
    let part;
    try {
      part = Platform.OS === 'web' ? await pickOnWeb(camera) : await pickOnNative(camera);
    } catch (err) {
      return { ok: false, message: err?.message || 'Không mở được camera hoặc thư viện ảnh.' };
    }
    if (!part) return { ok: false, cancelled: true };
    return upload(part, true);
  }, [upload]);

  /** Máy tự cắt sai (mất chữ): quét lại đúng ảnh vừa chụp nhưng giữ nguyên khung, thay cho giấy tờ `docId`. */
  const rescanUncropped = useCallback(async (docId) => {
    // chỉ quét lại đúng ảnh của chính giấy tờ này (tránh gửi nhầm ảnh khác rồi xoá nhầm giấy tờ)
    if (lastPart.current?.docId !== docId) return { ok: false, message: 'Không còn giữ ảnh gốc của giấy tờ này. Hãy chụp lại.' };
    const res = await upload(lastPart.current.part, false);
    // bản mới chưa đọc được chữ thì giữ lại bản cũ (đang có chữ) cho bệnh nhân tự chọn
    if (res.ok && !res.doc?.ocrFailed) {
      await del(`${BASE}/${docId}`).catch(() => {}); // bỏ bản bị cắt sai
      await load();
    }
    return res;
  }, [upload, load]);

  const save = useCallback(async (id, { title, text, fields }) => {
    try {
      await put(`${BASE}/${id}`, { title, text, fields });
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

  return { ...state, scanning, lastScan, scan, rescanUncropped, save, remove, reload: load };
}
