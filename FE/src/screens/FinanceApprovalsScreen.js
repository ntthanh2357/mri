import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, Modal, Switch, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post, put } from '../services/api.service';

// Duyệt hoàn tiền 2 bước, bảo lãnh viện phí và chính sách của viện.
// Lễ tân chỉ thấy phần hoàn tiền; bảo lãnh và chính sách thuộc Ban Giám đốc.

const money = (value) => `${Math.round(Number(value) || 0).toLocaleString('vi-VN')}đ`;
const personName = (person) => person?.profile?.name || person?.profile?.fullName || person?.email || '—';
const ADMIN_THRESHOLD = 50_000_000;

const FinanceApprovalsScreen = ({ navigation }) => {
  const { dialog, notify } = useAppDialog();
  const [me, setMe] = useState(null);
  const [tab, setTab] = useState('refunds');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);

  const [refunds, setRefunds] = useState([]);
  const [activeForm, setActiveForm] = useState(null); // { id, kind: 'reject' | 'review' | 'debt' }
  const [formText, setFormText] = useState('');
  const [debtLimit, setDebtLimit] = useState('');

  const [candidates, setCandidates] = useState([]);
  const [policy, setPolicy] = useState(null);
  const [thresholdText, setThresholdText] = useState('0');
  const [savingPolicy, setSavingPolicy] = useState(false);

  const [stuck, setStuck] = useState([]);
  const [stepUpFor, setStepUpFor] = useState(null);
  const [otp, setOtp] = useState('');
  const [stepUpBusy, setStepUpBusy] = useState(false);

  const isAdmin = me?.role === 'hospital_admin';
  const isPharmacist = me?.role === 'pharmacist';
  const canResolveStuck = isAdmin || isPharmacist;
  const myId = String(me?._id || me?.id || '');

  const loadRefunds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/invoices/refund-requests/pending');
      setRefunds(res?.requests || []);
    } catch (err) {
      notify('Không tải được danh sách', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  const loadAdminData = useCallback(async () => {
    try {
      const [debt, policies] = await Promise.all([
        get('/api/v1/visits/debt-candidates'),
        get('/admin/hospital-policies'),
      ]);
      setCandidates(debt?.data || []);
      setPolicy(policies?.data || null);
      setThresholdText(String(policies?.data?.partialPaymentDebtThreshold ?? 0));
    } catch (err) {
      notify('Không tải được dữ liệu quản trị', err.message || 'Vui lòng thử lại.', 'error');
    }
  }, [notify]);

  const loadStuck = useCallback(async () => {
    try {
      const res = await get('/api/v1/invoices/stuck-processing');
      setStuck(res?.invoices || []);
    } catch (err) {
      notify('Không tải được hóa đơn kẹt', err.message || 'Vui lòng thử lại.', 'error');
    }
  }, [notify]);

  useEffect(() => {
    get('/auth/me').then((res) => {
      setMe(res?.user || null);
      if (res?.user?.role === 'pharmacist') setTab('stuck');
    }).catch(() => {});
  }, []);

  useFocusEffect(useCallback(() => {
    if (!me) return;
    if (!isPharmacist) loadRefunds();
    loadStuck();
  }, [me, isPharmacist, loadRefunds, loadStuck]));

  useEffect(() => {
    if (isAdmin) loadAdminData();
  }, [isAdmin, loadAdminData]);

  const closeForm = () => { setActiveForm(null); setFormText(''); setDebtLimit(''); };

  const requestStepUp = async (invoice) => {
    setStepUpFor(invoice);
    setOtp('');
    try {
      const res = await post('/auth/step-up/request', {});
      if (res?.debugOtp) setOtp(res.debugOtp);
    } catch (err) {
      // 429: mã gửi trước đó còn dùng được, vẫn cho nhập
      if (err.status !== 429) notify('Không gửi được mã', err.message || 'Vui lòng thử lại.', 'error');
    }
  };

  const approve = async (invoice) => {
    setBusyId(invoice._id);
    try {
      const res = await post(`/api/v1/invoices/${invoice._id}/refund/approve`, {});
      notify('Đã duyệt hoàn tiền', `Đã hoàn ${money(res?.data?.refundedAmount)} cho bệnh nhân.`, 'success');
      await loadRefunds();
    } catch (err) {
      if (err.code === 'STEP_UP_REQUIRED') {
        await requestStepUp(invoice);
      } else {
        notify('Chưa duyệt được', err.message || 'Vui lòng thử lại.', 'error');
        await loadRefunds();
      }
    } finally {
      setBusyId(null);
    }
  };

  const submitStepUp = async () => {
    if (!otp.trim()) return;
    setStepUpBusy(true);
    try {
      await post('/auth/step-up/verify', { otp: otp.trim() });
      const invoice = stepUpFor;
      setStepUpFor(null);
      setOtp('');
      await approve(invoice);
    } catch (err) {
      notify('Mã chưa đúng', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setStepUpBusy(false);
    }
  };

  const submitReject = async (invoice) => {
    setBusyId(invoice._id);
    try {
      await post(`/api/v1/invoices/${invoice._id}/refund/reject`, { rejectReason: formText.trim() || undefined });
      notify('Đã từ chối', 'Yêu cầu hoàn tiền đã được từ chối.', 'success');
      closeForm();
      await loadRefunds();
    } catch (err) {
      notify('Chưa từ chối được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitReview = async (invoice) => {
    setBusyId(invoice._id);
    try {
      await put(`/api/v1/invoices/${invoice._id}/refund/large-review`, { note: formText.trim() });
      notify('Đã ghi nhận', 'Khoản hoàn đã được kiểm tra. Một Ban Giám đốc khác có thể phê duyệt.', 'success');
      closeForm();
      await loadRefunds();
    } catch (err) {
      notify('Chưa ghi nhận được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const submitDebt = async (visit) => {
    setBusyId(visit._id);
    try {
      await post(`/api/v1/visits/${visit._id}/debt-approval`, { reason: formText.trim(), maxAmount: Number(debtLimit) });
      notify('Đã bảo lãnh', 'Ca chụp được qua cổng viện phí trong 48 giờ và trong hạn mức đã duyệt.', 'success');
      closeForm();
      await loadAdminData();
    } catch (err) {
      notify('Chưa bảo lãnh được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const savePolicy = async (changes) => {
    setSavingPolicy(true);
    try {
      const res = await put('/admin/hospital-policies', changes);
      setPolicy((prev) => ({ ...prev, ...res?.data }));
      setThresholdText(String(res?.data?.partialPaymentDebtThreshold ?? 0));
      notify('Đã lưu', 'Đã cập nhật chính sách bệnh viện.', 'success');
    } catch (err) {
      notify('Chưa lưu được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setSavingPolicy(false);
    }
  };

  const resolveStuck = async (invoice, action) => {
    setBusyId(invoice._id);
    try {
      const res = await post(`/api/v1/invoices/${invoice._id}/resolve-processing`, { action, note: formText.trim() || undefined });
      notify('Đã xử lý', res?.message || 'Đã xử lý hóa đơn.', 'success');
      closeForm();
      await loadStuck();
    } catch (err) {
      notify('Chưa xử lý được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const renderStuck = (invoice) => {
    const busy = busyId === invoice._id;
    const form = activeForm?.id === invoice._id;
    return (
      <View key={invoice._id} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.title}>{personName(invoice.patientId)}</Text>
          <Text style={styles.amount}>{money(invoice.patientPayAmount ?? invoice.totalAmount)}</Text>
        </View>
        <Text style={styles.meta}>Tiền đã về nhưng chưa trừ được kho thuốc.</Text>
        {invoice.dispenseWarning ? <Text style={styles.warn}>{invoice.dispenseWarning}</Text> : null}
        {canResolveStuck ? (
          form ? (
            <View style={styles.formBox}>
              <TextInput style={styles.input} placeholder="Ghi chú xử lý" placeholderTextColor={Colors.secondary} value={formText} onChangeText={setFormText} />
              <View style={styles.actions}>
                <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => resolveStuck(invoice, activeForm.kind)}>
                  <Text style={styles.btnText}>{activeForm.kind === 'retry_deduct' ? 'Trừ kho lại' : 'Hủy và hoàn tiền'}</Text>
                </Pressable>
                <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeForm}>
                  <Text style={styles.btnGhostText}>Hủy</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { setFormText(''); setActiveForm({ id: invoice._id, kind: 'retry_deduct' }); }}>
                <Text style={styles.btnText}>Đã nhập thêm thuốc, trừ kho lại</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setFormText(''); setActiveForm({ id: invoice._id, kind: 'cancel_refund' }); }}>
                <Text style={styles.btnGhostText}>Hủy đơn và hoàn tiền</Text>
              </Pressable>
            </View>
          )
        ) : <Text style={styles.meta}>Dược sĩ hoặc Ban Giám đốc sẽ xử lý hóa đơn này.</Text>}
      </View>
    );
  };

  const renderRefund = (invoice) => {
    const approval = invoice.refundApproval || {};
    const review = invoice.largeRefundReview || {};
    const amount = approval.requestedAmount || invoice.totalAmount;
    const makerId = String(approval.firstApproverId?._id || approval.firstApproverId || '');
    const isMaker = makerId === myId;
    const needsAdmin = amount >= ADMIN_THRESHOLD;
    const canDecide = !isMaker && (isAdmin || !needsAdmin);
    const reviewPending = review.required && !review.reviewedBy;
    const isReviewer = String(review.reviewedBy || '') === myId;
    const busy = busyId === invoice._id;
    const form = activeForm?.id === invoice._id ? activeForm.kind : null;

    return (
      <View key={invoice._id} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.title}>{personName(invoice.patientId)}</Text>
          <Text style={styles.amount}>{money(amount)}</Text>
        </View>
        <Text style={styles.meta}>Lý do: {approval.requestedReason || '—'}</Text>
        <Text style={styles.meta}>Người lập: {personName(approval.firstApproverId)}{isMaker ? ' (bạn)' : ''}</Text>
        {needsAdmin ? <Text style={styles.meta}>Cần Ban Giám đốc phê duyệt.</Text> : null}
        {review.required ? (
          <Text style={[styles.meta, reviewPending && styles.warn]}>
            {reviewPending
              ? 'Khoản từ 300 triệu đồng: cần một Ban Giám đốc khác kiểm tra trước khi duyệt.'
              : `Đã kiểm tra bởi ${review.reviewedByName || '—'}: ${review.note || ''}`}
          </Text>
        ) : null}
        {isMaker ? <Text style={styles.warn}>Bạn là người lập nên không được tự duyệt.</Text> : null}

        {form ? (
          <View style={styles.formBox}>
            <TextInput
              style={styles.input}
              placeholder={form === 'review' ? 'Nội dung đã kiểm tra (tối thiểu 10 ký tự)' : 'Lý do từ chối'}
              placeholderTextColor={Colors.secondary}
              value={formText}
              onChangeText={setFormText}
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, form === 'review' ? styles.btnPrimary : styles.btnDanger]} disabled={busy}
                onPress={() => (form === 'review' ? submitReview(invoice) : submitReject(invoice))}>
                <Text style={styles.btnText}>{form === 'review' ? 'Ghi nhận kiểm tra' : 'Xác nhận từ chối'}</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeForm}>
                <Text style={styles.btnGhostText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            {canDecide && !reviewPending && !isReviewer ? (
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => approve(invoice)}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Duyệt hoàn tiền</Text>}
              </Pressable>
            ) : null}
            {isAdmin && !isMaker && reviewPending ? (
              <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => { setFormText(''); setActiveForm({ id: invoice._id, kind: 'review' }); }}>
                <Text style={styles.btnText}>Kiểm tra khoản hoàn lớn</Text>
              </Pressable>
            ) : null}
            {canDecide ? (
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setFormText(''); setActiveForm({ id: invoice._id, kind: 'reject' }); }}>
                <Text style={styles.btnGhostText}>Từ chối</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  const renderDebt = (visit) => {
    const form = activeForm?.id === visit._id;
    const busy = busyId === visit._id;
    return (
      <View key={visit._id} style={styles.card}>
        <View style={styles.cardHead}>
          <Text style={styles.title}>{visit.patientName}</Text>
          <Text style={styles.amount}>{money(visit.remainingOwed)}</Text>
        </View>
        <Text style={styles.meta}>Trạng thái hóa đơn: {visit.invoiceStatus} · Lượt khám: {visit.status}</Text>
        {form ? (
          <View style={styles.formBox}>
            <TextInput style={styles.input} keyboardType="numeric" placeholder="Hạn mức bảo lãnh (đồng)" placeholderTextColor={Colors.secondary} value={debtLimit} onChangeText={setDebtLimit} />
            <TextInput style={styles.input} placeholder="Lý do bảo lãnh (tối thiểu 10 ký tự)" placeholderTextColor={Colors.secondary} value={formText} onChangeText={setFormText} />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => submitDebt(visit)}>
                <Text style={styles.btnText}>Phê duyệt bảo lãnh</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={closeForm}>
                <Text style={styles.btnGhostText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Pressable style={[styles.btn, styles.btnPrimary]}
              onPress={() => { setFormText(''); setDebtLimit(String(visit.remainingOwed || '')); setActiveForm({ id: visit._id, kind: 'debt' }); }}>
              <Text style={styles.btnText}>Bảo lãnh viện phí</Text>
            </Pressable>
          </View>
        )}
      </View>
    );
  };

  const renderPolicy = () => (
    <View style={styles.card}>
      <Text style={styles.title}>Nợ tối đa khi đã thanh toán một phần</Text>
      <Text style={styles.meta}>Số tiền còn nợ tối đa để vẫn được vào chụp. Đặt 0 nếu bệnh nhân phải trả đủ. Đây là quy định riêng của viện.</Text>
      <TextInput style={styles.input} keyboardType="numeric" value={thresholdText} onChangeText={setThresholdText} accessibilityLabel="Ngưỡng nợ" />
      <View style={styles.actions}>
        <Pressable style={[styles.btn, styles.btnPrimary]} disabled={savingPolicy} onPress={() => savePolicy({ partialPaymentDebtThreshold: Number(thresholdText) })}>
          <Text style={styles.btnText}>Lưu ngưỡng nợ</Text>
        </Pressable>
      </View>

      <View style={styles.divider} />
      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>Bác sĩ chỉ định được ký kết quả CĐHA</Text>
          <Text style={styles.meta}>
            Chỉ áp dụng khi viện không có Bác sĩ CĐHA (NĐ 96/2023 Điều 40). Hiện viện có {policy?.radiologistCount ?? 0} Bác sĩ CĐHA
            {policy?.radiologistCount > 0 ? ', nên ngoại lệ này chưa có hiệu lực.' : '.'}
          </Text>
        </View>
        <Switch
          value={policy?.allowOrderingDoctorSign === true}
          disabled={savingPolicy}
          onValueChange={(value) => savePolicy({ allowOrderingDoctorSign: value })}
          accessibilityLabel="Cho phép bác sĩ chỉ định ký kết quả CĐHA"
        />
      </View>
    </View>
  );

  const TABS = [
    ...(isPharmacist ? [] : [{ key: 'refunds', label: `Hoàn tiền (${refunds.length})` }]),
    { key: 'stuck', label: `Hóa đơn kẹt (${stuck.length})` },
    ...(isAdmin ? [{ key: 'debt', label: `Bảo lãnh viện phí (${candidates.length})` }, { key: 'policy', label: 'Chính sách viện' }] : []),
  ];

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="FinanceApprovals">
      <View style={styles.root}>
        <PageHeader
          bar
          title="Duyệt hoàn tiền và bảo lãnh"
          subtitle="Khoản từ 10 triệu đồng cần người thứ hai duyệt, từ 50 triệu đồng cần Ban Giám đốc."
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={() => { if (!isPharmacist) loadRefunds(); loadStuck(); if (isAdmin) loadAdminData(); }} />}
          below={(
            <View style={styles.tabs} accessibilityRole="tablist">
              {TABS.map((t) => (
                <Pressable key={t.key} onPress={() => { closeForm(); setTab(t.key); }} accessibilityRole="tab" accessibilityState={{ selected: tab === t.key }}
                  style={[styles.tab, tab === t.key && styles.tabOn]}>
                  <Text style={[styles.tabText, tab === t.key && styles.tabTextOn]}>{t.label}</Text>
                </Pressable>
              ))}
            </View>
          )}
        />
        <ScrollView>
          <PageContainer style={styles.page}>
            {tab === 'refunds' ? (
              loading ? <ActivityIndicator color={Colors.brandGreen} />
                : refunds.length === 0 ? <Text style={styles.empty}>Không có yêu cầu hoàn tiền nào đang chờ duyệt.</Text>
                  : refunds.map(renderRefund)
            ) : null}
            {tab === 'stuck' ? (
              stuck.length === 0 ? <Text style={styles.empty}>Không có hóa đơn nào bị kẹt.</Text> : stuck.map(renderStuck)
            ) : null}
            {tab === 'debt' ? (
              candidates.length === 0 ? <Text style={styles.empty}>Không có ca chụp nào đang bị chặn vì chưa thanh toán.</Text>
                : candidates.map(renderDebt)
            ) : null}
            {tab === 'policy' ? renderPolicy() : null}
          </PageContainer>
        </ScrollView>
      </View>

      <Modal visible={Boolean(stepUpFor)} transparent animationType="fade" onRequestClose={() => setStepUpFor(null)}>
        <View style={styles.overlay}>
          <View style={styles.dialogBox}>
            <Text style={styles.title}>Xác thực bước 2</Text>
            <Text style={styles.meta}>Nhập mã OTP vừa gửi tới email của bạn. Mã xác thực có hiệu lực duyệt trong 5 phút.</Text>
            <TextInput style={styles.input} keyboardType="number-pad" maxLength={6} placeholder="Mã 6 số" placeholderTextColor={Colors.secondary} value={otp} onChangeText={setOtp} accessibilityLabel="Mã OTP" />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={stepUpBusy || !otp.trim()} onPress={submitStepUp}>
                {stepUpBusy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Xác thực và duyệt</Text>}
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => setStepUpFor(null)}>
                <Text style={styles.btnGhostText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
      {dialog}
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { gap: 12, paddingVertical: 16 },
  empty: { color: Colors.secondary, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  tabs: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tab: { minHeight: 34, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 6, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF' },
  tabOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  tabText: { fontSize: 13, color: '#334155' },
  tabTextOn: { color: '#FFFFFF', fontWeight: '600' },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, gap: 8 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  title: { fontSize: 14, fontWeight: '700', color: Colors.brandNavy },
  amount: { fontSize: 15, fontWeight: '700', color: '#0F172A', fontVariant: ['tabular-nums'] },
  meta: { fontSize: 12, color: Colors.secondary, lineHeight: 18 },
  warn: { fontSize: 12, color: '#B45309', fontWeight: '600', lineHeight: 18 },
  formBox: { gap: 8 },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#0F172A' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnDanger: { backgroundColor: '#B91C1C' },
  btnGhost: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF' },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnGhostText: { color: '#334155', fontSize: 13, fontWeight: '600' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 6 },
  switchRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  overlay: { flex: 1, backgroundColor: 'rgba(15,23,42,0.5)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  dialogBox: { width: '100%', maxWidth: 420, backgroundColor: '#FFFFFF', borderRadius: 12, padding: 18, gap: 10 },
});

export default FinanceApprovalsScreen;
