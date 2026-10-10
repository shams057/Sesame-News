import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  StatusBar,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import NewsCard from '../components/NewsCard';
import { colors, LOGO_URL } from '../theme/colors';

export default function NewsScreen() {
  const { user, logout, token } = useAuth();
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
          err.response?.data?.error ||
            'Impossible de charger les actualités'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
        setLoadingMore(false);
      }
    },
    [user?.id, token]
  );

  useEffect(() => {
    fetchNews(0, false);
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

  const handleLogout = async () => {
    await logout();
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
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header with notch inset safety */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 12, Platform.OS === 'android' ? 44 : 20) }]}>
        <View style={styles.headerLeft}>
          <Image source={{ uri: LOGO_URL }} style={styles.logo} />
          <View>
            <Text style={styles.headerTitle}>Actualités</Text>
            <Text style={styles.headerSub}>
              {user?.firstname} {user?.lastname}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Quitter</Text>
        </TouchableOpacity>
      </View>

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
  header: {
    backgroundColor: colors.primaryDark,
    paddingBottom: 16,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  logo: {
    width: 40,
    height: 40,
    resizeMode: 'contain',
    tintColor: '#fff',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.secondary,
    fontSize: 12,
    marginTop: 2,
  },
  logoutBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  logoutText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 13,
    fontWeight: '600',
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