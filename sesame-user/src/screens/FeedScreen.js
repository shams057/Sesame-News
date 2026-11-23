import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api, { errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { readCache, writeCache } from '../utils/offlineCache';
import NewsCard from '../components/NewsCard';
import UpcomingEvents from '../components/UpcomingEvents';
import { Chip, EmptyState, ErrorState, Loading, OfflineBanner } from '../components/ui';

const FILTERS = [
  ['all', 'Tout'],
  ['unseen', 'Non lus'],
  ['bookmarks', 'Enregistrés'],
  ['events', 'Événements'],
  ['pinned', 'Épinglés'],
  ['documents', 'Documents'],
];
const PAGE_SIZE = 10;
const VIEWABILITY = { itemVisiblePercentThreshold: 60, minimumViewTime: 1200 };

function useDebounced(value, delay = 350) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

export default function FeedScreen({ navigation }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const { width } = useWindowDimensions();
  const wide = width >= 1100;
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const q = useDebounced(search.trim());
  const cacheKey = filter === 'all' && !q ? 'feed' : null;

  const feed = useInfiniteQuery({
    queryKey: ['feed', filter, q],
    initialPageParam: 0,
    queryFn: async ({ pageParam }) => {
      try {
        const { data } = await api.get('/feed', { params: { page: pageParam, pageSize: PAGE_SIZE, filter, q: q || undefined } });
        if (pageParam === 0 && cacheKey) writeCache(cacheKey, data);
        return data;
      } catch (error) {
        const cached = pageParam === 0 && cacheKey && !error.response ? await readCache(cacheKey) : null;
        if (!cached) throw error;
        return { ...cached.value, totalPages: 1, fromCache: cached.savedAt };
      }
    },
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  });
  const events = useQuery({ queryKey: ['events'], queryFn: () => api.get('/feed/events').then((r) => r.data), enabled: wide });

  const items = useMemo(() => feed.data?.pages.flatMap((page) => page.content) ?? [], [feed.data]);

  // Items that stay on screen for a moment are marked as seen (batched).
  const queryClient = useQueryClient();
  const pendingSeen = useRef(new Set());
  const flushTimer = useRef(null);
  const onViewableItemsChanged = useCallback(({ viewableItems }) => {
    viewableItems.forEach(({ item }) => { if (item && item.seen === false) pendingSeen.current.add(item.id); });
    clearTimeout(flushTimer.current);
    flushTimer.current = setTimeout(() => {
      const ids = [...pendingSeen.current];
      pendingSeen.current.clear();
      if (ids.length) api.post('/feed/seen', { ids }).then(() => queryClient.invalidateQueries({ queryKey: ['unseen'] })).catch(() => {});
    }, 1500);
  }, [queryClient]);
  useEffect(() => () => clearTimeout(flushTimer.current), []);

  const refresh = useCallback(() => feed.refetch(), [feed]);
  const fromCache = feed.data?.pages[0]?.fromCache;
  const listWidth = Math.min(wide ? width - 220 - 320 - 64 : width - 32, 680) - 34;

  const header = (
    <View style={styles.headerBlock}>
      <View style={styles.search}>
        <Ionicons name="search" size={18} color={colors.textMuted} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Rechercher une actualité"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Rechercher une actualité"
          style={styles.searchInput}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {FILTERS.map(([key, label]) => <Chip key={key} label={label} selected={filter === key} onPress={() => setFilter(key)} />)}
      </ScrollView>
      <OfflineBanner savedAt={fromCache} />
    </View>
  );

  let body;
  if (feed.isPending) body = <Loading />;
  else if (feed.isError) body = <ErrorState message={errorMessage(feed.error)} onRetry={feed.refetch} />;
  else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <NewsCard news={item} width={listWidth} onPress={() => navigation.navigate('NewsDetail', { id: item.id, news: item })} />}
        ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={feed.isRefetching && !feed.isFetchingNextPage} onRefresh={refresh} colors={[colors.primary]} tintColor={colors.primary} />}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={VIEWABILITY}
        onEndReached={() => { if (feed.hasNextPage && !feed.isFetchingNextPage) feed.fetchNextPage(); }}
        onEndReachedThreshold={0.5}
        ListFooterComponent={feed.isFetchingNextPage ? <ActivityIndicator style={{ margin: spacing.lg }} color={colors.primary} /> : items.length ? <Text style={styles.end}>Vous êtes à jour.</Text> : null}
        ListEmptyComponent={<EmptyState icon={filter === 'bookmarks' ? 'bookmark-outline' : 'newspaper-outline'} title={filter === 'unseen' ? 'Vous êtes à jour' : filter === 'bookmarks' ? 'Aucun enregistrement' : q || filter !== 'all' ? 'Aucun résultat' : 'Aucune actualité'} message={q ? `Rien ne correspond à « ${q} ».` : filter === 'bookmarks' ? 'Touchez l’icône signet d’une actualité pour la retrouver ici.' : 'Les annonces de l’université apparaîtront ici.'} />}
      />
    );
  }

  return (
    <View style={styles.screen}>
      <View style={[styles.columns, wide && styles.columnsWide]}>
        <View style={styles.feed}>{body}</View>
        {wide ? (
          <ScrollView style={styles.side} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
            <UpcomingEvents events={events.data} loading={events.isPending} onOpen={(news) => navigation.navigate('NewsDetail', { id: news.id, news })} />
          </ScrollView>
        ) : null}
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Poser une question à l’assistant"
        onPress={() => navigation.navigate('Assistant')}
        style={({ pressed }) => [styles.fab, pressed && { opacity: 0.85 }]}
      >
        <Ionicons name="sparkles" size={20} color={colors.onPrimary} />
        <Text style={styles.fabLabel}>Assistant</Text>
      </Pressable>
    </View>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  columns: { flex: 1 },
  columnsWide: { flexDirection: 'row' },
  feed: { flex: 1 },
  side: { width: 320, flexGrow: 0, borderLeftWidth: 1, borderColor: colors.border },
  list: { padding: spacing.lg, paddingBottom: 96, width: '100%', maxWidth: 680, alignSelf: 'center' },
  headerBlock: { gap: spacing.md, marginBottom: spacing.md },
  search: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, minHeight: MIN_TOUCH },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, minHeight: MIN_TOUCH },
  end: { textAlign: 'center', color: colors.textMuted, margin: spacing.lg },
  fab: {
    position: 'absolute', right: spacing.lg, bottom: spacing.lg, minHeight: 52, paddingHorizontal: 18, borderRadius: 26,
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.primary,
    shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6,
  },
  fabLabel: { color: colors.onPrimary, fontWeight: '700', fontSize: 15 },
});
