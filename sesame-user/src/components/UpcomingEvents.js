import React from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { radius, spacing, useColors } from '../theme';
import { formatEvent } from '../utils/format';

/** Compact list of the next events (feed side column, agenda list). */
export default function UpcomingEvents({ events, loading, onOpen, title = 'Prochains événements', limit = 6 }) {
  const colors = useColors();
  return (
    <View style={{ gap: spacing.sm }}>
      <Text style={{ fontSize: 16, fontWeight: '800', color: colors.text }} accessibilityRole="header">{title}</Text>
      {loading ? <ActivityIndicator color={colors.primary} /> : null}
      {!loading && !events?.length ? <Text style={{ color: colors.textMuted }}>Aucun événement à venir.</Text> : null}
      {events?.slice(0, limit).map((news) => {
        const start = new Date(news.eventStart);
        return (
          <Pressable
            key={news.id}
            accessibilityRole="button"
            accessibilityLabel={`${news.titre}, ${formatEvent(news.eventStart, news.eventEnd)}`}
            onPress={() => onOpen(news)}
            style={({ pressed }) => ({
              flexDirection: 'row', gap: spacing.md, padding: spacing.md, borderRadius: radius.md, minHeight: 56,
              backgroundColor: pressed ? colors.cardMuted : colors.card, borderWidth: 1, borderColor: colors.border,
            })}
          >
            <View style={{ width: 46, alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm, backgroundColor: colors.primarySoft, paddingVertical: 4 }}>
              <Text style={{ color: colors.primary, fontWeight: '800', fontSize: 18 }}>{start.getDate()}</Text>
              <Text style={{ color: colors.primary, fontSize: 11, textTransform: 'uppercase' }}>{start.toLocaleDateString('fr-FR', { month: 'short' })}</Text>
            </View>
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <Text numberOfLines={2} style={{ color: colors.text, fontWeight: '700' }}>{news.titre}</Text>
              <Text numberOfLines={1} style={{ color: colors.textMuted, fontSize: 12 }}>{formatEvent(news.eventStart, news.eventEnd)}{news.location ? ` · ${news.location}` : ''}</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}
