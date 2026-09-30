import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

/**
 * Utility to clean HTML tags from strings for plain-text reports
 */
export const stripHtml = (htmlStr) => {
  if (!htmlStr) return '';
  return htmlStr
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<strong[^>]*>/gi, '')
    .replace(/<\/strong>/gi, '')
    .replace(/<[^>]+>/g, '')
    .trim();
};

/**
 * FormattedConsensusMessage
 * Parses and renders consensus/privacy guard messages cleanly in React Native
 * without exposing raw HTML tags like <strong>, <br>.
 */
const FormattedConsensusMessage = ({ message, style }) => {
  if (!message) return null;

  // Split by <br>, <br/>, or newlines
  const rawLines = message.split(/<br\s*\/?>|\n/gi);

  return (
    <View style={[styles.container, style]}>
      {rawLines.map((line, lineIndex) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        // Parse <strong> tags inside the line
        const parts = [];
        const regex = /<strong(?:\s+style=['"]color:\s*([^'"]+)['"])?>([\s\S]*?)<\/strong>|([^<]+)/gi;
        let match;
        let partIndex = 0;

        while ((match = regex.exec(trimmed)) !== null) {
          if (match[2] !== undefined) {
            // Strong tag matched
            const rawColor = match[1];
            const isWhite = rawColor && (rawColor.toLowerCase() === '#fff' || rawColor.toLowerCase() === '#ffffff');
            const textColor = rawColor && !isWhite ? rawColor : '#0F172A';

            parts.push(
              <Text key={`bold-${partIndex++}`} style={[styles.boldText, { color: textColor }]}>
                {match[2]}{' '}
              </Text>
            );
          } else if (match[3]) {
            // Plain text segment
            parts.push(
              <Text key={`text-${partIndex++}`} style={styles.normalText}>
                {match[3]}
              </Text>
            );
          }
        }

        return (
          <Text key={`line-${lineIndex}`} style={styles.line}>
            {parts.length > 0 ? parts : stripHtml(trimmed)}
          </Text>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FEF3C7',
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginVertical: 6,
  },
  line: {
    fontSize: 12,
    lineHeight: 18,
    color: '#92400E',
    marginBottom: 2,
  },
  normalText: {
    fontSize: 12,
    color: '#78350F',
  },
  boldText: {
    fontSize: 12,
    fontWeight: '700',
  },
});

export default FormattedConsensusMessage;
