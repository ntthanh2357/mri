import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useAppDialog } from '../components/ui/AppDialog';
import { get, post } from '../services/api.service';

// Y lệnh miệng đang chờ tôi xử lý: điều dưỡng xác nhận đọc lại, bác sĩ ra lệnh ký bổ sung trong 24 giờ.

const WITNESS_ROLES = ['nurse', 'doctor', 'department_head', 'radiologist', 'pharmacist'];
const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '—');

const STATUS_LABELS = {
  pending_readback: 'Chờ điều dưỡng đọc lại',
  readback_confirmed: 'Đã đọc lại, chờ ký bổ sung',
};

const VerbalOrdersScreen = ({ navigation }) => {
  const { dialog, confirm, notify } = useAppDialog();
  const [me, setMe] = useState(null);
  const [orders, setOrders] = useState([]);
  const [staff, setStaff] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rejecting, setRejecting] = useState(null);
  const [rejectReason, setRejectReason] = useState('');
  const [witnessByOrder, setWitnessByOrder] = useState({});
  const [otpFor, setOtpFor] = useState(null);
  const [otpCode, setOtpCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await get('/api/v1/emergency/verbal-orders/my-pending');
      setOrders(res?.data || []);
    } catch (err) {
      notify('Không tải được danh sách', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    get('/auth/me').then((res) => setMe(res?.user || null)).catch(() => {});
    get('/api/v1/hospital/staff').then((res) => setStaff(res?.staff || [])).catch(() => {});
  }, []);

  const isNurse = me?.role === 'nurse';
  const myId = String(me?._id || me?.id || '');

  const run = async (order, action, successTitle) => {
    setBusyId(order._id);
    try {
      await action();
      notify(successTitle, 'Đã ghi nhận và lưu vết kiểm toán.', 'success');
      await load();
    } catch (err) {
      notify('Chưa thực hiện được', err.message || 'Vui lòng thử lại.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const confirmReadBack = async (order) => {
    const ok = await confirm({
      title: 'Xác nhận đã đọc lại y lệnh',
      message: `"${order.orderText}"`,
      note: 'Chỉ xác nhận khi bạn đã đọc lại đúng nội dung này cho bác sĩ ra lệnh và bác sĩ đã xác nhận.',
      confirmText: 'Đã đọc lại, khớp nội dung',
      type: 'info',
    });
    if (!ok) return;
    await run(order, () => post(`/api/v1/emergency/verbal-order/${order._id}/readback-confirm`, {}), 'Đã xác nhận đọc lại');
  };

  const submitOtp = async (order) => {
    if (!otpCode.trim()) {
      notify('Thiếu mã', 'Vui lòng nhập mã OTP trong email.', 'error');
      return;
    }
    await run(order, () => post(`/api/v1/emergency/verbal-order/${order._id}/readback-otp`, { otpCode: otpCode.trim() }), 'Đã xác nhận đọc lại');
    setOtpFor(null);
    setOtpCode('');
  };

  const submitReject = async (order) => {
    if (rejectReason.trim().length < 5) {
      notify('Thiếu lý do', 'Vui lòng ghi lý do, tối thiểu 5 ký tự.', 'error');
      return;
    }
    await run(order, () => post(`/api/v1/emergency/verbal-order/${order._id}/reject`, { reason: rejectReason.trim() }), 'Đã từ chối y lệnh');
    setRejecting(null);
    setRejectReason('');
  };

  const countersign = async (order) => {
    const witnessUserId = witnessByOrder[order._id];
    if (order.isControlledSubstance && !witnessUserId) {
      notify('Thiếu người chứng kiến', 'Y lệnh thuốc gây nghiện, hướng thần cần chọn nhân viên y tế chứng kiến.', 'error');
      return;
    }
    await run(order, () => post(`/api/v1/emergency/verbal-order/${order._id}/countersign`, { witnessUserId }), 'Đã ký bổ sung');
  };

  const witnesses = staff.filter((s) => WITNESS_ROLES.includes(s.role) && !s.isLocked && String(s._id) !== myId);

  const renderOrder = (order) => {
    const busy = busyId === order._id;
    const isRejecting = rejecting === order._id;
    const overdue = Boolean(order.overdueAt);
    const escalated = Boolean(order.escalatedReadBackAt);
    return (
      <View key={order._id} style={[styles.card, overdue && styles.cardAlert]}>
        <View style={styles.cardHead}>
          <Text style={styles.patient}>{order.patientName || 'Bệnh nhân'}</Text>
          <Text style={[styles.status, overdue && styles.statusAlert]}>
            {overdue ? 'Quá hạn ký bổ sung' : escalated ? 'Quá 15 phút chưa đọc lại' : STATUS_LABELS[order.status]}
          </Text>
        </View>
        <Text style={styles.orderText}>{order.orderText}</Text>
        {order.isControlledSubstance ? <Text style={styles.controlled}>Thuốc gây nghiện, hướng thần</Text> : null}
        <Text style={styles.meta}>
          BS ra lệnh: {order.prescribedByDoctorName || '—'} · Lúc {fmtTime(order.prescribedAt)} · Điều dưỡng nhận: {order.nurseReceivedName || '—'} · Hạn ký: {fmtTime(order.countersignDeadline)}
        </Text>

        {!isNurse && order.status === 'readback_confirmed' && order.isControlledSubstance ? (
          <View style={styles.witnessBox}>
            <Text style={styles.label}>Người chứng kiến</Text>
            <View style={styles.chips}>
              {witnesses.map((w) => {
                const active = witnessByOrder[order._id] === w._id;
                return (
                  <Pressable
                    key={w._id}
                    onPress={() => setWitnessByOrder((prev) => ({ ...prev, [order._id]: w._id }))}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    style={[styles.chip, active && styles.chipOn]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextOn]}>{w.profile?.name || w.email}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ) : null}

        {otpFor === order._id ? (
          <View style={styles.rejectBox}>
            <TextInput
              style={styles.input}
              placeholder="Mã OTP 6 số trong email"
              placeholderTextColor={Colors.secondary}
              keyboardType="number-pad"
              maxLength={6}
              value={otpCode}
              onChangeText={setOtpCode}
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => submitOtp(order)}>
                <Text style={styles.btnText}>Xác nhận bằng mã OTP</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setOtpFor(null); setOtpCode(''); }}>
                <Text style={styles.btnGhostText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : isRejecting ? (
          <View style={styles.rejectBox}>
            <TextInput
              style={styles.input}
              placeholder={isNurse ? 'Vì sao nội dung đọc lại không khớp?' : 'Vì sao thu hồi y lệnh?'}
              placeholderTextColor={Colors.secondary}
              value={rejectReason}
              onChangeText={setRejectReason}
            />
            <View style={styles.actions}>
              <Pressable style={[styles.btn, styles.btnDanger]} disabled={busy} onPress={() => submitReject(order)}>
                <Text style={styles.btnText}>Xác nhận từ chối</Text>
              </Pressable>
              <Pressable style={[styles.btn, styles.btnGhost]} onPress={() => { setRejecting(null); setRejectReason(''); }}>
                <Text style={styles.btnGhostText}>Hủy</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            {isNurse ? (
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => confirmReadBack(order)}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Đã đọc lại, khớp nội dung</Text>}
              </Pressable>
            ) : null}
            {isNurse ? (
              <Pressable style={[styles.btn, styles.btnGhost]} disabled={busy} onPress={() => { setOtpFor(order._id); setOtpCode(''); }}>
                <Text style={styles.btnGhostText}>Dùng mã OTP email</Text>
              </Pressable>
            ) : null}
            {!isNurse && order.status === 'readback_confirmed' ? (
              <Pressable style={[styles.btn, styles.btnPrimary]} disabled={busy} onPress={() => countersign(order)}>
                {busy ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.btnText}>Ký bổ sung y lệnh</Text>}
              </Pressable>
            ) : null}
            {order.status === 'pending_readback' ? (
              <Pressable style={[styles.btn, styles.btnGhost]} disabled={busy} onPress={() => { setRejecting(order._id); setRejectReason(''); }}>
                <Text style={styles.btnGhostText}>{isNurse ? 'Không khớp, từ chối' : 'Thu hồi y lệnh'}</Text>
              </Pressable>
            ) : null}
          </View>
        )}
      </View>
    );
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="VerbalOrders">
      <View style={styles.root}>
        <PageHeader
          bar
          title="Y lệnh miệng chờ xử lý"
          subtitle={isNurse
            ? 'Trong cấp cứu bạn có thể thực hiện thuốc trước, rồi xác nhận đọc lại tại đây.'
            : 'Y lệnh của bạn: theo dõi đọc lại và ký bổ sung trong 24 giờ.'}
          actions={<HeaderAction icon="refresh-cw" label="Tải lại" onPress={load} />}
        />
        <ScrollView>
          <PageContainer style={styles.page}>
            {loading ? (
              <ActivityIndicator color={Colors.brandGreen} />
            ) : orders.length === 0 ? (
              <Text style={styles.empty}>Không có y lệnh miệng nào đang chờ bạn xử lý.</Text>
            ) : (
              orders.map(renderOrder)
            )}
          </PageContainer>
        </ScrollView>
      </View>
      {dialog}
    </ResponsiveLayout>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1 },
  page: { gap: 12, paddingVertical: 16 },
  empty: { color: Colors.secondary, fontSize: 14, textAlign: 'center', paddingVertical: 32 },
  card: { backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: Colors.border, borderRadius: 10, padding: 14, gap: 8 },
  cardAlert: { borderColor: '#DC2626' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 6 },
  patient: { fontSize: 14, fontWeight: '700', color: Colors.brandNavy },
  status: { fontSize: 12, fontWeight: '600', color: Colors.brandGreenPressed },
  statusAlert: { color: '#B91C1C' },
  orderText: { fontSize: 15, color: '#0F172A', lineHeight: 22 },
  controlled: { fontSize: 12, fontWeight: '700', color: '#B45309' },
  meta: { fontSize: 12, color: Colors.secondary, lineHeight: 18 },
  witnessBox: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', color: '#334155' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: Colors.borderStrong, minHeight: 32 },
  chipOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipText: { fontSize: 12, color: '#334155' },
  chipTextOn: { color: '#FFFFFF', fontWeight: '600' },
  rejectBox: { gap: 8 },
  input: { borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#0F172A' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  btn: { minHeight: 38, paddingHorizontal: 14, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnDanger: { backgroundColor: '#B91C1C' },
  btnGhost: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: '#FFFFFF' },
  btnText: { color: '#FFFFFF', fontSize: 13, fontWeight: '700' },
  btnGhostText: { color: '#334155', fontSize: 13, fontWeight: '600' },
});

export default VerbalOrdersScreen;
