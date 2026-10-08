import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { parseSimpleMarkdown } from '../utils/simpleMarkdown';
import Colors from '../constants/colors';

/**
 * Hiển thị văn bản AI có markdown tối giản (**đậm**, gạch đầu dòng, đánh số, tiêu đề).
 * `tone="dark"` cho nền tối (navy), mặc định cho nền sáng.
 */
const SimpleMarkdownText = ({ text, tone = 'light', style }) => {
  const t = tone === 'dark' ? dark : light;
  const renderSegments = (segments) =>
    segments.map((s, i) => (
      <Text key={i} style={s.bold ? t.bold : null}>{s.text}</Text>
    ));

  return (
    <View style={[styles.container, style]}>
      {parseSimpleMarkdown(text).map((b, i) => {
        if (b.type === 'heading') {
          return <Text key={i} style={[styles.heading, t.heading]} accessibilityRole="header">{renderSegments(b.segments)}</Text>;
        }
        if (b.type === 'bullet' || b.type === 'numbered') {
          return (
            <View key={i} style={styles.listRow}>
              <Text style={[styles.marker, t.marker]}>{b.type === 'bullet' ? '•' : b.marker}</Text>
              <Text style={[styles.body, t.body, styles.listText]}>{renderSegments(b.segments)}</Text>
            </View>
          );
        }
        return <Text key={i} style={[styles.body, t.body]}>{renderSegments(b.segments)}</Text>;
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: { gap: 10 },
  heading: { fontSize: 16, fontWeight: '700', marginTop: 6 },
  body: { fontSize: 15, lineHeight: 24 },
  listRow: { flexDirection: 'row', gap: 8, paddingLeft: 4 },
  marker: { fontSize: 15, lineHeight: 24, fontWeight: '700', minWidth: 14 },
  listText: { flex: 1 },
});

const light = StyleSheet.create({
  heading: { color: Colors.brandNavy },
  body: { color: '#334155' },
  bold: { fontWeight: '700', color: Colors.slateDark },
  marker: { color: Colors.brandGreen },
});

const dark = StyleSheet.create({
  heading: { color: Colors.brandMint },
  body: { color: '#E2E8F0' },
  bold: { fontWeight: '700', color: '#FFFFFF' },
  marker: { color: Colors.brandGreenOnDark },
});

export default SimpleMarkdownText;
