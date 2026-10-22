import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { formatCurrency } from '../utils/format';
import { usePatientInvoices } from '../controllers/usePatientInvoices';

// Bệnh nhân xem hóa đơn viện phí: tổng chi phí, BHYT chi trả, phần mình trả, từng dòng phí.
// Chỉ xem; thanh toán tại quầy thu ngân (thanh toán online UC-PAT-10 đang tạm gác).

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');
const STATUS = {
  'chờ thanh toán': { label: 'Chờ thanh toán', bg: Colors.warningBg, fg: Colors.warningText, icon: 'clock' },
  'đang xử lý': { label: 'Đang xử lý', bg: Colors.infoBg, fg: Colors.infoText, icon: 'loader' },
  'đã thanh toán': { label: 'Đã thanh toán', bg: Colors.successBg, fg: Colors.successText, icon: 'check-circle' },
  'hoàn trả': { label: 'Đã hoàn tiền', bg: Colors.infoBg, fg: Colors.infoText, icon: 'rotate-ccw' },
  'hủy': { label: 'Đã hủy', bg: Colors.background, fg: Colors.slateMuted, icon: 'x-circle' },
};
const METHOD = { 'tiền mặt': 'tiền mặt', 'chuyển khoản': 'chuyển khoản', vietqr: 'VietQR' };

const Money = ({ label, value, strong, tone }) => (
  <View style={styles.money}>
    <Text style={styles.moneyLabel}>{label}</Text>
    <Text style={[styles.moneyValue, strong && styles.moneyStrong, tone === 'ok' && styles.moneyOk]}>{formatCurrency(value)}</Text>
  </View>
);

const InvoiceCard = ({ inv }) => {
  const [open, setOpen] = useState(false);
  const st = STATUS[inv.status] || STATUS['chờ thanh toán'];
  const title = inv.visitReason ? `Lượt khám: ${inv.visitReason}` : 'Hóa đơn viện phí';
  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.grow}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.meta}>{[fmtDate(inv.visitDate || inv.createdAt), inv.hospitalName].filter(Boolean).join(', ')}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: st.bg }]}>
          <Feather name={st.icon} size={13} color={st.fg} />
          <Text style={[styles.badgeText, { color: st.fg }]}>{st.label}</Text>
        </View>
      </View>

      <View style={styles.moneys}>
        <Money label="Tổng chi phí" value={inv.totalAmount} />
        <Money label={inv.bhyt?.coverageRate ? `BHYT chi trả (${inv.bhyt.coverageRate}%)` : 'BHYT chi trả'} value={inv.insuranceAmount} tone={inv.insuranceAmount > 0 ? 'ok' : null} />
        <Money label={inv.status === 'đã thanh toán' ? 'Bạn đã trả' : 'Bạn cần trả'} value={inv.patientAmount} strong />
      </View>
      {inv.bhyt?.cardLast4 ? <Text style={styles.note}>Thẻ BHYT đuôi {inv.bhyt.cardLast4}.</Text> : null}
      {inv.status === 'đã thanh toán' && inv.paidAt ? (
        <Text style={styles.note}>Đã thanh toán lúc {fmtTime(inv.paidAt)}{METHOD[inv.paymentMethod] ? ` bằng ${METHOD[inv.paymentMethod]}` : ''}.</Text>
      ) : inv.status === 'chờ thanh toán' ? (
        <Text style={styles.note}>Vui lòng thanh toán tại quầy thu ngân của bệnh viện.</Text>
      ) : null}
      {inv.refund ? (
        <Text style={styles.note}>Đã hoàn {formatCurrency(inv.refund.amount)}{inv.refund.reason ? `: ${inv.refund.reason}` : ''}{inv.refund.at ? ` (${fmtDate(inv.refund.at)})` : ''}.</Text>
      ) : null}

      {inv.items.length ? (
        <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button" aria-expanded={open} hitSlop={6} style={styles.toggle}>
          <Text style={styles.toggleText}>{open ? 'Ẩn chi tiết' : `Xem ${inv.items.length} khoản phí`}</Text>
          <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={Colors.brandGreen} />
        </Pressable>
      ) : null}
      {open ? (
        <View style={styles.items}>
          {inv.items.map((it, i) => (
            <View key={i} style={styles.item}>
              <View style={styles.grow}>
                <Text style={styles.itemName}>{it.description}</Text>
                <Text style={styles.meta}>
                  {it.quantity > 1 ? `${it.quantity}${it.unit ? ` ${it.unit}` : ''} × ${formatCurrency(it.unitPrice)}. ` : ''}
                  {it.covered ? `BHYT trả ${formatCurrency(it.insuranceAmount)}, bạn trả ${formatCurrency(it.patientAmount)}` : 'Không thuộc BHYT'}
                </Text>
              </View>
              <Text style={styles.itemAmount}>{formatCurrency(it.amount)}</Text>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
};

const MyInvoicesScreen = ({ navigation }) => {
  const { loading, invoices, unpaidTotal, error, reload } = usePatientInvoices();

  let body;
  if (loading && !invoices.length) {
    body = <View style={styles.state}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.note}>Đang tải…</Text></View>;
  } else if (error && !invoices.length) {
    body = (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>{error}</Text>
        <Pressable onPress={reload} accessibilityRole="button" style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Thử lại</Text></Pressable>
      </View>
    );
  } else if (!invoices.length) {
    body = (
      <View style={styles.state}>
        <Feather name="file-text" size={28} color={Colors.slateMuted} />
        <Text style={styles.stateTitle}>Bạn chưa có hóa đơn nào.</Text>
        <Text style={styles.note}>Hóa đơn sẽ hiện ở đây sau khi lượt khám hoàn tất.</Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.stack}>
        {unpaidTotal > 0 ? (
          <View style={styles.summary} accessibilityRole="summary">
            <Feather name="alert-circle" size={18} color={Colors.warningText} />
            <View style={styles.grow}>
              <Text style={styles.summaryTitle}>Bạn còn {formatCurrency(unpaidTotal)} chưa thanh toán</Text>
              <Text style={styles.summaryText}>Thanh toán tại quầy thu ngân của bệnh viện bằng tiền mặt, chuyển khoản hoặc quét mã VietQR.</Text>
            </View>
          </View>
        ) : null}
        {invoices.map((inv) => <InvoiceCard key={inv._id} inv={inv} />)}
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MyInvoices">
      <View style={styles.container}>
        <PageHeader bar title="Hóa đơn viện phí" subtitle="Chi phí từng lượt khám, phần BHYT chi trả và phần bạn trả."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={reload} />} />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>{body}</PageContainer>
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
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' },
  title: { fontSize: 16, fontWeight: '700', color: Colors.brandNavy },
  meta: { fontSize: 13, lineHeight: 18, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  moneys: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  money: { flexGrow: 1, flexBasis: 150, padding: 12, borderRadius: 10, backgroundColor: Colors.background, gap: 2 },
  moneyLabel: { fontSize: 13, color: Colors.slateMuted },
  moneyValue: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  moneyStrong: { fontSize: 18, fontWeight: '800', color: Colors.brandNavy },
  moneyOk: { color: Colors.successText },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  toggle: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 36 },
  toggleText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  items: { borderTopWidth: 1, borderTopColor: Colors.border },
  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: Colors.border },
  itemName: { fontSize: 15, color: Colors.slateDark },
  itemAmount: { fontSize: 15, fontWeight: '600', color: Colors.slateDark, fontVariant: ['tabular-nums'] },
  summary: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 12, backgroundColor: Colors.warningBg },
  summaryTitle: { fontSize: 16, fontWeight: '700', color: Colors.warningText },
  summaryText: { fontSize: 14, lineHeight: 20, color: Colors.slateDark, marginTop: 2 },
  state: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 16 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
  secondaryBtn: { height: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
});

export default MyInvoicesScreen;
