import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NewsCard from '../components/NewsCard';
import { colors } from '../theme/colors';

export default function NewsScreen() {
  const { user, token } = useAuth();
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
          err.response?.data?.error ||
            'Impossible de charger les actualités'
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => fetchNews(0, false)}>
            <Text style={styles.retry}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <FlatList
        data={news}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <NewsCard item={item} />}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }
        onEndReached={loadMore}
        onEndReachedThreshold={0.4}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              style={{ marginVertical: 20 }}
              color={colors.primary}
            />
          ) : page + 1 >= totalPages && news.length > 0 ? (
            <Text style={styles.endText}>Fin des actualités</Text>
          ) : null
        }
        ListEmptyComponent={
          !error ? (
            <Text style={styles.empty}>Aucune actualité pour le moment</Text>
          ) : null
        }
      />

    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.bg,
  },
  list: {
    padding: 16,
    paddingBottom: 40,
  },
  empty: {
    textAlign: 'center',
    color: colors.textSoft,
    marginTop: 40,
    fontSize: 15,
  },
  endText: {
    textAlign: 'center',
    color: '#94a3b8',
    fontSize: 13,
    marginVertical: 16,
  },
  errorBox: {
    margin: 16,
    backgroundColor: '#fef2f2',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  errorText: {
    color: colors.danger,
    fontSize: 13,
  },
  retry: {
    color: colors.primary,
    fontWeight: '700',
    marginTop: 8,
    fontSize: 13,
  },
});
