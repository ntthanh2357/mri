import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import CopyStatusBadge from '../components/CopyStatusBadge';
import Colors from '../constants/colors';
import { useRecordCopyReview } from '../controllers/useRecordCopyReview';
import { copySectionsText, COPY_REASON_MAX } from '../utils/recordCopy';

// Lễ tân / quản lý bệnh viện duyệt yêu cầu bản sao bệnh án của bệnh nhân.

const FILTERS = [
  { key: 'pending', label: 'Chờ duyệt' },
  { key: 'approved', label: 'Đã duyệt' },
  { key: 'rejected', label: 'Đã từ chối' },
  { key: 'all', label: 'Tất cả' },
];
const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

const RequestRow = ({ r, busy, onApprove, onReject }) => {
  const [mode, setMode] = useState(null); // null | 'approve' | 'reject'
  const [reason, setReason] = useState('');
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={styles.name}>{r.patient.name}{r.patient.medicalId ? ` (${r.patient.medicalId})` : ''}</Text>
          <Text style={styles.meta}>Gửi lúc {fmtTime(r.createdAt)}</Text>
        </View>
        <CopyStatusBadge status={r.status} />
      </View>
      <Text style={styles.body}><Text style={styles.bold}>Phần cần sao: </Text>{copySectionsText(r.sections)}</Text>
      {r.reason ? <Text style={styles.body}><Text style={styles.bold}>Lý do: </Text>{r.reason}</Text> : null}
      {r.status !== 'pending' && r.reviewedByName ? (
        <Text style={styles.meta}>{r.status === 'approved' ? 'Duyệt' : 'Từ chối'} bởi {r.reviewedByName} lúc {fmtTime(r.reviewedAt)}</Text>
      ) : null}
      {r.status === 'rejected' && r.rejectReason ? <Text style={styles.meta}>Lý do từ chối: {r.rejectReason}</Text> : null}

      {r.status === 'pending' && !mode ? (
        <View style={styles.actions}>
          <Pressable onPress={() => setMode('approve')} disabled={busy} accessibilityRole="button" accessibilityLabel="Duyệt"
            style={({ hovered }) => [styles.primaryBtn, hovered && styles.primaryHover, busy && styles.disabled]}>
            <Feather name="check" size={16} color="#FFFFFF" />
            <Text style={styles.primaryText}>Duyệt</Text>
          </Pressable>
          <Pressable onPress={() => setMode('reject')} disabled={busy} accessibilityRole="button" accessibilityLabel="Từ chối"
            style={({ hovered }) => [styles.secondaryBtn, hovered && styles.secondaryHover, busy && styles.disabled]}>
            <Text style={styles.secondaryText}>Từ chối</Text>
          </Pressable>
        </View>
      ) : null}

      {mode === 'approve' ? (
        <View style={styles.confirm}>
          <Text style={styles.body}>Duyệt xong, bệnh nhân tải được ngay bản sao các phần trên (dữ liệu của bệnh viện mình, chốt tại lúc duyệt). Không thu hồi được.</Text>
          <View style={styles.actions}>
            <Pressable onPress={async () => { await onApprove(); setMode(null); }} disabled={busy} accessibilityRole="button" accessibilityLabel="Xác nhận duyệt"
              style={({ hovered }) => [styles.primaryBtn, hovered && styles.primaryHover, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="check" size={16} color="#FFFFFF" />}
              <Text style={styles.primaryText}>Xác nhận duyệt</Text>
            </Pressable>
            <Pressable onPress={() => setMode(null)} disabled={busy} accessibilityRole="button" style={styles.ghostBtn}>
              <Text style={styles.ghostText}>Huỷ</Text>
            </Pressable>
          </View>
        </View>
      ) : null}

      {mode === 'reject' ? (
        <View style={styles.confirm}>
          <Text style={styles.label}>Lý do từ chối (bệnh nhân sẽ thấy)</Text>
          <TextInput value={reason} onChangeText={setReason} multiline maxLength={COPY_REASON_MAX} accessibilityLabel="Lý do từ chối"
            placeholder="Ví dụ: cần tới quầy xuất trình giấy tờ tuỳ thân…" placeholderTextColor={Colors.slateMuted} style={styles.input} />
          <View style={styles.actions}>
            <Pressable onPress={async () => { const ok = await onReject(reason.trim()); if (ok) setMode(null); }} disabled={busy || !reason.trim()} accessibilityRole="button"
              style={({ hovered }) => [styles.dangerBtn, hovered && styles.dangerHover, (busy || !reason.trim()) && styles.disabled]}>
              <Text style={styles.primaryText}>Từ chối yêu cầu</Text>
            </Pressable>
            <Pressable onPress={() => setMode(null)} disabled={busy} accessibilityRole="button" style={styles.ghostBtn}>
              <Text style={styles.ghostText}>Huỷ</Text>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
};

export default function RecordCopyReviewScreen({ navigation }) {
  const [filter, setFilter] = useState('pending');
  const { loading, requests, error, busyId, approve, reject, reload } = useRecordCopyReview(filter);
  const [msg, setMsg] = useState(null);

  const onApprove = async (id) => { const res = await approve(id); setMsg({ tone: res.ok ? 'info' : 'error', text: res.message }); return res.ok; };
  const onReject = async (id, reason) => { const res = await reject(id, reason); setMsg({ tone: res.ok ? 'info' : 'error', text: res.message }); return res.ok; };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="RecordCopyReview">
      <View style={styles.flex}>
        <PageHeader bar title="Yêu cầu bản sao bệnh án" subtitle="Bệnh nhân xin bản sao bệnh án qua ứng dụng. Duyệt để bệnh nhân tải PDF có ký số."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={reload} />}
          below={(
            <View style={styles.filters} accessibilityRole="tablist">
              {FILTERS.map((f) => (
                <Pressable key={f.key} onPress={() => { setMsg(null); setFilter(f.key); }} accessibilityRole="tab" aria-selected={filter === f.key}
                  style={({ hovered }) => [styles.chip, filter === f.key && styles.chipOn, hovered && filter !== f.key && styles.chipHover]}>
                  <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
                </Pressable>
              ))}
            </View>
          )} />
        <ScrollView>
          <PageContainer style={styles.page}>
            {msg ? <Text style={msg.tone === 'error' ? styles.error : styles.info} accessibilityLiveRegion="polite">{msg.text}</Text> : null}
            {loading && !requests.length ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error && !requests.length ? (
              <Text style={styles.meta}>{filter === 'pending' ? 'Không có yêu cầu nào đang chờ duyệt.' : 'Không có yêu cầu nào.'}</Text>
            ) : null}
            {requests.map((r) => (
              <RequestRow key={r._id} r={r} busy={busyId === r._id} onApprove={() => onApprove(r._id)} onReject={(reason) => onReject(r._id, reason)} />
            ))}
          </PageContainer>
        </ScrollView>
      </View>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingVertical: 20, gap: 12 },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 14, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  chipOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipHover: { borderColor: Colors.brandGreen },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  chipTextOn: { color: '#FFFFFF' },
  card: { gap: 8, padding: 16, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  head: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  name: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  bold: { fontWeight: '600' },
  meta: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  label: { fontSize: 13, fontWeight: '600', color: Colors.slateDark },
  actions: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  confirm: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.background },
  input: { minHeight: 72, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, padding: 12, fontSize: 15, lineHeight: 22, color: Colors.slateDark, textAlignVertical: 'top' },
  primaryBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen },
  primaryHover: { backgroundColor: Colors.brandGreenPressed },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  secondaryBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  secondaryHover: { borderColor: Colors.errorText },
  secondaryText: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  dangerBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 16, borderRadius: 10, backgroundColor: Colors.errorText },
  dangerHover: { opacity: 0.9 },
  ghostBtn: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 12 },
  ghostText: { fontSize: 14, fontWeight: '600', color: Colors.slateMuted },
  error: { fontSize: 14, lineHeight: 20, color: Colors.errorText },
  info: { fontSize: 14, lineHeight: 20, color: Colors.successText },
  disabled: { opacity: 0.5 },
});
