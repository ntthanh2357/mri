import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Feather } from '@expo/vector-icons';
import Colors from '../../constants/colors';
import { lineOf, locateCheck } from '../../utils/recordShare';

// Kết quả AI đọc giấy tờ 2 lần độc lập rồi so với nhau. Chỗ nào 2 lần đọc khác nhau là chỗ dễ sai nhất:
// bệnh nhân bấm vào để tới đúng chỗ đó trong ô chữ, nhìn ảnh rồi sửa. Hai lần đọc giống nhau KHÔNG có nghĩa là
// chắc chắn đúng (cả 2 có thể cùng sai), nên luôn nhắc so lại với ảnh.

const Notice = ({ tone, icon, children }) => (
  <View style={[styles.notice, tone === 'danger' ? styles.danger : tone === 'warn' ? styles.warn : tone === 'ok' ? styles.ok : styles.neutral]}>
    <Feather name={icon} size={16} color={tone === 'danger' ? Colors.errorText : tone === 'warn' ? Colors.warningText : tone === 'ok' ? Colors.successText : Colors.slateMuted} />
    <View style={styles.grow}>{children}</View>
  </View>
);

const REASONS = { blurry: 'mờ', small: 'nhỏ hoặc chụp quá xa', dark: 'thiếu sáng' };
const why = (reasons) => (reasons || []).map((r) => REASONS[r]).filter(Boolean).join(', ');

const describe = (c) => {
  if (!c.primary) return <>Lần đọc thứ hai có thêm <Text style={styles.quote}>{c.other}</Text> ở đây.</>;
  if (!c.other) return <>Chỉ lần đọc thứ nhất thấy <Text style={styles.quote}>{c.primary}</Text>.</>;
  return <>Đang ghi <Text style={styles.quote}>{c.primary}</Text>, lần đọc thứ hai ra <Text style={styles.quote}>{c.other}</Text>.</>;
};

/**
 * `review`: { verified, tooMany, truncated } của giấy tờ; `checks`: các chỗ còn cần kiểm tra (đã dời vị trí theo chỗ đã sửa);
 * `text`: phần chữ hiện tại; `onSelect(range)`: bôi chọn chỗ đó trong ô chữ; `onApply(index)`: đổi theo lần đọc thứ hai.
 */
const ReadingReview = ({ review, checks, text, onSelect, onApply }) => (
  <View style={styles.stack}>
    {review.quality === 'poor' ? (
      <Notice tone="danger" icon="alert-octagon">
        <Text style={styles.title}>Ảnh này chất lượng kém{why(review.qualityReasons) ? ` (${why(review.qualityReasons)})` : ''}.</Text>
        <Text style={styles.text}>Máy rất dễ ghi sai, kể cả tự bịa ra chữ và số nghe hợp lý. Hãy so TỪNG con số, tên thuốc, họ tên với ảnh trước khi lưu, hoặc chụp lại ảnh rõ hơn.</Text>
      </Notice>
    ) : review.quality === 'fair' ? (
      <Notice icon="alert-circle">
        <Text style={styles.text}>Ảnh hơi {why(review.qualityReasons) || 'khó đọc'}. Hãy kiểm tra kỹ các con số và tên thuốc.</Text>
      </Notice>
    ) : null}
    {review.truncated ? (
      <Notice tone="warn" icon="scissors">
        <Text style={styles.text}>Giấy tờ dài hơn mức máy đọc được trong 1 lần, nên phần chữ có thể thiếu đoạn cuối. Hãy chụp từng trang riêng.</Text>
      </Notice>
    ) : null}
    {!review.verified ? (
      <Notice icon="help-circle">
        <Text style={styles.text}>Lần này máy chỉ đọc được 1 lần nên chưa tự kiểm tra chéo được. Hãy so kỹ toàn bộ phần chữ với ảnh.</Text>
      </Notice>
    ) : review.tooMany ? (
      <Notice tone="warn" icon="alert-triangle">
        <Text style={styles.text}>Hai lần đọc của máy khác nhau ở rất nhiều chỗ, có thể do ảnh mờ, tối hoặc chụp lệch. Hãy so lại toàn bộ với ảnh, hoặc chụp lại rõ hơn.</Text>
      </Notice>
    ) : checks.length ? (
      <Notice tone="warn" icon="alert-triangle">
        <Text style={styles.title}>Máy đọc 2 lần và thấy khác nhau ở {checks.length} chỗ. Hãy nhìn ảnh rồi sửa cho đúng:</Text>
        {checks.map((c, i) => {
          const at = locateCheck(text, c);
          return (
            <View key={`${c.start}-${c.primary}-${c.other}`} style={styles.item}>
              <Pressable onPress={at ? () => onSelect(at) : undefined} disabled={!at} accessibilityRole="button"
                accessibilityLabel={`Tới chỗ cần kiểm tra số ${i + 1} trong ô chữ`}
                style={({ hovered }) => [styles.itemMain, hovered && at && styles.itemHover]}>
                <Text style={styles.text}>
                  <Text style={styles.line}>{at ? `Dòng ${lineOf(text, at.start)}: ` : 'Đã sửa: '}</Text>
                  {describe(c)}
                </Text>
              </Pressable>
              {c.other && at ? (
                <Pressable onPress={() => onApply(i)} accessibilityRole="button" style={({ hovered }) => [styles.apply, hovered && styles.applyHover]}>
                  <Text style={styles.applyText} numberOfLines={1}>Đổi thành “{c.other}”</Text>
                </Pressable>
              ) : null}
            </View>
          );
        })}
        <Text style={styles.small}>Những chỗ khác 2 lần đọc giống nhau, nhưng bạn vẫn nên xem lướt lại với ảnh.</Text>
      </Notice>
    ) : (
      <Notice tone="ok" icon="check-circle">
        <Text style={styles.text}>Máy đã đọc 2 lần độc lập và 2 lần cho kết quả giống nhau. Bạn vẫn nên xem lướt lại với ảnh trước khi lưu.</Text>
      </Notice>
    )}
  </View>
);

const styles = StyleSheet.create({
  stack: { gap: 8 },
  grow: { flex: 1, minWidth: 0, gap: 6 },
  notice: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, padding: 12, borderRadius: 10 },
  danger: { backgroundColor: Colors.errorBg },
  warn: { backgroundColor: Colors.warningBg },
  ok: { backgroundColor: Colors.successBg },
  neutral: { backgroundColor: Colors.background, borderWidth: 1, borderColor: Colors.border },
  title: { fontSize: 14, lineHeight: 20, fontWeight: '700', color: Colors.slateDark },
  text: { fontSize: 14, lineHeight: 20, color: Colors.slateDark },
  small: { fontSize: 13, lineHeight: 18, color: Colors.slateMuted },
  line: { fontWeight: '700' },
  quote: { fontWeight: '700', backgroundColor: Colors.surface },
  item: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 8, paddingTop: 6, borderTopWidth: 1, borderTopColor: Colors.border },
  itemMain: { flex: 1, minWidth: 200, minHeight: 44, justifyContent: 'center', borderRadius: 8, paddingHorizontal: 4 },
  itemHover: { backgroundColor: Colors.surface },
  apply: { minHeight: 36, maxWidth: 220, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 8, borderWidth: 1, borderColor: Colors.borderStrong, backgroundColor: Colors.surface },
  applyHover: { borderColor: Colors.brandGreen, backgroundColor: Colors.brandGreenSoft },
  applyText: { fontSize: 13, fontWeight: '600', color: Colors.brandGreen },
});

export default ReadingReview;
