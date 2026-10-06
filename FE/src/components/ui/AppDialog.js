import React, { useCallback, useRef, useState } from 'react';
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator } from 'react-native';
import { CheckCircle2, AlertCircle, Info, PenLine } from 'lucide-react';

const TYPES = {
  success: { icon: CheckCircle2, color: '#0F9D6B', bg: '#E3F7EF' },
  error: { icon: AlertCircle, color: '#DC2626', bg: '#FEE2E2' },
  info: { icon: Info, color: '#1A5FD0', bg: '#E7F0FE' },
  sign: { icon: PenLine, color: '#1A5FD0', bg: '#E7F0FE' },
};

// Đoán loại thông báo theo tiêu đề kiểu Alert.alert('Thành công' | 'Lỗi' | ...)
const typeFromTitle = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('thành công')) return 'success';
  if (t.includes('lỗi') || t.includes('thất bại')) return 'error';
  return 'info';
};

/**
 * Popup thay cho window.confirm / Alert.alert (Alert.alert không hiển thị trên web).
 *   const { dialog, confirm, notify } = useAppDialog();
 *   if (await confirm({ title, message, confirmText })) { ... }
 *   notify('Thành công', 'Đã lưu!');
 * Nhớ render {dialog} trong JSX của màn hình.
 */
export const useAppDialog = () => {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const close = useCallback((result) => {
    setState(null);
    if (resolver.current) {
      resolver.current(result);
      resolver.current = null;
    }
  }, []);

  const confirm = useCallback(({ title, message, confirmText = 'Xác nhận', cancelText = 'Hủy', type = 'sign', note } = {}) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setState({ mode: 'confirm', type, title, message, confirmText, cancelText, note });
    }), []);

  // Trả về Promise, resolve khi người dùng bấm 'Đã hiểu' (giống alert() chặn luồng)
  const notify = useCallback((title, message, type) =>
    new Promise((resolve) => {
      resolver.current = resolve;
      setState({ mode: 'notify', type: type || typeFromTitle(title), title, message });
    }), []);

  const cfg = state ? TYPES[state.type] || TYPES.info : TYPES.info;
  const Icon = cfg.icon;

  const dialog = (
    <Modal visible={!!state} transparent animationType="fade" onRequestClose={() => close(false)}>
      <View style={s.overlay}>
        {state && (
          <View style={s.card} dataSet={{ anim: 'fade-up' }}>
            <View style={[s.iconHalo, { backgroundColor: `${cfg.color}14` }]}>
              <View style={[s.iconCircle, { backgroundColor: cfg.bg }]}>
                <Icon size={30} color={cfg.color} strokeWidth={2.2} />
              </View>
            </View>
            <Text style={s.title}>{state.title}</Text>
            {state.message ? <Text style={s.message}>{state.message}</Text> : null}
            {state.note ? (
              <View style={s.note}>
                <Text style={s.noteText}>{state.note}</Text>
              </View>
            ) : null}
            {state.mode === 'confirm' ? (
              <View style={s.row}>
                <TouchableOpacity style={s.btnGhost} onPress={() => close(false)}>
                  <Text style={s.btnGhostText}>{state.cancelText}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.btn, { backgroundColor: cfg.color }]} onPress={() => close(true)} dataSet={{ hover: 'glow' }}>
                  <Text style={s.btnText}>{state.confirmText}</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity style={[s.btn, s.btnFull, { backgroundColor: cfg.color }]} onPress={() => close(true)} dataSet={{ hover: 'glow' }}>
                <Text style={s.btnText}>Đã hiểu</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
      </View>
    </Modal>
  );

  return { dialog, confirm, notify };
};

/** Lớp phủ "đang xử lý" đơn giản dùng chung. */
export const BusyOverlay = ({ visible, text = 'Đang xử lý...' }) => (
  <Modal visible={visible} transparent animationType="fade">
    <View style={s.overlay}>
      <View style={[s.card, { paddingVertical: 28 }]}>
        <ActivityIndicator size="large" color="#1A5FD0" />
        <Text style={[s.message, { marginTop: 14 }]}>{text}</Text>
      </View>
    </View>
  </Modal>
);

const isWeb = Platform.OS === 'web';

const s = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,42,91,0.55)', alignItems: 'center', justifyContent: 'center', padding: 20, ...(isWeb ? { backdropFilter: 'blur(4px)' } : {}) },
  card: { width: '100%', maxWidth: 440, backgroundColor: '#FFFFFF', borderRadius: 24, padding: 28, alignItems: 'center', ...(isWeb ? { boxShadow: '0 30px 60px -20px rgba(11,42,91,0.5)' } : { elevation: 10 }) },
  iconHalo: { width: 88, height: 88, borderRadius: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 16 },
  iconCircle: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: '#0F172A', textAlign: 'center' },
  message: { fontSize: 14, color: '#475569', textAlign: 'center', lineHeight: 22, marginTop: 8 },
  note: { marginTop: 14, backgroundColor: '#F8FAFC', borderRadius: 12, borderWidth: 1, borderColor: '#E2E8F0', paddingVertical: 10, paddingHorizontal: 14, alignSelf: 'stretch' },
  noteText: { fontSize: 12, color: '#64748B', lineHeight: 18, textAlign: 'center' },
  row: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  btn: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center' },
  btnFull: { flex: 0, alignSelf: 'stretch', marginTop: 22 },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 14 },
  btnGhost: { flex: 1, paddingVertical: 13, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: '#E2E8F0' },
  btnGhostText: { color: '#475569', fontWeight: '700', fontSize: 14 },
});
