import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import Colors from '../constants/colors';
import { useMriPrep } from '../controllers/useMriPrep';

// Chuẩn bị chụp MRI: hướng dẫn trước khi chụp + phiếu sàng lọc an toàn bệnh nhân tự khai ở nhà.
// Kỹ thuật viên vẫn hỏi lại và xác nhận tại buồng máy; phiếu này giúp KTV biết trước.

const CHOICES = [
  { key: 'yes', label: 'Có' },
  { key: 'no', label: 'Không' },
  { key: 'unsure', label: 'Không rõ' },
];
const RESULT = {
  danger: {
    tone: 'danger', icon: 'alert-octagon',
    title: 'Bạn đã khai có thiết bị cấy ghép hoặc kim loại trong người.',
    text: 'Đừng lo, nhiều trường hợp vẫn chụp được. Khi tới, hãy báo ngay với kỹ thuật viên và mang theo giấy tờ về thiết bị (thẻ máy tạo nhịp, giấy ra viện ghi loại dụng cụ). Không tự vào phòng chụp khi chưa được kỹ thuật viên kiểm tra.',
  },
  attention: {
    tone: 'warn', icon: 'alert-triangle',
    title: 'Bạn có một vài điểm cần lưu ý.',
    text: 'Kỹ thuật viên sẽ hỏi lại các điểm này trước khi chụp. Nếu bạn sợ không gian kín, có thể đề nghị có người nhà đi cùng tới cửa phòng chụp.',
  },
  clear: { tone: 'ok', icon: 'check-circle', title: 'Không có yếu tố nguy cơ nào.', text: 'Kỹ thuật viên vẫn sẽ hỏi lại cùng bạn trước khi chụp.' },
};
const TONE = {
  danger: { bg: Colors.errorBg, fg: Colors.errorText },
  warn: { bg: Colors.warningBg, fg: Colors.warningText },
  ok: { bg: Colors.successBg, fg: Colors.successText },
};
const fmtTime = (d) => (d ? new Date(d).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' }) : '');

const Question = ({ q, index, value, onChange, disabled }) => (
  <View style={styles.question} accessibilityRole="radiogroup" accessibilityLabel={q.text}>
    <Text style={styles.questionText}>{index + 1}. {q.text}</Text>
    <View style={styles.choices}>
      {CHOICES.map((c) => {
        const on = value === c.key;
        return (
          <Pressable key={c.key} onPress={() => onChange(c.key)} disabled={disabled} accessibilityRole="radio" aria-checked={on}
            accessibilityLabel={`${c.label}: ${q.text}`}
            style={({ hovered }) => [styles.choice, on && (c.key === 'no' ? styles.choiceOnNo : styles.choiceOnYes), hovered && !on && !disabled && styles.choiceHover, disabled && styles.disabled]}>
            <Text style={[styles.choiceText, on && styles.choiceTextOn]}>{c.label}</Text>
          </Pressable>
        );
      })}
    </View>
  </View>
);

const MriPrepScreen = ({ navigation }) => {
  const { loading, prep, error, reload, saveScreening } = useMriPrep();
  const [answers, setAnswers] = useState({});
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  // điền lại câu trả lời đã khai (sửa được tới khi KTV kiểm tra)
  useEffect(() => {
    setAnswers(prep?.screening?.answers || {});
    setDetails(prep?.screening?.details || '');
  }, [prep?.visitId, prep?.screening?.declaredAt]);

  const questions = prep?.questions || [];
  const missing = questions.filter((q) => !answers[q.key]).length;
  const result = prep?.screening ? RESULT[prep.screening.level] || RESULT.clear : null;

  const submit = async () => {
    setBusy(true);
    const res = await saveScreening(prep.visitId, answers, details);
    setBusy(false);
    setMsg(res.ok ? null : res.message);
  };

  let body;
  if (loading && !prep) {
    body = <View style={styles.state}><ActivityIndicator size="large" color={Colors.brandGreen} /><Text style={styles.note}>Đang tải…</Text></View>;
  } else if (error && !prep) {
    body = (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>{error}</Text>
        <Pressable onPress={reload} accessibilityRole="button" style={styles.secondaryBtn}><Text style={styles.secondaryBtnText}>Thử lại</Text></Pressable>
      </View>
    );
  } else if (!prep) {
    body = (
      <View style={styles.state}>
        <Feather name="calendar" size={28} color={Colors.slateMuted} />
        <Text style={styles.stateTitle}>Hiện bạn không có lịch chụp MRI nào cần chuẩn bị.</Text>
        <Text style={styles.note}>Khi bác sĩ chỉ định chụp MRI, hướng dẫn và phiếu sàng lọc an toàn sẽ hiện ở đây.</Text>
      </View>
    );
  } else {
    body = (
      <View style={styles.stack}>
        <View style={styles.card}>
          <View style={styles.head}>
            <Feather name="disc" size={18} color={Colors.brandGreen} />
            <Text style={styles.cardTitle}>Chụp MRI{prep.region ? ` ${prep.region}` : ''}</Text>
          </View>
          <Text style={styles.body}>
            Bác sĩ chỉ định lúc {fmtTime(prep.orderedAt)}. {prep.withContrast ? 'Có tiêm thuốc cản quang (thuốc giúp hình ảnh rõ hơn).' : 'Không tiêm thuốc cản quang.'}
          </Text>
          {prep.consentPending ? (
            <Pressable onPress={() => navigation.navigate('ContrastConsent')} accessibilityRole="button"
              style={({ hovered }) => [styles.action, hovered && styles.actionHover]}>
              <Feather name="edit-3" size={16} color={Colors.warningText} />
              <Text style={styles.actionText}>Bạn cần ký phiếu đồng thuận tiêm thuốc cản quang trước khi chụp</Text>
              <Text style={styles.actionLink}>Mở phiếu</Text>
            </Pressable>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Hướng dẫn trước khi chụp</Text>
          {prep.preparation.items.map((item, i) => (
            <View key={i} style={styles.item}>
              <Text style={styles.itemNum}>{i + 1}</Text>
              <Text style={styles.itemText}>{item}</Text>
            </View>
          ))}
          {prep.preparation.doctorNote ? (
            <View style={styles.doctorNote}>
              <Feather name="user" size={15} color={Colors.infoText} />
              <Text style={styles.doctorNoteText}><Text style={styles.bold}>Bác sĩ dặn thêm: </Text>{prep.preparation.doctorNote}</Text>
            </View>
          ) : null}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Phiếu sàng lọc an toàn MRI</Text>
          <Text style={styles.body}>
            Máy MRI có từ trường rất mạnh, có thể hút kim loại hoặc làm hỏng thiết bị cấy trong người. Hãy trả lời trung thực;
            không chắc thì chọn "Không rõ". Kỹ thuật viên sẽ hỏi lại cùng bạn trước khi chụp.
          </Text>
          {result ? (
            <View style={[styles.result, { backgroundColor: TONE[result.tone].bg }]} accessibilityLiveRegion="polite">
              <Feather name={result.icon} size={18} color={TONE[result.tone].fg} />
              <View style={styles.grow}>
                <Text style={[styles.resultTitle, { color: TONE[result.tone].fg }]}>{result.title}</Text>
                <Text style={styles.resultText}>{result.text}</Text>
                <Text style={styles.note}>Đã khai lúc {fmtTime(prep.screening.declaredAt)}.</Text>
              </View>
            </View>
          ) : null}
          {prep.locked ? (
            <Text style={styles.note}>Kỹ thuật viên đã kiểm tra an toàn cho bạn, phiếu không sửa được nữa. Nếu có gì thay đổi, hãy báo trực tiếp với kỹ thuật viên.</Text>
          ) : null}
          {questions.map((q, i) => (
            <Question key={q.key} q={q} index={i} value={answers[q.key]} disabled={prep.locked}
              onChange={(v) => setAnswers((a) => ({ ...a, [q.key]: v }))} />
          ))}
          <Text style={styles.label}>Ghi rõ nếu có (loại thiết bị, năm phẫu thuật, vị trí kim loại…)</Text>
          <TextInput value={details} onChangeText={setDetails} editable={!prep.locked} multiline maxLength={500}
            accessibilityLabel="Ghi chú thêm cho kỹ thuật viên" placeholder="Ví dụ: thay khớp háng năm 2021…" placeholderTextColor={Colors.slateMuted}
            style={[styles.input, prep.locked && styles.disabled]} />
          {msg ? <Text style={styles.error}>{msg}</Text> : null}
          {!prep.locked ? (
            <Pressable onPress={submit} disabled={busy || missing > 0} accessibilityRole="button"
              style={({ hovered }) => [styles.primaryBtn, hovered && !missing && styles.primaryBtnHover, (busy || missing > 0) && styles.disabled]}>
              {busy ? <ActivityIndicator size="small" color="#FFFFFF" />
                : <Text style={styles.primaryBtnText}>{missing > 0 ? `Còn ${missing} câu chưa trả lời` : prep.screening ? 'Cập nhật phiếu' : 'Gửi phiếu sàng lọc'}</Text>}
            </Pressable>
          ) : null}
        </View>
      </View>
    );
  }

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="MriPrep">
      <View style={styles.container}>
        <PageHeader bar title="Chuẩn bị chụp MRI" subtitle="Hướng dẫn trước khi chụp và phiếu sàng lọc an toàn."
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
  head: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  cardTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  body: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  note: { fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  bold: { fontWeight: '700' },
  error: { fontSize: 14, color: Colors.errorText },
  label: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  state: { alignItems: 'center', gap: 10, paddingVertical: 56, paddingHorizontal: 16 },
  stateTitle: { fontSize: 16, fontWeight: '600', color: Colors.slateDark, textAlign: 'center' },

  action: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 48, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.warningBg, backgroundColor: Colors.warningBg },
  actionHover: { borderColor: Colors.warningText },
  actionText: { flex: 1, minWidth: 180, fontSize: 14, lineHeight: 20, color: Colors.warningText },
  actionLink: { fontSize: 14, fontWeight: '700', color: Colors.warningText },

  item: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  itemNum: { width: 24, height: 24, borderRadius: 12, textAlign: 'center', lineHeight: 24, fontSize: 13, fontWeight: '700', color: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft, fontVariant: ['tabular-nums'] },
  itemText: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  doctorNote: { flexDirection: 'row', alignItems: 'flex-start', gap: 8, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg },
  doctorNoteText: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.infoText },

  result: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10 },
  resultTitle: { fontSize: 15, fontWeight: '700', lineHeight: 22 },
  resultText: { fontSize: 14, lineHeight: 20, color: Colors.slateDark, marginTop: 2 },

  question: { gap: 8, paddingTop: 12, borderTopWidth: 1, borderTopColor: Colors.border },
  questionText: { fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  choice: { minWidth: 88, minHeight: 44, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  choiceOnNo: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreen },
  choiceOnYes: { borderColor: Colors.warningText, backgroundColor: Colors.warningText },
  choiceHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  choiceText: { fontSize: 15, fontWeight: '600', color: Colors.slateDark },
  choiceTextOn: { color: '#FFFFFF' },
  input: { minHeight: 88, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, fontSize: 15, lineHeight: 22, color: Colors.slateDark, textAlignVertical: 'top' },

  primaryBtn: { height: 48, borderRadius: 10, backgroundColor: Colors.brandGreen, alignItems: 'center', justifyContent: 'center' },
  primaryBtnHover: { backgroundColor: Colors.brandGreenPressed },
  primaryBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  secondaryBtn: { height: 44, paddingHorizontal: 16, borderRadius: 10, borderWidth: 1, borderColor: Colors.borderStrong, alignItems: 'center', justifyContent: 'center' },
  secondaryBtnText: { color: Colors.brandGreen, fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.5 },
});

export default MriPrepScreen;
