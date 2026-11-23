import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api, { errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { withOfflineCache } from '../utils/offlineCache';
import { timeAgo } from '../utils/format';
import StatusBadge from '../components/StatusBadge';
import { Button, Chip, EmptyState, ErrorState, IconButton, Loading, OfflineBanner } from '../components/ui';

const FILTERS = [['active', 'En cours'], ['open', 'Ouverts'], ['in_progress', 'Pris en charge'], ['closed', 'Fermés'], ['all', 'Toutes']];

export default function TicketsScreen({ navigation }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const [filter, setFilter] = useState('active');
  const [search, setSearch] = useState('');
  const tickets = useQuery({
    queryKey: ['tickets'],
    queryFn: withOfflineCache('tickets', () => api.get('/tickets', { params: { pageSize: 100 } }).then((r) => r.data)),
  });

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => <IconButton icon="add-circle" color={colors.primary} size={28} accessibilityLabel="Nouvelle demande" onPress={() => navigation.navigate('NewTicket')} />,
    });
  }, [navigation, colors.primary]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return (tickets.data?.content || []).filter((ticket) => {
      if (filter === 'active' && ticket.status === 'closed') return false;
      if (!['active', 'all'].includes(filter) && ticket.status !== filter) return false;
      return !term || ticket.title.toLowerCase().includes(term) || String(ticket.id) === term.replace('#', '');
    });
  }, [tickets.data, filter, search]);

  if (tickets.isPending) return <Loading />;
  if (tickets.isError) return <ErrorState message={errorMessage(tickets.error)} onRetry={tickets.refetch} />;

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={visible}
      keyExtractor={(ticket) => String(ticket.id)}
      refreshControl={<RefreshControl refreshing={tickets.isRefetching} onRefresh={tickets.refetch} colors={[colors.primary]} tintColor={colors.primary} />}
      ListHeaderComponent={(
        <View style={{ gap: spacing.md, marginBottom: spacing.md }}>
          <OfflineBanner savedAt={tickets.data?.fromCache} />
          <Button title="Nouvelle demande" icon="add" onPress={() => navigation.navigate('NewTicket')} />
          <View style={styles.search}>
            <Ionicons name="search" size={18} color={colors.textMuted} />
            <TextInput value={search} onChangeText={setSearch} placeholder="Rechercher (titre ou n°)" placeholderTextColor={colors.textMuted} accessibilityLabel="Rechercher une demande" style={styles.searchInput} />
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            {FILTERS.map(([key, label]) => <Chip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />)}
          </ScrollView>
        </View>
      )}
      ItemSeparatorComponent={() => <View style={{ height: spacing.sm }} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`Demande ${item.id}, ${item.title}${item.unreadCount ? `, ${item.unreadCount} nouveau(x) message(s)` : ''}`}
          onPress={() => navigation.navigate('TicketDetail', { id: item.id })}
          style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardMuted }]}
        >
          <View style={{ flex: 1, gap: 4 }}>
            <View style={styles.rowTop}>
              <Text style={styles.number}>#{item.id}</Text>
              <Text numberOfLines={1} style={[styles.title, item.unreadCount ? { fontWeight: '800' } : null]}>{item.title}</Text>
            </View>
            <Text style={styles.meta} numberOfLines={1}>{item.department?.name} · {timeAgo(item.updatedAt)}</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, alignItems: 'center' }}>
              <StatusBadge status={item.status} />
              {item.unreadCount ? (
                <View style={styles.unread}><Ionicons name="chatbubble" size={12} color="#fff" /><Text style={styles.unreadText}>{item.unreadCount} nouveau{item.unreadCount > 1 ? 'x' : ''}</Text></View>
              ) : null}
            </View>
          </View>
          <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
        </Pressable>
      )}
      ListEmptyComponent={(
        <EmptyState
          icon="chatbubbles-outline"
          title={tickets.data?.content.length ? 'Aucune demande dans ce filtre' : 'Aucune demande'}
          message="Une question pour la scolarité, les stages ou l’informatique ? Ouvrez une demande, le service concerné vous répondra ici."
        />
      )}
    />
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, width: '100%', maxWidth: 680, alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, minHeight: MIN_TOUCH },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg, backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border },
  rowTop: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  number: { color: colors.textMuted, fontWeight: '600' },
  title: { flex: 1, color: colors.text, fontWeight: '600', fontSize: 15 },
  meta: { color: colors.textMuted, fontSize: 13 },
  unread: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.danger, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  unreadText: { color: '#fff', fontSize: 12, fontWeight: '700' },
});
