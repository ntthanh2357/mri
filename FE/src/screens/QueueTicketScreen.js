import React, { useState } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, useWindowDimensions, Platform } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { Ticket, RefreshCw, Lightbulb, ListChecks } from 'lucide-react';
import ResponsiveLayout from '../components/ResponsiveLayout';
import Colors from '../constants/colors';
import { useQueueTicket } from '../controllers/useQueueTicket';
import { PatientPage, PatientHero, HeroButton, SideCard, StepList, PATIENT_IMAGES, P } from '../components/patient/PatientUI';

// UC-PAT-03 — Lấy số tiếp đón online trong ngày; theo dõi số đang gọi và giờ dự kiến tới lượt.

const isWeb = Platform.OS === 'web';
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');

const STATUS = {
  waiting: { label: 'Đang chờ', tone: 'info', icon: 'clock' },
  arrived: { label: 'Đã có mặt, chờ gọi', tone: 'info', icon: 'map-pin' },
  called: { label: 'Đang gọi số của bạn', tone: 'ok', icon: 'volume-2' },
  missed: { label: 'Đã qua lượt, số vẫn được giữ', tone: 'warn', icon: 'alert-circle' },
  served: { label: 'Đã tiếp nhận', tone: 'ok', icon: 'check-circle' },
  cancelled: { label: 'Đã huỷ', tone: 'muted', icon: 'x-circle' },
};
const TONE = {
  ok: { bg: Colors.successBg, fg: Colors.successText },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
  muted: { bg: Colors.background, fg: Colors.slateMuted },
};
const ACTIVE = ['waiting', 'arrived', 'called', 'missed'];

const STEPS = [
  { title: 'Lấy số online', text: 'Bấm "Lấy số" khi bạn chuẩn bị tới bệnh viện. Mỗi người một số, chỉ dùng trong ngày.' },
  { title: 'Theo dõi số đang gọi', text: 'Trang tự cập nhật mỗi 30 giây, kèm số người phía trước và giờ dự kiến tới lượt.' },
  { title: 'Có mặt trước giờ dự kiến', text: 'Nên tới sớm khoảng 10–15 phút để kịp làm thủ tục.' },
  { title: 'Báo số tại quầy tiếp đón', text: 'Lễ tân gọi số của bạn để tạo lượt khám và hướng dẫn tiếp.' },
];
const TIPS = [
  'Mang theo CCCD và thẻ BHYT (nếu có) để được hưởng bảo hiểm.',
  'Lỡ lượt? Số vẫn được giữ — báo lễ tân số của bạn để được gọi ngay tiếp theo.',
  'Mang theo phim, kết quả khám cũ để bác sĩ so sánh.',
];

const Stat = ({ label, value, accent }) => (
  <View style={styles.stat}>
    <Text style={[styles.statValue, accent && { color: P.teal }]}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QueueTicketScreen = ({ navigation }) => {
  const { width } = useWindowDimensions();
  const isWide = width > 1100;
  const { loading, data, hospitals, error, reload, take, cancel, hospitalId, setHospitalId } = useQueueTicket();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  const run = async (fn) => {
    setBusy(true);
    const res = await fn();
    setBusy(false);
    setMsg(res.ok ? null : res);
    setConfirmCancel(false);
  };

  const ticket = data?.ticket;
  const active = ticket && ACTIVE.includes(ticket.status);
  const status = ticket ? STATUS[ticket.status] : null;
  const needHospital = data?.needHospital && !hospitalId;

  const renderMain = () => {
    if (loading && !data) return <View style={styles.stateBox}><ActivityIndicator size="large" color={P.teal} /><Text style={styles.note}>Đang tải…</Text></View>;
    if (error && !data) {
      return (
        <View style={styles.stateBox}>
          <Text style={styles.stateTitle}>{error}</Text>
          <Pressable onPress={reload} accessibilityRole="button" style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Thử lại</Text></Pressable>
        </View>
      );
    }
    if (needHospital) {
      return (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Chọn bệnh viện</Text>
          <Text style={styles.note}>Tài khoản của bạn chưa gắn với bệnh viện nào. Chọn nơi bạn sẽ đến khám hôm nay.</Text>
          {hospitals.length === 0 ? <Text style={styles.note}>Chưa có bệnh viện nào nhận lấy số online.</Text> : null}
          {hospitals.map((h) => (
            <Pressable key={h._id} onPress={() => setHospitalId(h._id)} accessibilityRole="button" style={({ hovered }) => [styles.option, hovered && styles.optionHover]}>
              <Feather name="home" size={16} color={P.teal} />
              <View style={styles.grow}>
                <Text style={styles.optionTitle}>{h.name}</Text>
                {h.address ? <Text style={styles.note}>{typeof h.address === 'string' ? h.address : ''}</Text> : null}
              </View>
              <Feather name="chevron-right" size={16} color={Colors.slateMuted} />
            </Pressable>
          ))}
        </View>
      );
    }

    if (!active) {
      return (
        <View style={styles.stack}>
          {ticket?.status === 'served' ? (
            <View style={[styles.banner, { backgroundColor: Colors.successBg }]}>
              <Feather name="check-circle" size={16} color={Colors.successText} />
              <Text style={[styles.bannerText, { color: Colors.successText }]}>Số {ticket.number} của bạn đã được tiếp nhận hôm nay.</Text>
            </View>
          ) : null}
          {/* Vé chưa lấy: thẻ dạng vé xé có nút lấy số */}
          <View style={styles.ticketEmpty}>
            <View style={[styles.notch, styles.notchL]} />
            <View style={[styles.notch, styles.notchR]} />
            <View style={styles.ticketEmptyIcon}><Ticket size={30} color={P.mint} /></View>
            <Text style={styles.ticketEmptyTitle}>Bạn chưa có số hôm nay</Text>
            <Text style={styles.ticketEmptyText}>Lấy số trước ở nhà, theo dõi số đang gọi và tới bệnh viện đúng lúc — không phải xếp hàng chờ ở sảnh.</Text>
            <Pressable onPress={() => run(take)} disabled={busy} accessibilityRole="button"
              style={({ hovered }) => [styles.takeBtn, hovered && styles.takeBtnHover, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color={P.navy} /> : (
                <>
                  <Ticket size={18} color={P.navy} />
                  <Text style={styles.takeBtnText}>Lấy số ngay</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      );
    }

    const tone = TONE[status.tone];
    return (
      <View style={styles.stack}>
        <View style={[styles.ticket, ticket.status === 'called' && styles.ticketCalled]}>
          <View style={[styles.notch, styles.notchL]} />
          <View style={[styles.notch, styles.notchR]} />
          <Text style={styles.ticketLabel}>SỐ CỦA BẠN</Text>
          <Text style={styles.ticketNumber} accessibilityLabel={`Số của bạn ${ticket.number}`}>{ticket.number}</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Feather name={status.icon} size={14} color={tone.fg} />
            <Text style={[styles.pillText, { color: tone.fg }]}>{status.label}</Text>
          </View>
          <View style={styles.ticketDivider} />
          <Text style={styles.ticketFoot}>Tự cập nhật mỗi 30 giây · số chỉ dùng trong hôm nay</Text>
        </View>

        {ticket.status === 'called' ? (
          <View style={[styles.banner, { backgroundColor: Colors.successBg }]}>
            <Feather name="volume-2" size={16} color={Colors.successText} />
            <Text style={[styles.bannerText, { color: Colors.successText }]}>Mời bạn tới quầy tiếp đón ngay.</Text>
          </View>
        ) : ticket.status === 'missed' ? (
          <View style={[styles.banner, { backgroundColor: Colors.warningBg }]}>
            <Feather name="alert-circle" size={16} color={Colors.warningText} />
            <Text style={[styles.bannerText, { color: Colors.warningText }]}>
              Số của bạn đã được gọi khi bạn chưa có mặt. Bạn không cần lấy số mới: khi tới, báo lễ tân số {ticket.number} để được gọi ngay tiếp theo.
            </Text>
          </View>
        ) : null}

        <View style={styles.statsRow}>
          <Stat label="số đang gọi" value={data.current || '—'} accent />
          {data.ahead !== null && data.ahead !== undefined ? <Stat label="người phía trước" value={data.ahead} /> : null}
          {data.estimatedAt && ticket.status !== 'called' ? <Stat label="dự kiến tới lượt" value={`~${fmtTime(data.estimatedAt)}`} /> : null}
        </View>
        {data.estimatedAt && ['waiting', 'arrived'].includes(ticket.status) ? (
          <Text style={styles.note}>
            Nên có mặt trước khoảng {fmtTime(data.estimatedAt)}. Giờ dự kiến chỉ là ước tính, có thể sớm hoặc muộn hơn.
          </Text>
        ) : null}

        {ticket.status !== 'called' ? (
          confirmCancel ? (
            <View style={styles.confirmRow}>
              <Text style={[styles.note, styles.grow]}>Huỷ số {ticket.number}? Muốn khám lại bạn sẽ phải lấy số mới.</Text>
              <Pressable onPress={() => setConfirmCancel(false)} accessibilityRole="button" style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Giữ số</Text></Pressable>
              <Pressable onPress={() => run(cancel)} disabled={busy} accessibilityRole="button" style={styles.dangerBtn}><Text style={styles.dangerBtnText}>Huỷ số</Text></Pressable>
            </View>
          ) : (
            <Pressable onPress={() => setConfirmCancel(true)} accessibilityRole="button" hitSlop={8} style={styles.linkBtn}>
              <Text style={styles.dangerLink}>Huỷ số này</Text>
            </Pressable>
          )
        ) : null}
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="QueueTicket">
      <PatientPage>
        <PatientHero
          image={PATIENT_IMAGES.lobby}
          eyebrow="Tiếp đón online"
          title="Lấy số khám"
          subtitle="Lấy số tiếp đón từ xa và theo dõi lượt gọi trong ngày — tới bệnh viện đúng lúc, không chờ lâu ở sảnh."
          stats={[
            { value: data?.current || '—', label: 'số đang gọi' },
            { value: active ? (data?.ahead ?? '—') : (data?.waiting ?? 0), label: active ? 'người phía trước' : 'người đang chờ' },
            { value: active ? ticket.number : '—', label: 'số của bạn' },
          ]}
        >
          <HeroButton icon={RefreshCw} label="Tải lại" onPress={reload} ghost />
        </PatientHero>

        {msg && !msg.ok ? (
          <View style={[styles.banner, { backgroundColor: Colors.warningBg }]} accessibilityLiveRegion="polite">
            <Feather name="alert-circle" size={16} color={Colors.warningText} />
            <Text style={[styles.bannerText, { color: Colors.warningText }]}>{msg.message}</Text>
          </View>
        ) : null}

        <View style={[styles.columns, isWide && styles.columnsWide]}>
          <View style={[styles.mainCol, isWide && { flex: 1.25 }]}>{renderMain()}</View>
          <View style={[styles.sideCol, isWide && { flex: 1 }]}>
            <SideCard icon={ListChecks} title="Lấy số hoạt động thế nào?" subtitle="4 bước, không cần xếp hàng">
              <StepList steps={STEPS} />
            </SideCard>
            <SideCard icon={Lightbulb} title="Lưu ý khi tới bệnh viện" tone="mint">
              {TIPS.map((t) => (
                <View key={t} style={styles.tip}>
                  <Feather name="check" size={14} color={P.teal} style={{ marginTop: 2 }} />
                  <Text style={styles.tipText}>{t}</Text>
                </View>
              ))}
            </SideCard>
          </View>
        </View>
      </PatientPage>
    </ResponsiveLayout>
  );
};

const shadow = isWeb ? { boxShadow: '0 12px 30px -18px rgba(11,42,85,0.35)' } : { elevation: 2 };

const styles = StyleSheet.create({
  columns: { gap: 20 },
  columnsWide: { flexDirection: 'row', alignItems: 'flex-start' },
  mainCol: { gap: 16 },
  sideCol: { gap: 16 },
  stack: { gap: 16 },
  grow: { flex: 1, minWidth: 0 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 20, borderWidth: 1, borderColor: P.line, padding: 20, gap: 12, ...shadow },
  cardTitle: { fontSize: 17, fontWeight: '800', color: P.navy },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },

  ticketEmpty: { position: 'relative', overflow: 'hidden', alignItems: 'center', gap: 10, paddingVertical: 36, paddingHorizontal: 28, borderRadius: 24, backgroundColor: P.navy, ...shadow },
  ticketEmptyIcon: { width: 64, height: 64, borderRadius: 20, backgroundColor: 'rgba(111,221,178,0.14)', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  ticketEmptyTitle: { fontSize: 22, fontWeight: '800', color: '#FFFFFF' },
  ticketEmptyText: { fontSize: 14, lineHeight: 21, color: '#B8C7DD', textAlign: 'center', maxWidth: 440 },
  takeBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, height: 52, paddingHorizontal: 30, borderRadius: 999, backgroundColor: P.mint },
  takeBtnHover: { backgroundColor: '#FFFFFF' },
  takeBtnText: { color: P.navy, fontSize: 16, fontWeight: '800' },

  ticket: { position: 'relative', overflow: 'hidden', alignItems: 'center', gap: 8, paddingVertical: 30, paddingHorizontal: 24, borderRadius: 24, backgroundColor: P.navy, ...shadow },
  ticketCalled: { backgroundColor: P.teal },
  notch: { position: 'absolute', top: '50%', marginTop: -14, width: 28, height: 28, borderRadius: 14, backgroundColor: P.page },
  notchL: { left: -14 },
  notchR: { right: -14 },
  ticketLabel: { fontSize: 13, color: P.mint, fontWeight: '800', letterSpacing: 2 },
  ticketNumber: { fontSize: 88, lineHeight: 96, fontWeight: '900', color: '#FFFFFF', fontVariant: ['tabular-nums'], ...(isWeb ? { textShadow: '0 0 28px rgba(111,221,178,0.45)' } : {}) },
  ticketDivider: { alignSelf: 'stretch', marginTop: 10, borderTopWidth: 2, borderTopColor: 'rgba(255,255,255,0.18)', borderStyle: 'dashed' },
  ticketFoot: { fontSize: 12, color: '#B8C7DD', marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999 },
  pillText: { fontSize: 14, fontWeight: '700' },

  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 140, padding: 16, borderRadius: 16, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: P.line, ...shadow },
  statValue: { fontSize: 28, fontWeight: '800', color: P.navy, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, color: Colors.slateMuted, marginTop: 2 },

  tip: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  tipText: { flex: 1, fontSize: 13, lineHeight: 19, color: '#334155' },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 14, borderRadius: 14 },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 14, borderWidth: 1, borderColor: P.line },
  optionHover: { backgroundColor: P.mintSoft },
  optionTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  secondaryBtn: { height: 40, paddingHorizontal: 16, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: P.teal, fontSize: 14, fontWeight: '700' },
  dangerBtn: { height: 40, paddingHorizontal: 16, borderRadius: 999, backgroundColor: Colors.errorText, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 14, borderRadius: 14, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: P.line },
  linkBtn: { alignSelf: 'center', paddingVertical: 6 },
  dangerLink: { fontSize: 14, fontWeight: '700', color: Colors.errorText },
  disabled: { opacity: 0.5 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
});

export default QueueTicketScreen;
