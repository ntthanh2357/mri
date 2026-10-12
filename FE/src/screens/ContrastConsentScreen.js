import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, Pressable, TextInput, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import SignaturePad from '../components/patient/SignaturePad';
import SignatureView from '../components/SignatureView';
import Colors from '../constants/colors';
import { useContrastConsents } from '../controllers/useContrastConsents';
import { consentStatus } from '../utils/signature';

// UC-PAT-06 — Bệnh nhân đọc phiếu tiêm thuốc cản quang Gadolinium, trả lời sàng lọc và ký.
// Điện thoại: ký bằng ngón tay. Web: dùng chữ ký đã lưu, hoặc gõ họ tên làm chữ ký.

const IS_WEB = Platform.OS === 'web';
const TONE = {
  ok: { bg: Colors.successBg, fg: Colors.successText },
  info: { bg: Colors.infoBg, fg: Colors.infoText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
};
const ALLERGY_OPTIONS = [
  { value: 'no', label: 'Chưa từng' },
  { value: 'yes', label: 'Đã từng' },
  { value: 'unknown', label: 'Không rõ' },
];
const YES_NO_QUESTIONS = [
  { key: 'isPregnant', label: 'Bạn đang mang thai hoặc có thể đang mang thai?' },
  { key: 'isBreastfeeding', label: 'Bạn đang cho con bú?' },
  { key: 'kidneyDisease', label: 'Bạn có bệnh thận mạn hoặc từng được báo suy thận?' },
  { key: 'severeAsthma', label: 'Bạn bị hen phế quản nặng?' },
];

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');
const fmtDateTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' }) : '');

const Pill = ({ status }) => {
  const t = TONE[status.tone];
  return (
    <View style={[styles.pill, { backgroundColor: t.bg }]}>
      <Feather name={status.icon} size={13} color={t.fg} />
      <Text style={[styles.pillText, { color: t.fg }]}>{status.label}</Text>
    </View>
  );
};

const Message = ({ msg }) => (msg ? (
  <View style={[styles.message, { backgroundColor: msg.ok ? Colors.successBg : Colors.warningBg }]} accessibilityLiveRegion="polite">
    <Feather name={msg.ok ? 'check-circle' : 'alert-circle'} size={15} color={msg.ok ? Colors.successText : Colors.warningText} />
    <Text style={[styles.messageText, { color: msg.ok ? Colors.successText : Colors.warningText }]}>{msg.text}</Text>
  </View>
) : null);

const Check = ({ checked, onPress, label, disabled }) => (
  <Pressable onPress={onPress} disabled={disabled} accessibilityRole="checkbox" accessibilityState={{ checked, disabled }} style={styles.checkRow} hitSlop={6}>
    <View style={[styles.checkBox, checked && styles.checkBoxOn]}>
      {checked ? <Feather name="check" size={14} color="#FFFFFF" /> : null}
    </View>
    <Text style={styles.checkLabel}>{label}</Text>
  </Pressable>
);

const Segmented = ({ options, value, onChange, disabled, label }) => (
  <View style={styles.segment} accessibilityRole="radiogroup" accessibilityLabel={label}>
    {options.map((o) => {
      const on = value === o.value;
      return (
        <Pressable key={String(o.value)} onPress={() => onChange(o.value)} disabled={disabled} accessibilityRole="radio" accessibilityState={{ checked: on, disabled }}
          style={[styles.segmentItem, on && styles.segmentItemOn]}>
          <Text style={[styles.segmentText, on && styles.segmentTextOn]}>{o.label}</Text>
        </Pressable>
      );
    })}
  </View>
);

const ChecklistStep = ({ consent, onSubmit }) => {
  const prev = consent.patientChecklistAt ? consent.allergyChecklist || {} : {};
  const [answers, setAnswers] = useState({
    contrastAllergy: prev.contrastAllergy || null,
    ...Object.fromEntries(YES_NO_QUESTIONS.map((q) => [q.key, consent.patientChecklistAt ? Boolean(prev[q.key]) : null])),
  });
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);
  const locked = consent.patientSigned;
  const complete = answers.contrastAllergy && YES_NO_QUESTIONS.every((q) => answers[q.key] !== null);

  const save = async () => {
    setSaving(true);
    const res = await onSubmit(answers);
    setSaving(false);
    setMsg({ ok: res.ok, text: res.message });
  };

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>2. Câu hỏi sàng lọc</Text>
      <Text style={styles.note}>Trả lời trung thực để bác sĩ đánh giá an toàn trước khi tiêm thuốc.</Text>
      <View style={styles.question}>
        <Text style={styles.questionText}>Bạn đã từng bị dị ứng thuốc cản quang (khi chụp CT, MRI) chưa?</Text>
        <Segmented label="Dị ứng thuốc cản quang" options={ALLERGY_OPTIONS} value={answers.contrastAllergy} disabled={locked} onChange={(v) => setAnswers({ ...answers, contrastAllergy: v })} />
      </View>
      {YES_NO_QUESTIONS.map((q) => (
        <View key={q.key} style={styles.question}>
          <Text style={styles.questionText}>{q.label}</Text>
          <Segmented label={q.label} options={[{ value: false, label: 'Không' }, { value: true, label: 'Có' }]} value={answers[q.key]} disabled={locked} onChange={(v) => setAnswers({ ...answers, [q.key]: v })} />
        </View>
      ))}
      <Message msg={msg} />
      {!locked ? (
        <Pressable onPress={save} disabled={!complete || saving} accessibilityRole="button"
          style={({ hovered }) => [styles.secondaryBtn, hovered && complete && styles.secondaryBtnHover, (!complete || saving) && styles.disabled]}>
          {saving ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : <Text style={styles.secondaryBtnText}>{consent.patientChecklistAt ? 'Cập nhật câu trả lời' : 'Lưu câu trả lời'}</Text>}
        </Pressable>
      ) : null}
      {!complete && !locked ? <Text style={styles.hint}>Trả lời đủ {YES_NO_QUESTIONS.length + 1} câu để tiếp tục.</Text> : null}
    </View>
  );
};

const SignStep = ({ consent, status, savedSignature, onSign }) => {
  const [agree, setAgree] = useState(false);
  const [useSaved, setUseSaved] = useState(Boolean(savedSignature));
  const [svgPath, setSvgPath] = useState('');
  const [typed, setTyped] = useState('');
  const [remember, setRemember] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => { setUseSaved(Boolean(savedSignature)); }, [savedSignature]);

  if (status.key === 'signed') {
    return (
      <View style={styles.step}>
        <Text style={styles.stepTitle}>3. Ký xác nhận</Text>
        <View style={styles.signedBox}>
          <SignatureView kind={consent.patientSignatureKind} svgPath={consent.patientSignatureSvg} text={consent.patientSignatureKind === 'typed' ? consent.patientSignature : ''} />
          <Text style={styles.note}>{consent.patientSignature}, ký lúc {fmtDateTime(consent.patientSignedAt)}</Text>
        </View>
      </View>
    );
  }
  if (status.key !== 'ready') {
    return (
      <View style={[styles.step, styles.stepMuted]}>
        <Text style={styles.stepTitle}>3. Ký xác nhận</Text>
        <Text style={styles.note}>
          {status.key === 'blocked'
            ? 'Câu trả lời của bạn có yếu tố cần bác sĩ xem xét. Bác sĩ sẽ liên hệ hoặc trao đổi với bạn khi đến khám; bạn ký được sau khi bác sĩ đồng ý.'
            : 'Bạn ký được sau khi trả lời câu hỏi sàng lọc.'}
        </Text>
      </View>
    );
  }

  const signature = useSaved && savedSignature
    ? { kind: savedSignature.kind, svgPath: savedSignature.svgPath, text: savedSignature.text }
    : IS_WEB ? { kind: 'typed', text: typed.trim() } : { kind: 'drawn', svgPath };
  const hasSignature = signature.kind === 'drawn' ? Boolean(signature.svgPath) : signature.text.length >= 2;
  const canSign = agree && hasSignature && !saving;

  const submit = async () => {
    setSaving(true);
    const res = await onSign({ agree, signature, saveSignature: !(useSaved && savedSignature) && remember });
    setSaving(false);
    if (!res.ok) setMsg({ ok: false, text: res.message });
  };

  return (
    <View style={styles.step}>
      <Text style={styles.stepTitle}>3. Ký xác nhận</Text>
      <Check checked={agree} onPress={() => setAgree(!agree)} label="Tôi đã đọc, hiểu nội dung phiếu và đồng ý tiêm thuốc cản quang Gadolinium khi chụp MRI." />

      {useSaved && savedSignature ? (
        <View style={styles.savedBox}>
          <Text style={styles.label}>Chữ ký đã lưu</Text>
          <SignatureView kind={savedSignature.kind} svgPath={savedSignature.svgPath} text={savedSignature.text} />
          <Pressable onPress={() => setUseSaved(false)} accessibilityRole="button" hitSlop={8}>
            <Text style={styles.link}>{IS_WEB ? 'Dùng chữ ký khác' : 'Ký lại'}</Text>
          </Pressable>
        </View>
      ) : IS_WEB ? (
        <View style={styles.field}>
          <Text style={styles.label}>Gõ họ tên làm chữ ký</Text>
          <TextInput value={typed} onChangeText={setTyped} placeholder="Ví dụ: Nguyễn Văn An…" placeholderTextColor={Colors.secondary} maxLength={80} style={styles.input} accessibilityLabel="Họ tên làm chữ ký" />
          {typed.trim() ? <SignatureView kind="typed" text={typed.trim()} /> : null}
          <Text style={styles.hint}>Muốn ký tay, hãy mở ứng dụng trên điện thoại; chữ ký tay lưu lại sẽ tự điền ở đây lần sau.</Text>
        </View>
      ) : (
        <View style={styles.field}>
          <Text style={styles.label}>Chữ ký của bạn</Text>
          <SignaturePad onChange={setSvgPath} />
        </View>
      )}

      {!(useSaved && savedSignature) ? (
        <Check checked={remember} onPress={() => setRemember(!remember)} label="Lưu chữ ký để dùng cho lần sau" />
      ) : null}
      <Message msg={msg} />
      <Pressable onPress={submit} disabled={!canSign} accessibilityRole="button"
        style={({ hovered }) => [styles.primaryBtn, hovered && canSign && styles.primaryBtnHover, !canSign && styles.disabled]}>
        {saving ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.primaryBtnText}>Ký phiếu đồng thuận</Text>}
      </Pressable>
    </View>
  );
};

const ConsentCard = ({ consent, open, onToggle, savedSignature, submitChecklist, sign }) => {
  const status = consentStatus(consent);
  const visit = consent.visitId || {};
  return (
    <View style={styles.card}>
      <Pressable onPress={onToggle} accessibilityRole="button" accessibilityState={{ expanded: open }} style={styles.cardHead}>
        <View style={styles.grow}>
          <Text style={styles.cardTitle}>Tiêm thuốc cản quang khi chụp MRI</Text>
          <Text style={styles.meta}>
            {[visit.mriOrder?.region ? `Vùng chụp: ${visit.mriOrder.region}` : null, `Chỉ định ngày ${fmtDate(visit.date || visit.createdAt || consent.createdAt)}`].filter(Boolean).join('. ')}
          </Text>
        </View>
        <Pill status={status} />
        <Feather name={open ? 'chevron-up' : 'chevron-down'} size={18} color={Colors.slateMuted} />
      </Pressable>
      {open ? (
        <View style={styles.cardBody}>
          <View style={styles.step}>
            <Text style={styles.stepTitle}>1. Thông tin thủ thuật</Text>
            <Text style={styles.body}>{consent.doctorExplanation}</Text>
            <Text style={styles.label}>Nguy cơ có thể gặp</Text>
            <Text style={styles.body}>{consent.risks}</Text>
            <Text style={styles.note}>Nếu còn điều chưa rõ, hãy hỏi bác sĩ trước khi ký.</Text>
          </View>
          <ChecklistStep consent={consent} onSubmit={(a) => submitChecklist(consent._id, a)} />
          <SignStep consent={consent} status={status} savedSignature={savedSignature} onSign={(p) => sign(consent._id, p)} />
        </View>
      ) : null}
    </View>
  );
};

const ContrastConsentScreen = ({ navigation }) => {
  const { loading, items, savedSignature, error, reload, submitChecklist, sign } = useContrastConsents();
  // Mở sẵn phiếu đầu tiên chưa ký
  const firstPending = useMemo(() => items.find((c) => !c.patientSigned)?._id || null, [items]);
  const [openId, setOpenId] = useState(undefined);
  const currentOpen = openId === undefined ? firstPending : openId;
  const goBack = () => (navigation.canGoBack() ? navigation.goBack() : navigation.navigate('Home'));

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="Home">
      <View style={styles.container}>
        <PageHeader bar onBack={goBack} backLabel="Trang chủ" title="Phiếu đồng thuận" subtitle="Ký trước khi chụp MRI có tiêm thuốc cản quang." />
        <ScrollView>
          <PageContainer width="reading" style={styles.page}>
            {loading && !items.length ? (
              <View style={styles.stateBox}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.note}>Đang tải…</Text></View>
            ) : error ? (
              <View style={styles.stateBox}>
                <Text style={styles.stateTitle}>{error}</Text>
                <Pressable onPress={reload} accessibilityRole="button" style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Thử lại</Text></Pressable>
              </View>
            ) : !items.length ? (
              <View style={styles.stateBox}>
                <Feather name="file-text" size={28} color={Colors.slateMuted} />
                <Text style={styles.stateTitle}>Bạn chưa có phiếu nào cần ký</Text>
                <Text style={styles.note}>Khi bác sĩ chỉ định chụp MRI có tiêm thuốc cản quang, phiếu sẽ hiện ở đây.</Text>
              </View>
            ) : (
              <View style={styles.stack}>
                {items.map((c) => (
                  <ConsentCard key={c._id} consent={c} open={currentOpen === c._id} onToggle={() => setOpenId(currentOpen === c._id ? null : c._id)}
                    savedSignature={savedSignature} submitChecklist={submitChecklist}
                    sign={(id, payload) => { setOpenId(id); return sign(id, payload); }} />
                ))}
              </View>
            )}
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
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  cardHead: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, padding: 18 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  meta: { fontSize: 14, color: Colors.slateMuted, marginTop: 2 },
  cardBody: { paddingHorizontal: 18, paddingBottom: 18, gap: 20, borderTopWidth: 1, borderTopColor: Colors.border, paddingTop: 18 },
  step: { gap: 10 },
  stepMuted: { opacity: 0.85 },
  stepTitle: { fontSize: 16, fontWeight: '700', color: Colors.slateDark },
  body: { fontSize: 16, lineHeight: 24, color: Colors.slateDark },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  hint: { fontSize: 13, color: Colors.slateMuted },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  link: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  question: { gap: 8 },
  questionText: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  segment: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  segmentItem: { minWidth: 88, height: 40, paddingHorizontal: 14, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  segmentItemOn: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  segmentText: { fontSize: 15, color: Colors.slateDark },
  segmentTextOn: { color: Colors.brandGreen, fontWeight: '700' },
  checkRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  checkBox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  checkBoxOn: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  checkLabel: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  field: { gap: 8 },
  input: { height: 46, paddingHorizontal: 12, borderWidth: 1, borderColor: Colors.borderStrong, borderRadius: 10, backgroundColor: Colors.surface, fontSize: 16, color: Colors.slateDark },
  savedBox: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: Colors.background, alignItems: 'flex-start' },
  signedBox: { gap: 6, padding: 12, borderRadius: 10, backgroundColor: Colors.successBg, alignItems: 'flex-start' },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pillText: { fontSize: 13, fontWeight: '600' },
  message: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 12, borderRadius: 10 },
  messageText: { flex: 1, fontSize: 14, fontWeight: '600' },
  primaryBtn: { height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { alignSelf: 'flex-start', height: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnHover: { backgroundColor: Colors.brandGreenSoft },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
  stateBox: { alignItems: 'center', gap: 10, paddingVertical: 56 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },
});

export default ContrastConsentScreen;
