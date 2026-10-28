import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Platform,
  Share,
} from 'react-native';
import { useAuth } from '../context/AuthContext';
import api, { BASE_URL } from '../api/axios';
import MediaCard from '../components/MediaCard';
import { colors, LOGO_URL } from '../theme/colors';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';

const VIDEO_EXTENSIONS = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

function absoluteMediaUrl(source) {
  if (!source) return '';
  if (/^(https?:|data:|blob:)/i.test(source)) return source;
  return `${BASE_URL}${source.startsWith('/') ? '' : '/'}${source}`;
}

function mediaForNews(item) {
  let mediaItems = Array.isArray(item.media) ? item.media : [];
  if (!mediaItems.length && item.path) mediaItems = [{ src: item.path }];

  return mediaItems.map((entry) => {
    const mediaEntry = typeof entry === 'string' ? { src: entry } : entry || {};
    const src = absoluteMediaUrl(mediaEntry.src || mediaEntry.path);
    const filename = (mediaEntry.filename || src.split('/').pop())?.split('?')[0];
    const video = (mediaEntry.type === 'video') || VIDEO_EXTENSIONS.some((extension) => filename?.toLowerCase().endsWith(extension));
    return {
      ...mediaEntry,
      type: video ? 'video' : 'image',
      src,
      filename,
      alt: mediaEntry.alt || item.titre || '',
      poster: mediaEntry.poster ? absoluteMediaUrl(mediaEntry.poster) : undefined,
    };
  }).filter((entry) => entry.src);
}

function timeAgo(value) {
  if (!value) return '';
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const elapsed = Math.max(0, Date.now() - timestamp);
  const minutes = Math.floor(elapsed / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `${minutes}min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}j`;
}

function NewsMediaCard({ item }) {
  const [sharing, setSharing] = useState(false);
  const caption = item.caption || [item.titre, item.description].filter(Boolean).join(' — ');
  const media = mediaForNews(item);
  const handleShare = async (selectedMedia) => {
    if (sharing) return;
    const message = `${item.titre || ''}\n\n${item.description || ''}`.trim();
    if (!selectedMedia?.src) {
      await Share.share({ message, title: item.titre });
      return;
    }

    setSharing(true);
    try {
      const filename = selectedMedia.filename || selectedMedia.src.split('/').pop().split('?')[0] || 'media';
      if (Platform.OS === 'web') {
        const browser = globalThis.navigator;
        if (browser?.share) {
          try {
            const response = await fetch(selectedMedia.src);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const blob = await response.blob();
            const file = new File([blob], filename, { type: blob.type || (selectedMedia.type === 'video' ? 'video/mp4' : 'image/jpeg') });
            if (browser.canShare?.({ files: [file] })) {
              await browser.share({ title: item.titre, text: message, files: [file] });
            } else {
              await browser.share({ title: item.titre, text: message, url: selectedMedia.src });
            }
            return;
          } catch (error) {
            if (error.name === 'AbortError') return;
          }
        }
        await Share.share({ message: `${message}\n${selectedMedia.src}`.trim(), title: item.titre });
        return;
      }

      const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!directory) throw new Error('Aucun dossier temporaire disponible');
      const download = await FileSystem.downloadAsync(selectedMedia.src, `${directory}${filename}`);
      if (download.status !== 200) throw new Error(`HTTP ${download.status}`);
      await Clipboard.setStringAsync(message);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(download.uri, {
          dialogTitle: item.titre || 'Partager',
          mimeType: selectedMedia.type === 'video' ? 'video/mp4' : 'image/*',
        });
      } else {
        await Share.share({ message: `${message}\n${selectedMedia.src}`.trim(), title: item.titre });
      }
    } catch {
      if (Platform.OS !== 'web') Alert.alert('Partage du média impossible', 'Le texte et le lien vont être partagés.');
      await Share.share({ message: `${message}\n${selectedMedia.src}`.trim(), title: item.titre });
    } finally {
      setSharing(false);
    }
  };

  return (
    <MediaCard
      username={item.username || 'sesame'}
      avatarSrc={item.avatarSrc || LOGO_URL}
      verified={item.verified ?? true}
      timeAgo={item.timeAgo || timeAgo(item.createdAt)}
      caption={caption}
      width={item.width || 468}
      height={item.height || 520}
      media={media}
      sharing={sharing}
      onShare={handleShare}
    />
  );
}

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
        renderItem={({ item }) => <NewsMediaCard item={item} />}
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
    alignItems: 'center',
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
