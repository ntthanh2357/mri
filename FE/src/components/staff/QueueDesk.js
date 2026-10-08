import React, { useState } from 'react';
import { View, Text, TextInput, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';

// UC-PAT-03 — Quầy tiếp đón gọi số bệnh nhân đã lấy online.
// Người lỡ lượt quay lại: bấm "Đã tới" → được chèn lên gọi ngay tiếp theo.

const STATUS = {
  waiting: { label: 'Chờ gọi', tone: 'muted' },
  called: { label: 'Đang gọi', tone: 'ok' },
  missed: { label: 'Vắng, giữ số', tone: 'warn' },
  arrived: { label: 'Đã tới', tone: 'info' },
  served: { label: 'Đã tiếp nhận', tone: 'done' },
  cancelled: { label: 'Đã huỷ', tone: 'done' },
};
const TONE = {
  ok: { bg: Colors.successBg, fg: Colors.successText },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
  muted: { bg: Colors.background, fg: Colors.slateDark },
  done: { bg: Colors.background, fg: Colors.slateMuted },
};

const nameOf = (p) => p?.profile?.name || p?.profile?.fullName || p?.email || 'Bệnh nhân';

const Btn = ({ label, onPress, variant = 'secondary', disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button"
    style={({ hovered }) => [styles.btn, variant === 'primary' ? styles.btnPrimary : styles.btnSecondary, hovered && !disabled && (variant === 'primary' ? styles.btnPrimaryHover : styles.btnSecondaryHover), disabled && styles.disabled]}>
    <Text style={variant === 'primary' ? styles.btnPrimaryText : styles.btnSecondaryText}>{label}</Text>
  </Pressable>
);

const QueueDesk = ({ desk, onServe }) => {
  const { loading, tickets, current, nextNumber, settings, error, callNext, markArrived, markMissed, markServed, saveSettings } = desk;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [editMinutes, setEditMinutes] = useState(null); // chuỗi đang sửa, null = không sửa

  const run = async (fn, after) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setMsg(res);
    if (res.ok && after) after(res.ticket);
  };

  const calling = tickets.filter((t) => t.status === 'called');
  const open = tickets.filter((t) => ['waiting', 'missed', 'arrived'].includes(t.status));
  const done = tickets.filter((t) => ['served', 'cancelled'].includes(t.status));

  if (loading && !tickets.length) return <View style={styles.state}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.muted}>Đang tải…</Text></View>;

  const row = (t) => {
    const st = STATUS[t.status];
    const tone = TONE[st.tone];
    return (
      <View key={t._id} style={styles.row}>
        <Text style={styles.rowNumber}>{t.number}</Text>
        <View style={styles.grow}>
          <Text style={styles.rowName} numberOfLines={1}>{nameOf(t.patientId)}</Text>
          <Text style={styles.muted} numberOfLines={1}>Mã y tế: {t.patientId?.profile?.medicalId || 'chưa có'}</Text>
        </View>
        <View style={[styles.pill, { backgroundColor: tone.bg }]}><Text style={[styles.pillText, { color: tone.fg }]}>{st.label}</Text></View>
        <View style={styles.rowActions}>
          {t.status === 'called' ? (
            <>
              <Btn label="Vắng" disabled={busy} onPress={() => run(() => markMissed(t._id))} />
              <Btn label="Tiếp nhận" variant="primary" disabled={busy} onPress={() => run(() => markServed(t._id), (tk) => onServe(tk?.patientId || t.patientId))} />
            </>
          ) : t.status === 'missed' || t.status === 'waiting' ? (
            <Btn label="Đã tới" disabled={busy} onPress={() => run(() => markArrived(t._id))} />
          ) : t.status === 'arrived' && t.number === nextNumber ? (
            <Text style={styles.hint}>Gọi tiếp theo</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.stack}>
      <View style={styles.hero}>
        <View style={styles.grow}>
          <Text style={styles.heroLabel}>Số đang gọi</Text>
          <Text style={styles.heroNumber}>{current || '—'}</Text>
          <Text style={styles.heroSub}>{open.length} số đang chờ{nextNumber ? `, tiếp theo là số ${nextNumber}` : ''}</Text>
        </View>
        <Pressable onPress={() => run(callNext)} disabled={busy || !nextNumber} accessibilityRole="button"
          style={({ hovered }) => [styles.callBtn, hovered && styles.callBtnHover, (busy || !nextNumber) && styles.disabled]}>
          {busy ? <ActivityIndicator size="small" color={Colors.brandNavy} /> : (
            <>
              <Feather name="volume-2" size={18} color={Colors.brandNavy} />
              <Text style={styles.callBtnText}>Gọi số tiếp theo</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.settingRow}>
        <Feather name="clock" size={15} color={Colors.slateMuted} />
        {editMinutes === null ? (
          <>
            <Text style={styles.settingText}>Ước tính {settings?.avgServeMinutes || 10} phút tiếp nhận mỗi người (để báo giờ dự kiến cho bệnh nhân).</Text>
            <Pressable onPress={() => setEditMinutes(String(settings?.avgServeMinutes || 10))} accessibilityRole="button" hitSlop={8}>
              <Text style={styles.link}>Sửa</Text>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput value={editMinutes} onChangeText={(v) => setEditMinutes(v.replace(/\D/g, '').slice(0, 2))} keyboardType="number-pad" maxLength={2}
              style={styles.minutesInput} accessibilityLabel="Số phút tiếp nhận mỗi người" />
            <Text style={styles.settingText}>phút mỗi người</Text>
            <Btn label="Lưu" variant="primary" disabled={busy || !editMinutes} onPress={() => run(() => saveSettings(Number(editMinutes)), () => setEditMinutes(null))} />
            <Btn label="Huỷ" disabled={busy} onPress={() => setEditMinutes(null)} />
          </>
        )}
      </View>

      {msg ? (
        <View style={[styles.msg, { backgroundColor: msg.ok ? Colors.successBg : Colors.warningBg }]} accessibilityLiveRegion="polite">
          <Feather name={msg.ok ? 'check-circle' : 'alert-circle'} size={15} color={msg.ok ? Colors.successText : Colors.warningText} />
          <Text style={[styles.msgText, { color: msg.ok ? Colors.successText : Colors.warningText }]}>{msg.message}</Text>
        </View>
      ) : null}
      {error ? <Text style={styles.muted}>{error}</Text> : null}

      {calling.length ? (
        <View style={styles.panel}>
          <Text style={styles.panelTitle}>Đang gọi</Text>
          {calling.map(row)}
        </View>
      ) : null}

      <View style={styles.panel}>
        <Text style={styles.panelTitle}>Đang chờ</Text>
        {open.length ? open.map(row) : <Text style={styles.muted}>Chưa có bệnh nhân nào lấy số đang chờ.</Text>}
      </View>

      {done.length ? (
        <View style={styles.panel}>
          <Pressable onPress={() => setShowDone(!showDone)} accessibilityRole="button" style={styles.doneHead}>
            <Text style={styles.panelTitle}>Đã xong ({done.length})</Text>
            <Feather name={showDone ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.slateMuted} />
          </Pressable>
          {showDone ? done.map(row) : null}
        </View>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  stack: { gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 48 },
  muted: { fontSize: 13, color: Colors.slateMuted },
  hint: { fontSize: 13, fontWeight: '600', color: Colors.infoText },
  hero: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, padding: 20, borderRadius: 14, backgroundColor: Colors.brandNavy },
  heroLabel: { fontSize: 14, fontWeight: '600', color: Colors.brandMint },
  heroNumber: { fontSize: 48, lineHeight: 56, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  heroSub: { fontSize: 14, color: '#FFFFFF' },
  callBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 48, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandMint },
  callBtnHover: { backgroundColor: '#FFFFFF' },
  callBtnText: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  msg: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  msgText: { flex: 1, fontSize: 14, fontWeight: '600' },
  panel: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 16, gap: 4 },
  panelTitle: { fontSize: 15, fontWeight: '700', color: Colors.brandNavy, marginBottom: 4 },
  doneHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  rowNumber: { width: 44, fontSize: 22, fontWeight: '800', color: Colors.brandNavy, fontVariant: ['tabular-nums'] },
  rowName: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  pill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  pillText: { fontSize: 12, fontWeight: '600' },
  rowActions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  btn: { height: 36, paddingHorizontal: 12, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryHover: { backgroundColor: Colors.brandGreenPressed },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnSecondaryHover: { backgroundColor: Colors.brandGreenSoft },
  btnSecondaryText: { color: Colors.brandGreen, fontSize: 14, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  settingRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  settingText: { fontSize: 14, color: Colors.slateMuted, flexShrink: 1 },
  link: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  minutesInput: { width: 56, height: 36, paddingHorizontal: 8, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, fontSize: 16, fontWeight: '600', textAlign: 'center', color: Colors.slateDark, backgroundColor: Colors.surface },
});

export default QueueDesk;
