import React from 'react';
import { Text, Linking, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

const URL_REGEX =
  /(https?:\/\/[^\s]+|www\.[^\s]+)/gi;

export default function LinkifiedText({
  text,
  style,
  numberOfLines,
  selectable = true,
}) {
  if (!text) return null;

  const parts = text.split(URL_REGEX);

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      selectable={selectable}
    >
      {parts.map((part, i) => {
        const isUrl = /^(https?:\/\/|www\.)/i.test(part);
        if (isUrl) {
          const href = part.startsWith('http') ? part : `https://${part}`;
          return (
            <Text
              key={i}
              style={styles.link}
              onPress={() => Linking.openURL(href).catch(() => {})}
            >
              {part}
            </Text>
          );
        }
        return <Text key={i}>{part}</Text>;
      })}
    </Text>
  );
}

const styles = StyleSheet.create({
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
    fontWeight: '600',
  },
});