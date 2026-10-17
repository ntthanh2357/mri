import React, { useEffect, useState } from 'react';
import { Modal, View, Text, TextInput, Pressable, ScrollView, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import SignatureView from '../SignatureView';
import { post } from '../../services/api.service';
import { consentStatus } from '../../utils/signature';

// UC-PAT-06 — bác sĩ/KTV xem phiếu đồng thuận cản quang bệnh nhân đã trả lời/ký trên app.
// Nguy cơ cao: chỉ bác sĩ được cho phép tiêm, bắt buộc ghi lý do (BE: POST /api/v1/contrast-consents/:id/override).

const TONE = {
  ok: { bg: Colors.successBg, fg: Colors.successText },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
};
const ALLERGY = { yes: 'Có', no: 'Không', unknown: 'Không rõ' };
const RISK = { low: 'Thấp', moderate: 'Trung bình', high: 'Cao' };
const yesNo = (v) => (v ? 'Có' : 'Không');

const Row = ({ label, value, alert }) => (
  <View style={styles.row}>
    <Text style={styles.rowLabel}>{label}</Text>
    <Text style={[styles.rowValue, alert && styles.rowAlert]}>{value}</Text>
  </View>
);

const ContrastConsentReview = ({ visible, onClose, consent, patientName, canOverride, onChanged }) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { if (visible) { setReason(''); setError(''); } }, [visible]);

  const status = consentStatus(consent || {});
  const c = consent?.allergyChecklist || {};
  const answered = Boolean(consent?.patientChecklistAt);

  const override = async () => {
    setSaving(true);
    setError('');
    try {
      await post(`/api/v1/contrast-consents/${consent._id}/override`, { overrideReason: reason.trim() });
      onChanged?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Không lưu được, vui lòng thử lại.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.box}>
          <View style={styles.head}>
            <View style={styles.grow}>
              <Text style={styles.title}>Phiếu đồng thuận tiêm cản quang</Text>
              <Text style={styles.sub}>{patientName}</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={10}>
              <Feather name="x" size={20} color={Colors.slateMuted} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.body}>
            {!consent ? (
              <Text style={styles.sub}>Chưa có phiếu cho ca này.</Text>
            ) : (
              <>
                <View style={[styles.pill, { backgroundColor: TONE[status.tone].bg }]}>
                  <Feather name={status.icon} size={13} color={TONE[status.tone].fg} />
                  <Text style={[styles.pillText, { color: TONE[status.tone].fg }]}>{status.label}</Text>
                </View>

                <Text style={styles.section}>Bệnh nhân tự trả lời sàng lọc</Text>
                {answered ? (
                  <View style={styles.table}>
                    <Row label="Dị ứng thuốc cản quang" value={ALLERGY[c.contrastAllergy] || '—'} alert={c.contrastAllergy === 'yes'} />
                    <Row label="Mang thai" value={yesNo(c.isPregnant)} alert={c.isPregnant} />
                    <Row label="Cho con bú" value={yesNo(c.isBreastfeeding)} />
                    <Row label="Bệnh thận mạn" value={yesNo(c.kidneyDisease)} alert={c.kidneyDisease} />
                    <Row label="Hen phế quản nặng" value={yesNo(c.severeAsthma)} alert={c.severeAsthma} />
                    {c.gfrLevel !== null && c.gfrLevel !== undefined ? <Row label="eGFR" value={`${c.gfrLevel} mL/min/1.73m²`} alert={c.gfrLevel < 60} /> : null}
                    <Row label="Mức nguy cơ" value={RISK[consent.riskLevel] || '—'} alert={consent.riskLevel !== 'low'} />
                  </View>
                ) : (
                  <Text style={styles.sub}>Bệnh nhân chưa trả lời trên ứng dụng.</Text>
                )}

                {consent.isDoctorOverridden && consent.doctorOverrideReason ? (
                  <Text style={styles.sub}>Bác sĩ đã cho phép tiêm: {consent.doctorOverrideReason}</Text>
                ) : null}

                {status.key === 'blocked' ? (
                  canOverride ? (
                    <View style={styles.overrideBox}>
                      <Text style={styles.section}>Cho phép tiêm dù nguy cơ cao</Text>
                      <TextInput value={reason} onChangeText={setReason} multiline placeholder="Lý do, ví dụ: đã dùng thuốc dự phòng, theo dõi sau tiêm…" placeholderTextColor={Colors.secondary} style={styles.input} accessibilityLabel="Lý do cho phép tiêm" />
                      {error ? <Text style={styles.error}>{error}</Text> : null}
                      <Pressable onPress={override} disabled={reason.trim().length < 5 || saving} accessibilityRole="button"
                        style={[styles.primaryBtn, (reason.trim().length < 5 || saving) && styles.disabled]}>
                        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Cho phép tiêm</Text>}
                      </Pressable>
                    </View>
                  ) : (
                    <Text style={styles.sub}>Nguy cơ cao: cần bác sĩ chỉ định xem xét trước khi tiêm.</Text>
                  )
                ) : null}

                <Text style={styles.section}>Chữ ký bệnh nhân</Text>
                {consent.patientSigned ? (
                  <View style={styles.signBox}>
                    <SignatureView kind={consent.patientSignatureKind} svgPath={consent.patientSignatureSvg} text={consent.patientSignatureKind === 'typed' ? consent.patientSignature : ''} />
                    <Text style={styles.sub}>
                      {consent.patientSignature}{consent.patientSignedAt ? `, ${new Date(consent.patientSignedAt).toLocaleString('vi-VN')}` : ''}
                    </Text>
                  </View>
                ) : (
                  <Text style={styles.sub}>Chưa ký.</Text>
                )}
              </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(11,42,85,0.45)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  box: { width: '100%', maxWidth: 520, maxHeight: '90%', backgroundColor: Colors.surface, borderRadius: 20, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, padding: 20, borderBottomWidth: 1, borderBottomColor: Colors.border },
  grow: { flex: 1 },
  title: { fontSize: 18, fontWeight: '700', color: Colors.brandNavy },
  sub: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  body: { padding: 20, gap: 12 },
  section: { fontSize: 15, fontWeight: '700', color: Colors.slateDark, marginTop: 4 },
  pill: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '600' },
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: 12, paddingHorizontal: 12, paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: Colors.border },
  rowLabel: { flex: 1, fontSize: 14, color: Colors.slateMuted },
  rowValue: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  rowAlert: { color: Colors.warningText },
  overrideBox: { gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.warningBg },
  input: { minHeight: 72, padding: 10, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, backgroundColor: Colors.surface, fontSize: 15, color: Colors.slateDark, textAlignVertical: 'top' },
  error: { fontSize: 13, color: Colors.errorText },
  signBox: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'flex-start' },
  primaryBtn: { height: 44, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});

export default ContrastConsentReview;
