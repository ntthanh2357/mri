import React from 'react';
import { View, Text, Pressable, StyleSheet, useWindowDimensions } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';

// UC-PAT-05 — Thẻ "Lượt khám" của bệnh nhân: 6 bước (Tiếp đón → Hoàn tất), bước đang ở, câu nói rõ cần làm gì tiếp.
// Dữ liệu đã được máy chủ quy đổi từ trạng thái nội bộ (services/visitProgress.service.js).

const WIDE = 720; // từ bề ngang này: các bước xếp ngang
const fmtTime = (d) => (d ? new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) : '');
const isToday = (d) => d && new Date(d).toDateString() === new Date().toDateString();

const STATE_TEXT = { done: 'đã xong', current: 'đang ở bước này', todo: 'chưa tới', skipped: 'không cần' };

const Dot = ({ state, index }) => (
  <View style={[styles.dot, styles[`dot_${state}`]]}>
    {state === 'done' ? <Feather name="check" size={14} color="#FFFFFF" />
      : state === 'skipped' ? <Feather name="minus" size={14} color={Colors.slateMuted} />
        : <Text style={[styles.dotText, state === 'current' && styles.dotTextCurrent]}>{index + 1}</Text>}
  </View>
);

const Step = ({ step, index, total, wide }) => (
  <View style={wide ? styles.stepWide : styles.stepTall} accessible
    accessibilityLabel={`Bước ${index + 1} trên ${total}: ${step.label}, ${STATE_TEXT[step.state]}${step.at ? `, lúc ${fmtTime(step.at)}` : ''}`}>
    <View style={wide ? styles.stepHeadWide : styles.stepHeadTall}>
      <Dot state={step.state} index={index} />
      {wide && index < total - 1 ? <View style={[styles.lineWide, step.state === 'done' && styles.lineDone]} /> : null}
    </View>
    <View style={wide ? styles.stepTextWide : styles.grow}>
      <Text style={[styles.stepLabel, step.state === 'current' && styles.stepLabelCurrent, (step.state === 'todo' || step.state === 'skipped') && styles.stepLabelMuted]}>
        {step.label}
      </Text>
      {step.state === 'skipped' ? <Text style={styles.stepMeta}>Không cần</Text>
        : step.at ? <Text style={styles.stepMeta}>{fmtTime(step.at)}</Text> : null}
    </View>
  </View>
);

/** `progress`: dữ liệu từ useVisitProgress; `onOpenConsent`, `onOpenFilms`, `onOpenPrep`: chuyển màn. */
const VisitProgress = ({ progress, onOpenConsent, onOpenFilms, onOpenPrep }) => {
  const wide = useWindowDimensions().width >= WIDE;
  if (!progress) return null;
  const { steps, message, finished, cancelled, mri, current, date } = progress;
  const badge = cancelled ? { text: 'Đã huỷ', bg: Colors.background, fg: Colors.slateMuted, icon: 'x-circle' }
    : finished ? { text: 'Hoàn tất', bg: Colors.successBg, fg: Colors.successText, icon: 'check-circle' }
      : { text: 'Đang diễn ra', bg: Colors.infoBg, fg: Colors.infoText, icon: 'activity' };

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <Feather name="map" size={18} color={Colors.brandGreen} />
        <Text style={styles.title}>{isToday(date) ? 'Lượt khám hôm nay' : `Lượt khám ngày ${new Date(date).toLocaleDateString('vi-VN')}`}</Text>
        <View style={[styles.badge, { backgroundColor: badge.bg }]}>
          <Feather name={badge.icon} size={13} color={badge.fg} />
          <Text style={[styles.badgeText, { color: badge.fg }]}>{badge.text}</Text>
        </View>
      </View>

      <View style={wide ? styles.stepsWide : styles.stepsTall} accessibilityRole="list">
        {steps.map((s, i) => <Step key={s.key} step={s} index={i} total={steps.length} wide={wide} />)}
      </View>

      <View style={[styles.message, cancelled && styles.messageMuted]} accessibilityLiveRegion="polite">
        <Feather name={cancelled ? 'info' : 'navigation'} size={16} color={cancelled ? Colors.slateMuted : Colors.infoText} />
        <Text style={[styles.messageText, cancelled && styles.messageTextMuted]}>{message}</Text>
      </View>

      {current === 'imaging' && onOpenPrep ? (
        <Pressable onPress={onOpenPrep} accessibilityRole="button" style={({ hovered }) => [styles.action, styles.actionPrep, hovered && styles.actionPrepHover]}>
          <Feather name={mri.screened || mri.screening ? 'check-square' : 'clipboard'} size={16} color={Colors.brandGreen} />
          <Text style={[styles.actionText, styles.actionTextPrep]}>
            {mri.screened ? 'Kỹ thuật viên đã kiểm tra an toàn. Xem lại hướng dẫn trước khi chụp'
              : mri.screening ? 'Bạn đã khai phiếu an toàn MRI. Xem hướng dẫn trước khi chụp'
                : 'Đọc hướng dẫn chuẩn bị và khai phiếu an toàn MRI trước khi chụp'}
          </Text>
          <Text style={styles.actionLinkPrep}>{mri.screening || mri.screened ? 'Xem' : 'Mở'}</Text>
        </Pressable>
      ) : null}
      {mri?.consentPending ? (
        <Pressable onPress={onOpenConsent} accessibilityRole="button" style={({ hovered }) => [styles.action, styles.actionWarn, hovered && styles.actionWarnHover]}>
          <Feather name="edit-3" size={16} color={Colors.warningText} />
          <Text style={[styles.actionText, styles.actionTextWarn]}>Bạn cần ký phiếu đồng thuận tiêm thuốc cản quang trước khi chụp</Text>
          <Text style={styles.actionLinkWarn}>Mở phiếu</Text>
        </Pressable>
      ) : null}
      {mri?.ordered && (current === 'result' || finished) ? (
        <Pressable onPress={onOpenFilms} accessibilityRole="link" hitSlop={6} style={styles.link}>
          <Text style={styles.linkText}>Xem phim MRI & CT</Text>
          <Feather name="arrow-right" size={14} color={Colors.brandGreen} />
        </Pressable>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  card: { backgroundColor: Colors.surface, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, padding: 18, gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  title: { flex: 1, minWidth: 160, fontSize: 17, fontWeight: '700', color: Colors.brandNavy },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 13, fontWeight: '600' },
  grow: { flex: 1, minWidth: 0 },

  stepsWide: { flexDirection: 'row' },
  stepsTall: { gap: 2 },
  stepWide: { flex: 1, gap: 8 },
  stepTall: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 36 },
  stepHeadWide: { flexDirection: 'row', alignItems: 'center' },
  stepHeadTall: { width: 28, alignItems: 'center' },
  stepTextWide: { paddingRight: 8 },
  lineWide: { flex: 1, height: 2, marginHorizontal: 6, borderRadius: 1, backgroundColor: Colors.border },
  lineDone: { backgroundColor: Colors.brandGreen },

  dot: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  dot_done: { backgroundColor: Colors.brandGreen, borderColor: Colors.brandGreen },
  dot_current: { backgroundColor: Colors.brandGreenSoft, borderColor: Colors.brandGreen },
  dot_todo: { backgroundColor: Colors.surface, borderColor: Colors.borderStrong },
  dot_skipped: { backgroundColor: Colors.background, borderColor: Colors.border, borderStyle: 'dashed' },
  dotText: { fontSize: 13, fontWeight: '700', color: Colors.slateMuted, fontVariant: ['tabular-nums'] },
  dotTextCurrent: { color: Colors.brandGreen },

  stepLabel: { fontSize: 14, fontWeight: '600', color: Colors.slateDark },
  stepLabelCurrent: { color: Colors.brandGreen, fontWeight: '700' },
  stepLabelMuted: { color: Colors.slateMuted, fontWeight: '500' },
  stepMeta: { fontSize: 12, color: Colors.slateMuted, fontVariant: ['tabular-nums'] },

  message: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10, backgroundColor: Colors.infoBg },
  messageMuted: { backgroundColor: Colors.background },
  messageText: { flex: 1, fontSize: 15, lineHeight: 22, color: Colors.infoText },
  messageTextMuted: { color: Colors.slateDark },

  action: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 10, minHeight: 48, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  actionWarn: { backgroundColor: Colors.warningBg, borderColor: Colors.warningBg },
  actionPrep: { backgroundColor: Colors.brandGreenSoft, borderColor: Colors.brandGreenSoft },
  actionPrepHover: { borderColor: Colors.brandGreen },
  actionTextPrep: { color: Colors.slateDark },
  actionLinkPrep: { fontSize: 14, fontWeight: '700', color: Colors.brandGreen },
  actionWarnHover: { borderColor: Colors.warningText },
  actionText: { flex: 1, minWidth: 180, fontSize: 14, lineHeight: 20 },
  actionTextWarn: { color: Colors.warningText },
  actionLinkWarn: { fontSize: 14, fontWeight: '700', color: Colors.warningText },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 32 },
  linkText: { fontSize: 14, fontWeight: '600', color: Colors.brandGreen },
});

export default VisitProgress;
