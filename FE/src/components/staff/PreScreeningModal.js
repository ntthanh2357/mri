import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, TextInput, Modal, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { put } from '../../services/api.service';
import { SCREEN_QUESTIONS, ANSWER_LABEL, RISK_META, evaluatePreScreening, screeningFromVisit } from '../../utils/preScreening';

// UC-NUR-03 — Hỏi nhanh tiền sử hen phế quản, suy thận, phản ứng thuốc cản quang; lưu vào bệnh án cho bác sĩ.

const TONE = {
  success: { bg: Colors.successBg, fg: Colors.successText },
  warning: { bg: Colors.warningBg, fg: Colors.warningText },
  error: { bg: Colors.errorBg, fg: Colors.errorText },
};
const nameOf = (p) => p?.profile?.name || p?.profile?.fullName || p?.email || 'Bệnh nhân';

const AnswerChips = ({ value, onChange }) => (
  <View style={styles.chips}>
    {['no', 'yes', 'unknown'].map((k) => {
      const on = value === k;
      const yes = k === 'yes';
      return (
        <Pressable
          key={k}
          onPress={() => onChange(k)}
          accessibilityRole="radio"
          accessibilityState={{ selected: on }}
          style={({ hovered }) => [
            styles.chip,
            hovered && !on && styles.chipHover,
            on && (yes ? styles.chipYes : k === 'unknown' ? styles.chipUnknown : styles.chipNo),
          ]}
        >
          <Text style={[styles.chipText, on && styles.chipTextOn]}>{ANSWER_LABEL[k]}</Text>
        </Pressable>
      );
    })}
  </View>
);

const PreScreeningModal = ({ visible, visit, onClose, onSaved }) => {
  const [form, setForm] = useState(screeningFromVisit(null));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (visible) { setForm(screeningFromVisit(visit)); setError(''); }
  }, [visible, visit]);

  const result = useMemo(() => evaluatePreScreening(form), [form]);
  const tone = TONE[RISK_META[result.riskLevel].tone];
  const setQ = (key, patch) => setForm((f) => ({ ...f, [key]: { ...f[key], ...patch } }));

  const save = async () => {
    if (!visit?._id) return;
    setSaving(true);
    setError('');
    try {
      const res = await put(`/api/v1/visits/${visit._id}/pre-screening`, form);
      onSaved?.(res?.message || 'Đã lưu sàng lọc vào bệnh án.');
      onClose();
    } catch (err) {
      setError(err?.message || 'Không lưu được sàng lọc.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.head}>
            <View style={styles.grow}>
              <Text style={styles.title} accessibilityRole="header">Sàng lọc dị ứng & chống chỉ định</Text>
              <Text style={styles.sub} numberOfLines={1}>{nameOf(visit?.patientId)} · hỏi nhanh trước khi bác sĩ khám</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Đóng" hitSlop={8}>
              <Feather name="x" size={20} color={Colors.slateMuted} />
            </Pressable>
          </View>

          <ScrollView style={styles.body} contentContainerStyle={{ gap: 14 }}>
            {SCREEN_QUESTIONS.map((q) => (
              <View key={q.key} style={styles.q}>
                <Text style={styles.qTitle}>{q.title}</Text>
                <Text style={styles.qHint}>{q.hint}</Text>
                <AnswerChips value={form[q.key].answer} onChange={(a) => setQ(q.key, { answer: a })} />
                {form[q.key].answer === 'yes' ? (
                  <TextInput
                    value={form[q.key].note}
                    onChangeText={(t) => setQ(q.key, { note: t })}
                    placeholder="Ghi chú chi tiết (thuốc gây phản ứng, mức độ, thời điểm…)"
                    style={styles.input}
                    maxLength={300}
                    accessibilityLabel={`Ghi chú ${q.title}`}
                  />
                ) : null}
              </View>
            ))}

            <View style={styles.q}>
              <Text style={styles.qTitle}>Dị ứng khác (thuốc, thức ăn)</Text>
              <TextInput
                value={form.otherAllergies}
                onChangeText={(t) => setForm((f) => ({ ...f, otherAllergies: t }))}
                placeholder="Ví dụ: Penicillin, hải sản — để trống nếu không có"
                style={styles.input}
                maxLength={300}
                accessibilityLabel="Dị ứng khác"
              />
            </View>

            <View style={styles.q}>
              <Text style={styles.qTitle}>Ghi chú cho bác sĩ</Text>
              <TextInput
                value={form.notes}
                onChangeText={(t) => setForm((f) => ({ ...f, notes: t }))}
                placeholder="Thông tin thêm điều dưỡng quan sát được"
                style={[styles.input, styles.inputMulti]}
                multiline
                maxLength={800}
                accessibilityLabel="Ghi chú cho bác sĩ"
              />
            </View>

            <View style={[styles.result, { backgroundColor: tone.bg }]} accessibilityLiveRegion="polite">
              <View style={styles.resultHead}>
                <Feather name={result.riskLevel === 'none' ? 'check-circle' : 'alert-triangle'} size={16} color={tone.fg} />
                <Text style={[styles.resultTitle, { color: tone.fg }]}>{RISK_META[result.riskLevel].label}</Text>
              </View>
              {result.flags.map((f) => <Text key={f} style={[styles.flag, { color: tone.fg }]}>• {f}</Text>)}
            </View>
            {error ? <Text style={styles.error}>{error}</Text> : null}
          </ScrollView>

          <View style={styles.foot}>
            <Pressable onPress={onClose} disabled={saving} accessibilityRole="button" style={({ hovered }) => [styles.btn, styles.btnSecondary, hovered && styles.btnSecondaryHover]}>
              <Text style={styles.btnSecondaryText}>Huỷ</Text>
            </Pressable>
            <Pressable onPress={save} disabled={saving} accessibilityRole="button" style={({ hovered }) => [styles.btn, styles.btnPrimary, hovered && styles.btnPrimaryHover, saving && { opacity: 0.6 }]}>
              {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Feather name="save" size={15} color="#FFFFFF" />}
              <Text style={styles.btnPrimaryText}>Lưu vào bệnh án</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(11,42,85,0.55)', alignItems: 'center', justifyContent: 'center', padding: 16 },
  sheet: { width: '100%', maxWidth: 560, maxHeight: '92%', backgroundColor: Colors.surface, borderRadius: 16, overflow: 'hidden' },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 18, borderBottomWidth: 1, borderBottomColor: Colors.border },
  grow: { flex: 1, minWidth: 0 },
  title: { fontSize: 18, fontWeight: '800', color: Colors.brandNavy },
  sub: { fontSize: 13, color: Colors.slateMuted, marginTop: 2 },
  body: { paddingHorizontal: 18, paddingTop: 16 },
  q: { gap: 6 },
  qTitle: { fontSize: 15, fontWeight: '700', color: Colors.slateDark },
  qHint: { fontSize: 13, color: Colors.secondary },
  chips: { flexDirection: 'row', gap: 8, marginTop: 4 },
  chip: { minWidth: 84, alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  chipHover: { backgroundColor: Colors.brandGreenSoft },
  chipNo: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  chipYes: { backgroundColor: Colors.errorText, borderColor: Colors.errorText },
  chipUnknown: { backgroundColor: Colors.warningText, borderColor: Colors.warningText },
  chipText: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  chipTextOn: { color: '#FFFFFF' },
  input: { minHeight: 40, paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 8, fontSize: 14, color: Colors.slateDark, backgroundColor: Colors.surface, marginTop: 4 },
  inputMulti: { minHeight: 72, textAlignVertical: 'top' },
  result: { padding: 14, borderRadius: 10, gap: 4 },
  resultHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  resultTitle: { fontSize: 14, fontWeight: '800' },
  flag: { fontSize: 13, lineHeight: 19 },
  error: { fontSize: 13, fontWeight: '600', color: Colors.errorText },
  foot: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, padding: 16, borderTopWidth: 1, borderTopColor: Colors.border },
  btn: { flexDirection: 'row', alignItems: 'center', gap: 8, height: 40, paddingHorizontal: 16, borderRadius: 8 },
  btnPrimary: { backgroundColor: Colors.brandGreen },
  btnPrimaryHover: { backgroundColor: Colors.brandGreenPressed },
  btnPrimaryText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  btnSecondary: { borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  btnSecondaryHover: { backgroundColor: Colors.background },
  btnSecondaryText: { color: Colors.slateMuted, fontSize: 14, fontWeight: '600' },
});

export default PreScreeningModal;
