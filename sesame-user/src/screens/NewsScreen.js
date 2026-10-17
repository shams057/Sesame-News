import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Animated,
} from 'react-native';

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NewsCard from '../components/NewsCard';
import { colors } from '../theme/colors';

// Leaves room for the floating glass tab bar.
const BOTTOM_SPACE = 130;

function Header({ top }) {
  const today = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
  const label = today.charAt(0).toUpperCase() + today.slice(1);

  return (
    <View style={[styles.header, { paddingTop: top + 14 }]}>
      <Text style={styles.headerTitle}>Actualités</Text>
      <Text style={styles.headerSub}>{label}</Text>
    </View>
  );
}

function SkeletonRow({ pulse }) {
  return (
    <Animated.View style={[styles.skelRow, { opacity: pulse }]}>
      <View style={[styles.bar, { width: '38%', height: 10 }]} />
      <View style={[styles.bar, { width: '86%', height: 18, marginTop: 14 }]} />
      <View style={[styles.bar, { width: '62%', height: 18, marginTop: 8 }]} />
      <View style={[styles.bar, { width: '100%', height: 11, marginTop: 16 }]} />
      <View style={[styles.bar, { width: '92%', height: 11, marginTop: 8 }]} />
    </Animated.View>
  );
}

function Skeleton({ top }) {
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.55, duration: 800, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [pulse]);

  return (
    <View style={styles.container}>
      <Header top={top} />
      <View style={styles.skelWrap}>
        <SkeletonRow pulse={pulse} />
        <SkeletonRow pulse={pulse} />
        <SkeletonRow pulse={pulse} />
      </View>
    </View>
  );
}

export default function NewsScreen() {
  const { user, token } = useAuth();
  const insets = useSafeAreaInsets();
  const [news, setNews] = useState([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const fetchNews = useCallback(
    async (pageNum = 0, append = false) => {
      try {
        if (!append) setError('');

        const res = await api.get('/newssparuser', {
          params: {
            page: pageNum,
            userId: user?.id,
          },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        const content = res.data.content || [];
        const pages = res.data.totalPages || 1;

        setNews((prev) => (append ? [...prev, ...content] : content));
        setTotalPages(pages);
        setPage(pageNum);
      } catch (err) {
        console.log('Erreur news:', err.response?.data || err.message);
        setError(
          err.response?.data?.error || 'Impossible de charger les actualités'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [user, token]
  );

  useEffect(() => {
    const timeout = setTimeout(() => fetchNews(0, false), 0);
    return () => clearTimeout(timeout);
  }, [fetchNews]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchNews(0, false);
  };

  const loadMore = () => {
    if (loadingMore) return;
    if (page + 1 >= totalPages) return;

    setLoadingMore(true);
    fetchNews(page + 1, true);
  };

  if (loading) return <Skeleton top={insets.top} />;

  const header = (
    <View>
      <Header top={insets.top} />
      {error ? (
        <View style={styles.errorBox}>
          <Text style={{ fontSize: 18, color: colors.danger, lineHeight: 22 }}>⚠</Text>
          <View style={styles.errorBody}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity
              onPress={() => fetchNews(0, false)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.retry}>Réessayer</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={news}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <NewsCard item={item} />
          </View>
        )}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: BOTTOM_SPACE }}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
            progressViewOffset={insets.top}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator style={{ marginVertical: 24 }} color={colors.primary} />
          ) : page + 1 >= totalPages && news.length > 0 ? (
            <View style={styles.end}>
              <Text style={{ fontSize: 14, color: '#94A3B8', lineHeight: 18 }}>✓</Text>
              <Text style={styles.endText}>Vous êtes à jour</Text>
            </View>
          ) : null
        }
        ListEmptyComponent={
          !error ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Text style={{ fontSize: 24, color: colors.textSoft }}>📰</Text>
              </View>
              <Text style={styles.emptyTitle}>Aucune actualité pour le moment</Text>
              <Text style={styles.emptyText}>
                Les nouvelles annonces apparaîtront ici dès leur publication.
              </Text>
            </View>
          ) : null
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.card,
  },

  header: {
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  headerTitle: {
    fontSize: 32,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.9,
  },
  headerSub: {
    fontSize: 14,
    color: colors.textSoft,
    marginTop: 4,
  },

  item: { paddingHorizontal: 20 },

  skelWrap: { paddingHorizontal: 20 },
  skelRow: {
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  bar: { borderRadius: 6, backgroundColor: '#E2E8F0' },

  errorBox: {
    flexDirection: 'row',
    gap: 12,
    marginHorizontal: 20,
    marginBottom: 8,
    padding: 14,
    borderRadius: 14,
    backgroundColor: '#FEF2F2',
  },
  errorBody: { flex: 1 },
  errorText: { color: colors.danger, fontSize: 14, lineHeight: 20 },
  retry: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 8,
  },

  empty: {
    alignItems: 'center',
    paddingHorizontal: 40,
    marginTop: 56,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.textSoft,
    textAlign: 'center',
    marginTop: 6,
  },

  end: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginVertical: 28,
  },
  endText: { color: '#94A3B8', fontSize: 13 },
});