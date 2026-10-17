import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useQueueTicket } from '../controllers/useQueueTicket';

// UC-PAT-03 — Lấy số tiếp đón online trong ngày; theo dõi số đang gọi và giờ dự kiến tới lượt.

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

const Stat = ({ label, value }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

const QueueTicketScreen = ({ navigation }) => {
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

  const renderBody = () => {
    if (loading && !data) return <View style={styles.stateBox}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.note}>Đang tải…</Text></View>;
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
              <Feather name="home" size={16} color={Colors.brandGreen} />
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
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lấy số tiếp đón hôm nay</Text>
            <Text style={styles.note}>Lấy số trước ở nhà, theo dõi số đang gọi và tới bệnh viện đúng lúc. Số chỉ dùng trong hôm nay.</Text>
            <View style={styles.stats}>
              <Stat label="số đang gọi" value={data?.current || '—'} />
              <Stat label="người đang chờ" value={data?.waiting ?? 0} />
            </View>
            <Pressable onPress={() => run(take)} disabled={busy} accessibilityRole="button"
              style={({ hovered }) => [styles.primaryBtn, hovered && styles.primaryBtnHover, busy && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Lấy số</Text>}
            </Pressable>
          </View>
        </View>
      );
    }

    const tone = TONE[status.tone];
    return (
      <View style={styles.stack}>
        <View style={[styles.ticket, ticket.status === 'called' && styles.ticketCalled]}>
          <Text style={styles.ticketLabel}>Số của bạn</Text>
          <Text style={styles.ticketNumber} accessibilityLabel={`Số của bạn ${ticket.number}`}>{ticket.number}</Text>
          <View style={[styles.pill, { backgroundColor: tone.bg }]}>
            <Feather name={status.icon} size={14} color={tone.fg} />
            <Text style={[styles.pillText, { color: tone.fg }]}>{status.label}</Text>
          </View>
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

        <View style={styles.card}>
          <View style={styles.stats}>
            <Stat label="số đang gọi" value={data.current || '—'} />
            {data.ahead !== null && data.ahead !== undefined ? <Stat label="người phía trước" value={data.ahead} /> : null}
            {data.estimatedAt && ticket.status !== 'called' ? <Stat label="dự kiến tới lượt" value={`~${fmtTime(data.estimatedAt)}`} /> : null}
          </View>
          {data.estimatedAt && ['waiting', 'arrived'].includes(ticket.status) ? (
            <Text style={styles.note}>
              Nên có mặt trước khoảng {fmtTime(data.estimatedAt)}. Nếu tới muộn bị gọi qua lượt, số vẫn được giữ: báo lễ tân số của bạn để được gọi ngay tiếp theo.
              Giờ dự kiến chỉ là ước tính, có thể sớm hoặc muộn hơn.
            </Text>
          ) : null}
          <Text style={styles.hint}>Tự cập nhật mỗi 30 giây.</Text>
        </View>

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
      <View style={styles.container}>
        <PageHeader bar title="Lấy số khám" subtitle="Lấy số tiếp đón online và theo dõi lượt gọi trong ngày."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={reload} />} />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>
            {msg && !msg.ok ? (
              <View style={[styles.banner, styles.msg, { backgroundColor: Colors.warningBg }]} accessibilityLiveRegion="polite">
                <Feather name="alert-circle" size={16} color={Colors.warningText} />
                <Text style={[styles.bannerText, { color: Colors.warningText }]}>{msg.message}</Text>
              </View>
            ) : null}
            {renderBody()}
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
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 12 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  hint: { fontSize: 13, color: Colors.slateMuted },
  ticket: { alignItems: 'center', gap: 6, paddingVertical: 28, paddingHorizontal: 18, borderRadius: 20, backgroundColor: Colors.brandNavy },
  ticketCalled: { backgroundColor: Colors.brandGreen },
  ticketLabel: { fontSize: 15, color: Colors.brandMint, fontWeight: '600' },
  ticketNumber: { fontSize: 72, lineHeight: 80, fontWeight: '800', color: '#FFFFFF', fontVariant: ['tabular-nums'] },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8 },
  pillText: { fontSize: 14, fontWeight: '600' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  stat: { flexGrow: 1, flexBasis: 110, padding: 12, borderRadius: 10, backgroundColor: Colors.background },
  statValue: { fontSize: 24, fontWeight: '700', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  statLabel: { fontSize: 13, color: Colors.slateMuted, marginTop: 2 },
  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10 },
  bannerText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600' },
  msg: { marginBottom: 16 },
  option: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.border },
  optionHover: { backgroundColor: Colors.brandGreenSoft },
  optionTitle: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  primaryBtn: { height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 14, fontWeight: '600' },
  dangerBtn: { height: 40, paddingHorizontal: 14, borderRadius: 10, backgroundColor: Colors.errorText, alignItems: 'center', justifyContent: 'center' },
  dangerBtnText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  confirmRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border },
  linkBtn: { alignSelf: 'center', paddingVertical: 6 },
  dangerLink: { fontSize: 14, fontWeight: '600', color: Colors.errorText },
  disabled: { opacity: 0.5 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
});

export default QueueTicketScreen;
