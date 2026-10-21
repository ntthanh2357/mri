import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useRecordCopies } from '../controllers/useRecordCopies';
import CopyStatusBadge from '../components/CopyStatusBadge';
import { COPY_SECTIONS, COPY_REASON_MAX, copySectionsText, copyFormError } from '../utils/recordCopy';

// Bệnh nhân xin bệnh viện cấp bản sao bệnh án: chọn phần cần sao, ghi lý do, theo dõi trạng thái, tải PDF có ký số khi đã duyệt.

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

const Check = ({ on, label, icon, onPress }) => (
  <Pressable onPress={onPress} accessibilityRole="checkbox" aria-checked={on} accessibilityLabel={label}
    style={({ hovered }) => [styles.check, on && styles.checkOn, hovered && styles.checkHover]}>
    <Feather name={on ? 'check-square' : 'square'} size={18} color={on ? Colors.brandGreen : Colors.slateMuted} />
    <Feather name={icon} size={15} color={Colors.slateMuted} />
    <Text style={styles.checkText}>{label}</Text>
  </Pressable>
);

const RequestCard = ({ r, busy, onCancel, onDownload }) => (
  <View style={styles.card}>
    <View style={styles.head}>
      <View style={styles.grow}>
        <Text style={styles.title}>{copySectionsText(r.sections)}</Text>
        <Text style={styles.meta}>Gửi ngày {fmtDate(r.createdAt)}{r.reason ? `. Lý do: ${r.reason}` : ''}</Text>
      </View>
      <CopyStatusBadge status={r.status} />
    </View>
    {r.status === 'approved' ? (
      <>
        <Text style={styles.meta}>Duyệt ngày {fmtDate(r.reviewedAt)}{r.reviewedByName ? ` bởi ${r.reviewedByName}` : ''}. File PDF có ký số của bệnh viện.</Text>
        <Pressable onPress={onDownload} disabled={busy} accessibilityRole="button" accessibilityLabel="Tải bản sao (PDF)"
          style={({ hovered }) => [styles.primaryBtn, styles.selfStart, hovered && styles.primaryHover, busy && styles.disabled]}>
          {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="download" size={16} color="#FFFFFF" />}
          <Text style={styles.primaryText}>Tải bản sao (PDF)</Text>
        </Pressable>
      </>
    ) : null}
    {r.status === 'rejected' ? <Text style={styles.reject}>Lý do từ chối: {r.rejectReason}</Text> : null}
    {r.status === 'pending' ? (
      <View style={styles.row}>
        <Text style={[styles.meta, styles.grow]}>Bệnh viện đang xem xét. Bạn sẽ nhận thông báo khi có kết quả.</Text>
        <Pressable onPress={onCancel} disabled={busy} accessibilityRole="button" hitSlop={6} style={styles.linkBtn}>
          <Text style={styles.dangerLink}>{busy ? 'Đang huỷ…' : 'Huỷ yêu cầu'}</Text>
        </Pressable>
      </View>
    ) : null}
  </View>
);

export default function RecordCopiesScreen({ navigation }) {
  const { loading, requests, error, busyId, create, cancel, download, reload } = useRecordCopies();
  const [sections, setSections] = useState(COPY_SECTIONS.map((s) => s.key));
  const [reason, setReason] = useState('');
  const [msg, setMsg] = useState(null); // { tone: 'info' | 'error', text }

  const toggle = (key) => setSections((cur) => (cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key]));
  const formError = copyFormError({ sections, reason });

  const onSubmit = async () => {
    if (formError) { setMsg({ tone: 'error', text: formError }); return; }
    const res = await create({ sections, reason: reason.trim() });
    setMsg({ tone: res.ok ? 'info' : 'error', text: res.message });
    if (res.ok) setReason('');
  };
  const onCancel = async (id) => { const res = await cancel(id); setMsg({ tone: res.ok ? 'info' : 'error', text: res.message }); };
  const onDownload = async (id) => { const res = await download(id); if (!res.ok) setMsg({ tone: 'error', text: res.message }); };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="RecordCopies">
      <View style={styles.flex}>
        <PageHeader bar title="Bản sao bệnh án" subtitle="Xin bệnh viện cấp bản sao bệnh án có ký số, tải về dạng PDF."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={reload} />} />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Gửi yêu cầu mới</Text>
              <Text style={styles.body}>
                Yêu cầu được gửi tới bệnh viện bạn đang khám. Bản sao gồm dữ liệu do bệnh viện ghi, chốt tại lúc duyệt; không gồm số CCCD và số thẻ BHYT.
              </Text>
              <Text style={styles.label}>Phần cần sao</Text>
              <View style={styles.grid}>
                {COPY_SECTIONS.map((s) => <Check key={s.key} on={sections.includes(s.key)} label={s.label} icon={s.icon} onPress={() => toggle(s.key)} />)}
              </View>
              <Text style={styles.label}>Lý do (không bắt buộc)</Text>
              <TextInput value={reason} onChangeText={setReason} multiline maxLength={COPY_REASON_MAX} accessibilityLabel="Lý do xin bản sao"
                placeholder="Ví dụ: khám ở bệnh viện khác, làm hồ sơ bảo hiểm…" placeholderTextColor={Colors.slateMuted} style={styles.input} />
              <Text style={styles.counter}>{reason.length}/{COPY_REASON_MAX}</Text>
              <Pressable onPress={onSubmit} disabled={busyId === 'new' || !!formError} accessibilityRole="button" accessibilityLabel="Gửi yêu cầu"
                style={({ hovered }) => [styles.primaryBtn, styles.selfStart, hovered && styles.primaryHover, (busyId === 'new' || formError) && styles.disabled]}>
                {busyId === 'new' ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="send" size={16} color="#FFFFFF" />}
                <Text style={styles.primaryText}>Gửi yêu cầu</Text>
              </Pressable>
              {formError ? <Text style={styles.meta}>{formError}</Text> : null}
            </View>

            {msg ? <Text style={msg.tone === 'error' ? styles.error : styles.info} accessibilityLiveRegion="polite">{msg.text}</Text> : null}

            <Text style={styles.sectionTitle}>Yêu cầu của tôi</Text>
            {loading && !requests.length ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : null}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {!loading && !error && !requests.length ? <Text style={styles.meta}>Bạn chưa gửi yêu cầu nào.</Text> : null}
            {requests.map((r) => (
              <RequestCard key={r._id} r={r} busy={busyId === r._id} onCancel={() => onCancel(r._id)} onDownload={() => onDownload(r._id)} />
            ))}
          </PageContainer>
        </ScrollView>
      </View>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingVertical: 20, gap: 14 },
  card: { gap: 10, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy, marginTop: 8 },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  label: { fontSize: 13, fontWeight: '600', color: Colors.slateDark },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { minHeight: 44, flexGrow: 1, flexBasis: 220, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  checkOn: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  checkHover: { borderColor: Colors.brandGreen },
  checkText: { flex: 1, fontSize: 15, color: Colors.slateDark },
  input: { minHeight: 80, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, padding: 12, fontSize: 15, lineHeight: 22, color: Colors.slateDark, textAlignVertical: 'top' },
  counter: { alignSelf: 'flex-end', fontSize: 12, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  head: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 10 },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  title: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  meta: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  reject: { fontSize: 14, lineHeight: 20, color: Colors.errorText },
  primaryBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen },
  primaryHover: { backgroundColor: Colors.brandGreenPressed },
  primaryText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  selfStart: { alignSelf: 'flex-start' },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  dangerLink: { fontSize: 14, fontWeight: '600', color: Colors.errorText },
  error: { fontSize: 14, lineHeight: 20, color: Colors.errorText },
  info: { fontSize: 14, lineHeight: 20, color: Colors.successText },
  disabled: { opacity: 0.5 },
});
