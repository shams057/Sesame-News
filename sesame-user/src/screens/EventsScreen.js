import React, { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import api, { errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { withOfflineCache } from '../utils/offlineCache';
import UpcomingEvents from '../components/UpcomingEvents';
import { ErrorState, IconButton, OfflineBanner } from '../components/ui';

const WEEKDAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const dayKey = (date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Agenda: month grid (dots on days with events) + list for the selected day. */
export default function EventsScreen({ navigation }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  const [cursor, setCursor] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const [selected, setSelected] = useState(null);

  const monthStart = cursor;
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0, 23, 59, 59);
  const month = useQuery({
    queryKey: ['events', 'month', monthStart.toISOString()],
    queryFn: () => api.get('/feed/events', { params: { from: monthStart.toISOString(), to: monthEnd.toISOString(), limit: 200 } }).then((r) => r.data),
  });
  const upcoming = useQuery({
    queryKey: ['events'],
    queryFn: withOfflineCache('events', () => api.get('/feed/events').then((r) => r.data)),
  });

  const byDay = useMemo(() => {
    const map = new Map();
    (month.data || []).forEach((news) => {
      const start = new Date(news.eventStart);
      const end = news.eventEnd ? new Date(news.eventEnd) : start;
      // Multi-day events appear on every day they cover.
      for (let d = new Date(start.getFullYear(), start.getMonth(), start.getDate()); d <= end; d.setDate(d.getDate() + 1)) {
        const key = dayKey(d);
        map.set(key, [...(map.get(key) || []), news]);
      }
    });
    return map;
  }, [month.data]);

  const offset = (new Date(cursor.getFullYear(), cursor.getMonth(), 1).getDay() + 6) % 7;
  const days = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0).getDate();
  const cells = [...Array(offset).fill(null), ...Array.from({ length: days }, (_, i) => new Date(cursor.getFullYear(), cursor.getMonth(), i + 1))];
  const label = cursor.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const selectedEvents = selected ? byDay.get(dayKey(selected)) || [] : null;
  const open = (news) => navigation.navigate('NewsDetail', { id: news.id, news });

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={month.isRefetching || upcoming.isRefetching} onRefresh={() => { month.refetch(); upcoming.refetch(); }} colors={[colors.primary]} tintColor={colors.primary} />}
    >
      <OfflineBanner savedAt={upcoming.data?.fromCache} />
      <View style={styles.calendar}>
        <View style={styles.monthRow}>
          <IconButton icon="chevron-back" accessibilityLabel="Mois précédent" color={colors.primary} onPress={() => { setSelected(null); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1)); }} />
          <Text style={styles.month} accessibilityRole="header">{label}</Text>
          <IconButton icon="chevron-forward" accessibilityLabel="Mois suivant" color={colors.primary} onPress={() => { setSelected(null); setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1)); }} />
        </View>
        <View style={styles.grid}>
          {WEEKDAYS.map((day, index) => <Text key={`${day}${index}`} style={styles.weekday}>{day}</Text>)}
          {cells.map((date, index) => {
            if (!date) return <View key={`empty-${index}`} style={styles.cell} />;
            const events = byDay.get(dayKey(date)) || [];
            const isToday = date.getTime() === today.getTime();
            const isSelected = selected && date.getTime() === selected.getTime();
            return (
              <Pressable
                key={date.toISOString()}
                accessibilityRole="button"
                accessibilityState={{ selected: Boolean(isSelected) }}
                accessibilityLabel={`${date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}${events.length ? `, ${events.length} événement(s)` : ''}`}
                onPress={() => setSelected(isSelected ? null : date)}
                style={[styles.cell, isSelected && styles.cellSelected]}
              >
                <Text style={[styles.dayText, isToday && styles.today, isSelected && { color: colors.onPrimary }]}>{date.getDate()}</Text>
                {events.length ? <View style={[styles.dot, isSelected && { backgroundColor: colors.onPrimary }]} /> : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {month.isError ? <ErrorState message={errorMessage(month.error)} onRetry={month.refetch} /> : null}
      {selectedEvents ? (
        <UpcomingEvents
          title={selected.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
          events={selectedEvents}
          onOpen={open}
          limit={50}
        />
      ) : (
        <UpcomingEvents events={upcoming.data} loading={upcoming.isPending} onOpen={open} limit={30} />
      )}
    </ScrollView>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 680, alignSelf: 'center' },
  calendar: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  month: { fontSize: 17, fontWeight: '800', color: colors.text, textTransform: 'capitalize' },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  weekday: { width: `${100 / 7}%`, textAlign: 'center', color: colors.textMuted, fontWeight: '700', fontSize: 12, paddingVertical: 6 },
  cell: { width: `${100 / 7}%`, minHeight: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md },
  cellSelected: { backgroundColor: colors.primary },
  dayText: { color: colors.text, fontWeight: '600' },
  today: { color: colors.primary, fontWeight: '900', textDecorationLine: 'underline' },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.accent, marginTop: 2 },
});
