import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import QRCode from 'react-native-qrcode-svg';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import ScannedDocuments from '../components/patient/ScannedDocuments';
import Colors from '../constants/colors';
import { useRecordShares } from '../controllers/useRecordShares';
import { secondsLeft, fmtCountdown, sectionsSummary, SHARE_SECTIONS } from '../utils/recordShare';

// UC-PAT-09 — Bệnh nhân tạo mã QR chia sẻ toàn bộ bệnh án. Mã chỉ mở được trong 5 phút;
// ai quét kịp sẽ xem được lâu dài cho tới khi bệnh nhân dừng chia sẻ.

const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');

const QrPanel = ({ qr, onNew, onDone, busy }) => {
  const [left, setLeft] = useState(secondsLeft(qr.expiresAt));
  useEffect(() => {
    setLeft(secondsLeft(qr.expiresAt));
    const t = setInterval(() => setLeft(secondsLeft(qr.expiresAt)), 1000);
    return () => clearInterval(t);
  }, [qr.expiresAt]);
  const expired = left === 0;

  return (
    <View style={styles.qrCard}>
      {expired ? (
        <View style={styles.expiredBox}>
          <Feather name="clock" size={32} color={Colors.slateMuted} />
          <Text style={styles.expiredTitle}>Mã QR đã hết hạn</Text>
          <Text style={styles.note}>Người đã quét kịp vẫn xem được. Muốn chia sẻ thêm người khác, hãy tạo mã mới.</Text>
        </View>
      ) : (
        <>
          <View style={styles.qrBox} accessible accessibilityLabel="Mã QR chia sẻ bệnh án">
            <QRCode value={qr.url} size={220} color={Colors.brandNavy} backgroundColor="#FFFFFF" />
          </View>
          <View style={styles.countdown} accessibilityLiveRegion="polite">
            <Feather name="clock" size={16} color={left <= 60 ? Colors.warningText : Colors.brandGreen} />
            <Text style={[styles.countdownText, left <= 60 && styles.countdownWarn]}>Còn {fmtCountdown(left)} để quét</Text>
          </View>
          <Text style={styles.sharedWhat}>Chia sẻ: {sectionsSummary(qr.sections)}</Text>
          <Text style={styles.note}>Đưa mã này cho bác sĩ hoặc người bạn muốn chia sẻ quét bằng camera điện thoại. Không cần cài ứng dụng hay đăng nhập.</Text>
        </>
      )}
      <View style={styles.row}>
        <Pressable onPress={onNew} disabled={busy} accessibilityRole="button" style={({ hovered }) => [styles.secondaryBtn, hovered && styles.secondaryBtnHover]}>
          <Text style={styles.secondaryBtnText}>Tạo mã mới</Text>
        </Pressable>
        <Pressable onPress={onDone} accessibilityRole="button" style={styles.ghostBtn}>
          <Text style={styles.ghostBtnText}>Ẩn mã</Text>
        </Pressable>
      </View>
    </View>
  );
};

const ShareRow = ({ s, onRevoke }) => {
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <View style={styles.shareRow}>
      <View style={styles.shareIcon}><Feather name="share-2" size={16} color={Colors.brandGreen} /></View>
      <View style={styles.grow}>
        <Text style={styles.shareTitle}>Chia sẻ lúc {fmtTime(s.createdAt)}</Text>
        <Text style={styles.body}>{sectionsSummary(s.sections)}</Text>
        <Text style={styles.note}>
          {s.viewerCount > 0 ? `${s.viewerCount} người đã mở, ${s.totalViews} lượt xem` : 'Chưa có ai mở'}
          {s.lastViewedAt ? `, xem gần nhất ${fmtTime(s.lastViewedAt)}` : ''}
          {s.qrActive ? '. Mã QR còn hiệu lực.' : '.'}
        </Text>
      </View>
      {confirm ? (
        <View style={styles.row}>
          <Pressable onPress={() => setConfirm(false)} accessibilityRole="button" style={styles.ghostBtn}><Text style={styles.ghostBtnText}>Giữ</Text></Pressable>
          <Pressable onPress={async () => { setBusy(true); await onRevoke(s._id); setBusy(false); }} disabled={busy} accessibilityRole="button" style={styles.dangerBtn}>
            {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.dangerBtnText}>Dừng chia sẻ</Text>}
          </Pressable>
        </View>
      ) : (
        <Pressable onPress={() => setConfirm(true)} accessibilityRole="button" hitSlop={8}>
          <Text style={styles.dangerLink}>Dừng chia sẻ</Text>
        </Pressable>
      )}
    </View>
  );
};

const RecordShareScreen = ({ navigation }) => {
  const { loading, shares, error, qr, clearQr, create, revoke, reload, sections, toggleSection } = useRecordShares();
  const none = sections.length === 0;
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const makeQr = async () => {
    setBusy(true);
    const res = await create();
    setBusy(false);
    setMsg(res.ok ? null : res.message);
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="RecordShare">
      <View style={styles.container}>
        <PageHeader bar title="Chia sẻ bệnh án" subtitle="Tạo mã QR để bác sĩ nơi khác xem bệnh án của bạn, kể cả phim chụp."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={reload} />} />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>
            <View style={styles.stack}>
              {qr ? (
                <QrPanel qr={qr} onNew={makeQr} onDone={clearQr} busy={busy} />
              ) : (
                <View style={styles.card}>
                  <Text style={styles.cardTitle}>Chia sẻ bệnh án qua mã QR</Text>
                  <Text style={styles.body}>
                    Chọn những phần bạn muốn chia sẻ. Họ tên, tuổi, giới tính và mã bệnh nhân luôn hiện để người xem biết bệnh án của ai.
                    Số CCCD và thẻ BHYT không bao giờ được chia sẻ.
                  </Text>
                  <View style={styles.checks}>
                    {SHARE_SECTIONS.map((sec) => {
                      const on = sections.includes(sec.key);
                      return (
                        <Pressable key={sec.key} onPress={() => toggleSection(sec.key)} accessibilityRole="checkbox" aria-checked={on}
                          accessibilityLabel={sec.label}
                          style={({ hovered }) => [styles.check, on && styles.checkOn, hovered && styles.checkHover]}>
                          <Feather name={on ? 'check-square' : 'square'} size={20} color={on ? Colors.brandGreen : Colors.slateMuted} />
                          <Feather name={sec.icon} size={16} color={Colors.slateMuted} />
                          <Text style={styles.checkText}>{sec.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {none ? <Text style={styles.error}>Hãy chọn ít nhất 1 phần để chia sẻ.</Text> : null}
                  <View style={styles.points}>
                    {[
                      ['clock', 'Mã chỉ quét được trong 5 phút sau khi tạo.'],
                      ['eye', 'Ai đã quét kịp sẽ xem được lâu dài.'],
                      ['slash', 'Bạn có thể dừng chia sẻ bất cứ lúc nào ở danh sách bên dưới.'],
                    ].map(([icon, text]) => (
                      <View key={icon} style={styles.point}>
                        <Feather name={icon} size={15} color={Colors.brandGreen} />
                        <Text style={styles.pointText}>{text}</Text>
                      </View>
                    ))}
                  </View>
                  {msg ? <Text style={styles.error}>{msg}</Text> : null}
                  <Pressable onPress={makeQr} disabled={busy || none} accessibilityRole="button"
                    style={({ hovered }) => [styles.primaryBtn, hovered && !none && styles.primaryBtnHover, (busy || none) && styles.disabled]}>
                    {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Tạo mã QR</Text>}
                  </Pressable>
                </View>
              )}

              <ScannedDocuments />

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Đang chia sẻ</Text>
                {loading && !shares.length ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : null}
                {error ? <Text style={styles.error}>{error}</Text> : null}
                {!loading && !shares.length ? <Text style={styles.note}>Bạn chưa chia sẻ bệnh án với ai.</Text> : null}
                {shares.map((s) => <ShareRow key={s._id} s={s} onRevoke={revoke} />)}
              </View>
            </View>
          </PageContainer>
        </ScrollView>
      </View>
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  page: { paddingTop: 20, paddingBottom: 40 },
  stack: { gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  row: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8 },
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  error: { fontSize: 14, color: Colors.warningText },
  points: { gap: 8 },
  point: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  pointText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  checks: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  check: { flexGrow: 1, flexBasis: 260, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  checkOn: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  checkHover: { borderColor: Colors.brandGreen },
  checkText: { flex: 1, fontSize: 15, color: Colors.slateDark },
  sharedWhat: { fontSize: 14, lineHeight: 20, color: Colors.slateDark, textAlign: 'center' },
  qrCard: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 20, gap: 14, alignItems: 'center' },
  qrBox: { padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border },
  countdown: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  countdownText: { fontSize: 18, fontWeight: '700', color: Colors.brandGreen, fontVariant: ['tabular-nums'] },
  countdownWarn: { color: Colors.warningText },
  expiredBox: { alignItems: 'center', gap: 8, paddingVertical: 20 },
  expiredTitle: { fontSize: 17, fontWeight: '700', color: Colors.slateDark },
  shareRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, paddingVertical: 10, borderTopWidth: 1, borderTopColor: Colors.border },
  shareIcon: { width: 32, height: 32, borderRadius: 16, backgroundColor: Colors.brandGreenSoft, alignItems: 'center', justifyContent: 'center' },
  shareTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  primaryBtn: { height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnHover: { backgroundColor: Colors.brandGreenSoft },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 14, fontWeight: '600' },
  ghostBtn: { height: 40, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  ghostBtnText: { color: Colors.slateMuted, fontSize: 14, fontWeight: '600' },
  dangerBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.errorText, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  dangerLink: { fontSize: 14, fontWeight: '600', color: Colors.errorText },
  disabled: { opacity: 0.5 },
});

export default RecordShareScreen;
