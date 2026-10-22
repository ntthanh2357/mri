import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, ActivityIndicator, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ResponsiveLayout from '../components/ResponsiveLayout';
import PageHeader, { HeaderAction } from '../components/layout/PageHeader';
import PageContainer from '../components/layout/PageContainer';
import SimpleMarkdownText from '../components/SimpleMarkdownText';
import Colors from '../constants/colors';
import { useHealthChat } from '../controllers/useHealthChat';
import { SUGGESTED_QUESTIONS, CHAT_MAX_MESSAGE, CHAT_CONSENT_POINTS, looksUrgent } from '../utils/healthChat';

// Hỏi đáp sức khỏe với trợ lý AI (chatbot của AI service): câu hỏi chung về u não, chụp MRI, chăm sóc.
// Không gửi bệnh án; lịch sử chỉ giữ trong phiên.

const Note = ({ icon, children }) => (
  <View style={styles.noteRow}>
    <Feather name={icon} size={15} color={Colors.slateMuted} style={styles.noteIcon} />
    <Text style={styles.noteText}>{children}</Text>
  </View>
);

const Bubble = ({ msg }) => {
  if (msg.role === 'user') {
    return (
      <View style={[styles.bubble, styles.userBubble]}>
        <Text style={styles.userText} selectable>{msg.text}</Text>
      </View>
    );
  }
  if (msg.role === 'error') {
    return (
      <View style={[styles.bubble, styles.errorBubble]} accessibilityRole="alert">
        <Feather name="alert-circle" size={15} color={Colors.errorText} />
        <Text style={styles.errorText}>{msg.text}</Text>
      </View>
    );
  }
  return (
    <View style={[styles.bubble, styles.botBubble]}>
      <Text style={styles.botName}>Trợ lý NeuroScan</Text>
      <SimpleMarkdownText text={msg.text} />
    </View>
  );
};

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('vi-VN') : '');

// Xin đồng ý trước khi hỏi: câu hỏi sức khoẻ là dữ liệu nhạy cảm, gửi ra dịch vụ bên ngoài và được ghi nhật ký
const ConsentBox = ({ onAgree, busy }) => (
  <View style={styles.consent}>
    <Text style={styles.emptyTitle}>Trước khi hỏi, bạn cần đồng ý</Text>
    {CHAT_CONSENT_POINTS.map((t) => (
      <View key={t} style={styles.noteRow}>
        <Feather name="check-circle" size={15} color={Colors.brandGreen} style={styles.noteIcon} />
        <Text style={styles.consentText}>{t}</Text>
      </View>
    ))}
    <Pressable onPress={onAgree} disabled={busy} accessibilityRole="button" accessibilityLabel="Tôi đồng ý, bắt đầu hỏi"
      style={({ hovered }) => [styles.sendBtn, styles.selfStart, hovered && styles.sendBtnHover, busy && styles.disabled]}>
      <Text style={styles.sendText}>Tôi đồng ý, bắt đầu hỏi</Text>
    </Pressable>
  </View>
);

export default function HealthChatScreen({ navigation }) {
  const { messages, sending, send, clear, consent, setConsentTo, reloadConsent } = useHealthChat();
  const [consentBusy, setConsentBusy] = useState(false);
  const [consentMsg, setConsentMsg] = useState(null); // { tone: 'info' | 'error', text }
  const onConsent = async (on) => {
    setConsentBusy(true);
    const res = await setConsentTo(on);
    setConsentBusy(false);
    setConsentMsg({ tone: res.ok ? 'info' : 'error', text: res.message });
  };
  const [draft, setDraft] = useState('');
  const [focused, setFocused] = useState(false);
  const scroller = useRef(null);
  const lastQuestion = [...messages].reverse().find((m) => m.role === 'user')?.text || '';
  const urgent = looksUrgent(lastQuestion) || looksUrgent(draft);
  const canSend = draft.trim().length > 0 && draft.length <= CHAT_MAX_MESSAGE && !sending;

  useEffect(() => {
    const t = setTimeout(() => scroller.current?.scrollToEnd({ animated: true }), 50);
    return () => clearTimeout(t);
  }, [messages.length, sending]);

  const submit = async (text = draft) => {
    if (!String(text).trim() || sending) return;
    setDraft('');
    const res = await send(text);
    if (!res.ok && text === draft) setDraft(text); // lỗi thì trả lại câu đã gõ để gửi lại
  };

  return (
    <ResponsiveLayout navigation={navigation} activeRoute="HealthChat">
      <View style={styles.flex}>
        <PageHeader bar title="Hỏi đáp sức khỏe" subtitle="Hỏi về u não, chụp MRI và cách chăm sóc. Trợ lý AI không thay cho bác sĩ."
          actions={messages.length ? <HeaderAction icon="refresh-cw" label="Cuộc trò chuyện mới" onPress={clear} /> : null} />
        <ScrollView ref={scroller} keyboardShouldPersistTaps="handled">
          <PageContainer width="reading" style={styles.page}>
            {consent.granted ? (
              <View style={styles.notes}>
                <Note icon="info">Trợ lý chỉ trả lời câu hỏi chung, không xem được bệnh án của bạn và không chẩn đoán hay kê thuốc.</Note>
                <Note icon="cloud">Câu hỏi được gửi tới dịch vụ AI Gemini của Google. Đừng ghi họ tên, số điện thoại hay số CCCD.</Note>
                <Note icon="file-text">Câu hỏi và câu trả lời được dịch vụ AI ghi lại để kiểm tra chất lượng (không kèm tên tài khoản của bạn). Ứng dụng không giữ cuộc trò chuyện: rời trang hoặc tải lại là mất.</Note>
                <View style={styles.consentDone}>
                  <Text style={styles.noteText}>Bạn đã đồng ý gửi câu hỏi tới dịch vụ AI{consent.grantedAt ? ` (ngày ${fmtDate(consent.grantedAt)})` : ''}.</Text>
                  <Pressable onPress={() => onConsent(false)} disabled={consentBusy || sending} accessibilityRole="button" style={styles.linkBtn}>
                    <Text style={styles.dangerLink}>Rút lại đồng ý</Text>
                  </Pressable>
                </View>
              </View>
            ) : null}
            {consentMsg ? <Text style={consentMsg.tone === 'error' ? styles.errorText : styles.infoText} accessibilityLiveRegion="polite">{consentMsg.text}</Text> : null}

            {urgent ? (
              <View style={styles.urgent} accessibilityRole="alert">
                <Feather name="phone-call" size={18} color={Colors.errorText} />
                <Text style={styles.urgentText}>
                  Co giật, yếu hoặc liệt nửa người, nói khó, đau đầu dữ dội đột ngột là dấu hiệu cần cấp cứu. Hãy gọi <Text style={styles.bold}>115</Text> hoặc tới cơ sở y tế gần nhất ngay, đừng chờ trả lời.
                </Text>
              </View>
            ) : null}

            {consent.loading ? <ActivityIndicator size="small" color={Colors.brandGreen} /> : consent.error ? (
              <View style={styles.consentDone}>
                <Text style={styles.errorText}>{consent.error}</Text>
                <Pressable onPress={reloadConsent} accessibilityRole="button" style={styles.linkBtn}><Text style={styles.linkText}>Thử lại</Text></Pressable>
              </View>
            ) : !consent.granted ? <ConsentBox onAgree={() => onConsent(true)} busy={consentBusy} /> : !messages.length ? (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Bạn muốn hỏi gì?</Text>
                <Text style={styles.noteText}>Chọn 1 câu gợi ý hoặc tự nhập câu hỏi bên dưới.</Text>
                <View style={styles.chips}>
                  {SUGGESTED_QUESTIONS.map((q) => (
                    <Pressable key={q} onPress={() => submit(q)} disabled={sending} accessibilityRole="button"
                      style={({ hovered }) => [styles.chip, hovered && styles.chipHover]}>
                      <Text style={styles.chipText}>{q}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : (
              <View style={styles.thread} accessibilityLiveRegion="polite">
                {messages.map((m) => <Bubble key={m.id} msg={m} />)}
                {sending ? (
                  <View style={[styles.bubble, styles.botBubble, styles.typing]}>
                    <ActivityIndicator size="small" color={Colors.brandGreen} />
                    <Text style={styles.noteText}>Trợ lý đang trả lời…</Text>
                  </View>
                ) : null}
              </View>
            )}

            {consent.granted ? (
            <View style={[styles.composer, focused && styles.composerFocus]}>
              <TextInput value={draft} onChangeText={setDraft} placeholder="Nhập câu hỏi của bạn…" placeholderTextColor={Colors.slateMuted}
                multiline maxLength={CHAT_MAX_MESSAGE} style={styles.input} accessibilityLabel="Câu hỏi"
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                onKeyPress={(e) => { if (e.nativeEvent.key === 'Enter' && !e.nativeEvent.shiftKey && canSend) { e.preventDefault?.(); submit(); } }} />
              <View style={styles.composerBar}>
                <Text style={styles.counter}>{draft.length}/{CHAT_MAX_MESSAGE}</Text>
                <Pressable onPress={() => submit()} disabled={!canSend} accessibilityRole="button" accessibilityLabel="Gửi câu hỏi"
                  style={({ hovered }) => [styles.sendBtn, hovered && canSend && styles.sendBtnHover, !canSend && styles.disabled]}>
                  <Feather name="send" size={16} color="#FFFFFF" />
                  <Text style={styles.sendText}>Gửi</Text>
                </Pressable>
              </View>
            </View>
            ) : null}
          </PageContainer>
        </ScrollView>
      </View>
    </ResponsiveLayout>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  page: { paddingVertical: 20, gap: 16 },
  notes: { gap: 6 },
  noteRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  noteIcon: { marginTop: 2 },
  noteText: { flex: 1, fontSize: 14, lineHeight: 20, color: Colors.slateMuted },
  bold: { fontWeight: '700' },
  urgent: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 14, borderRadius: 10, backgroundColor: Colors.errorBg },
  urgentText: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.errorText },
  empty: { gap: 10, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  chipHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  chipText: { fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  thread: { gap: 12 },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14 },
  userBubble: { alignSelf: 'flex-end', backgroundColor: Colors.brandGreen, borderBottomRightRadius: 4 },
  userText: { fontSize: 15, lineHeight: 22, color: '#FFFFFF' },
  botBubble: { alignSelf: 'flex-start', backgroundColor: Colors.surface, borderWidth: 1, borderColor: Colors.border, borderBottomLeftRadius: 4, gap: 4 },
  botName: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen },
  typing: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  errorBubble: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'flex-start', gap: 8, backgroundColor: Colors.errorBg },
  errorText: { flexShrink: 1, fontSize: 14, lineHeight: 20, color: Colors.errorText },
  composer: { gap: 8, padding: 10, borderRadius: 14, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  composerFocus: { borderColor: Colors.brandGreen },
  input: { minHeight: 72, maxHeight: 200, fontSize: 15, lineHeight: 22, color: Colors.slateDark, textAlignVertical: 'top', outlineStyle: 'none' },
  composerBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  counter: { fontSize: 12, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  sendBtn: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, borderRadius: 10, backgroundColor: Colors.brandGreen },
  sendBtnHover: { backgroundColor: Colors.brandGreenPressed },
  sendText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
  disabled: { opacity: 0.5 },
  consent: { gap: 10, padding: 18, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, backgroundColor: Colors.surface },
  consentText: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.slateDark },
  consentDone: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', columnGap: 8 },
  selfStart: { alignSelf: 'flex-start' },
  linkBtn: { minHeight: 44, justifyContent: 'center' },
  linkText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
  dangerLink: { fontSize: 14, fontWeight: '600', color: Colors.errorText },
  infoText: { fontSize: 14, lineHeight: 20, color: Colors.successText },
});
