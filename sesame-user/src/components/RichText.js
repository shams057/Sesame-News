import React from 'react';
import { Linking, Platform, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { spacing, useColors } from '../theme';

/**
 * Same lightweight formatting as the back-office preview:
 *   **gras**, *italique*, lignes « - » = puces, ligne vide = paragraphe, URLs cliquables.
 */
export const INLINE_PATTERN = /(\*\*[^*]+\*\*|\*[^*\s][^*]*\*|https?:\/\/[^\s<>"]+[^\s<>".,;:!?)\]]|www\.[^\s<>"]+[^\s<>".,;:!?)\]])/g;

function openLink(href) {
  if (Platform.OS === 'web') globalThis.open?.(href, '_blank', 'noopener');
  else WebBrowser.openBrowserAsync(href).catch(() => Linking.openURL(href));
}

export function parseBlocks(text) {
  return String(text || '').replace(/\r\n/g, '\n').split(/\n{2,}/).map((block) => {
    const lines = block.split('\n');
    if (lines.every((line) => /^\s*[-•]\s+/.test(line))) return { type: 'list', items: lines.map((line) => line.replace(/^\s*[-•]\s+/, '')) };
    return { type: 'paragraph', text: block };
  });
}

function Inline({ text, linkColor }) {
  return text.split(INLINE_PATTERN).filter(Boolean).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <Text key={index} style={{ fontWeight: '700' }}>{part.slice(2, -2)}</Text>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <Text key={index} style={{ fontStyle: 'italic' }}>{part.slice(1, -1)}</Text>;
    if (/^(https?:\/\/|www\.)/.test(part)) {
      const href = part.startsWith('http') ? part : `https://${part}`;
      return <Text key={index} accessibilityRole="link" onPress={() => openLink(href)} style={{ color: linkColor, textDecorationLine: 'underline' }}>{part}</Text>;
    }
    return part;
  });
}

/** `compact` renders a plain excerpt (feed cards): formatting markers removed, line-clamped. */
export default function RichText({ text, style, compact, numberOfLines }) {
  const colors = useColors();
  if (compact) {
    const plain = String(text || '').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*\s][^*]*)\*/g, '$1').replace(/^\s*[-•]\s+/gm, '• ');
    return <Text style={style} numberOfLines={numberOfLines}><Inline text={plain} linkColor={colors.primary} /></Text>;
  }
  return (
    <View style={{ gap: spacing.sm }}>
      {parseBlocks(text).map((block, index) => (block.type === 'list' ? (
        <View key={index} style={{ gap: 4 }}>
          {block.items.map((item, itemIndex) => (
            <View key={itemIndex} style={{ flexDirection: 'row', gap: 8 }}>
              <Text style={style}>•</Text>
              <Text style={[style, { flex: 1 }]}><Inline text={item} linkColor={colors.primary} /></Text>
            </View>
          ))}
        </View>
      ) : (
        <Text key={index} style={style}><Inline text={block.text} linkColor={colors.primary} /></Text>
      )))}
    </View>
  );
}
