import React, { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { colors } from '../theme/colors';
import VideoPlayer from './VideoPlayer';

export default function MediaCard({
  username,
  avatarSrc,
  verified = false,
  timeAgo,
  caption,
  media = [],
  width = 468,
  height = 520,
  sharing = false,
  onShare,
}) {
  const { width: viewportWidth } = useWindowDimensions();
  const [index, setIndex] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const frameWidth = Math.min(width, Math.max(220, viewportWidth - 32));
  const current = media[index];

  const downloadCurrent = async () => {
    if (!current?.src || downloading) return;
    setMenuOpen(false);
    setDownloading(true);
    try {
      const directory = FileSystem.cacheDirectory || FileSystem.documentDirectory;
      if (!directory) throw new Error('No local directory available');
      const filename = current.filename || current.src.split('/').pop().split('?')[0] || 'media';
      const result = await FileSystem.downloadAsync(current.src, `${directory}${filename}`);
      if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(result.uri, { mimeType: current.type === 'video' ? 'video/mp4' : 'image/*' });
      else Alert.alert('Téléchargement terminé', filename);
    } catch {
      Alert.alert('Téléchargement impossible', 'Le média n’a pas pu être téléchargé.');
    } finally {
      setDownloading(false);
    }
  };

  const share = onShare || (() => Share.share({ message: caption || '', title: username }));

  return (
    <View style={[styles.card, { width: frameWidth }]}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          {avatarSrc ? <Image source={{ uri: avatarSrc }} style={styles.avatarImage} /> : <Text style={styles.avatarFallback}>{username?.[0]?.toUpperCase()}</Text>}
        </View>
        <View style={styles.meta}>
          <Text numberOfLines={1} style={styles.username}>{username}</Text>
          {verified && <Text style={styles.verified} accessibilityLabel="Compte vérifié">✓</Text>}
          {!!timeAgo && <Text style={styles.time}>· {timeAgo}</Text>}
        </View>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Options du média" onPress={() => setMenuOpen((open) => !open)} style={styles.moreButton}>
          <Text style={styles.more}>•••</Text>
        </TouchableOpacity>
      </View>

      {menuOpen && (
        <TouchableOpacity style={styles.menuItem} onPress={downloadCurrent} disabled={!current || downloading}>
          {downloading ? <ActivityIndicator size="small" color="#1F2937" /> : <Text style={styles.menuText}>Télécharger le média</Text>}
        </TouchableOpacity>
      )}

      <View style={[styles.frame, { width: frameWidth, height }]}>
        {current?.type === 'video' ? (
          <VideoPlayer uri={current.src} />
        ) : current ? (
          <Image source={{ uri: current.src }} style={styles.media} resizeMode="cover" accessibilityLabel={current.alt || ''} />
        ) : null}
        {index > 0 && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Média précédent" onPress={() => setIndex((value) => Math.max(0, value - 1))} style={[styles.carouselButton, styles.previous]}>
            <Text style={styles.carouselText}>‹</Text>
          </TouchableOpacity>
        )}
        {index < media.length - 1 && (
          <TouchableOpacity accessibilityRole="button" accessibilityLabel="Média suivant" onPress={() => setIndex((value) => Math.min(media.length - 1, value + 1))} style={[styles.carouselButton, styles.next]}>
            <Text style={styles.carouselText}>›</Text>
          </TouchableOpacity>
        )}
      </View>

      {media.length > 1 && (
        <View style={styles.dots}>
          {media.map((entry, dotIndex) => (
            <TouchableOpacity key={`${entry.src}-${dotIndex}`} accessibilityRole="button" accessibilityLabel={`Média ${dotIndex + 1} sur ${media.length}`} onPress={() => setIndex(dotIndex)} style={[styles.dot, index === dotIndex && styles.activeDot]} />
          ))}
        </View>
      )}

      <View style={styles.actions}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Partager" onPress={() => share(current)} style={styles.shareButton} disabled={sharing}>
          {sharing ? <ActivityIndicator size="small" color={colors.primary} /> : <Text style={styles.shareIcon}>↗</Text>}
        </TouchableOpacity>
      </View>
      {caption ? (
        <Text style={styles.caption}>
          <Text style={styles.captionUsername}>{username} </Text>
          {verified ? <Text style={styles.captionVerified}>✓ </Text> : null}
          {caption}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignSelf: 'center', flexShrink: 0, paddingTop: 16, paddingBottom: 14, marginBottom: 14, overflow: 'visible', borderWidth: 1, borderColor: colors.border, borderRadius: 16, backgroundColor: colors.card, shadowColor: '#0F172A', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  header: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingBottom: 12 },
  avatar: { width: 40, height: 40, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: '#EFF6FF' },
  avatarImage: { width: '100%', height: '100%' },
  avatarFallback: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  meta: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: 5 },
  username: { flexShrink: 1, color: colors.text, fontSize: 14, fontWeight: '700' },
  verified: { color: colors.primary, fontSize: 15, fontWeight: '800' },
  time: { color: colors.textSoft, fontSize: 12 },
  moreButton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  more: { color: colors.gray600, fontSize: 19, fontWeight: '700', letterSpacing: 1 },
  menuItem: { alignSelf: 'flex-end', minWidth: 170, minHeight: 38, justifyContent: 'center', marginRight: 14, marginBottom: 8, paddingHorizontal: 12, borderRadius: 8, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  menuText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  frame: { position: 'relative', overflow: 'hidden', backgroundColor: colors.gray100 },
  media: { width: '100%', height: '100%' },
  carouselButton: { position: 'absolute', top: '50%', width: 34, height: 34, alignItems: 'center', justifyContent: 'center', marginTop: -17, borderRadius: 17, backgroundColor: '#fff', borderWidth: 1, borderColor: colors.border },
  previous: { left: 12 },
  next: { right: 12 },
  carouselText: { color: colors.primary, fontSize: 24, lineHeight: 28 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, paddingTop: 12, paddingBottom: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.gray300 },
  activeDot: { backgroundColor: colors.primary },
  actions: { minHeight: 44, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingTop: 5 },
  shareButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  shareIcon: { color: colors.primary, fontSize: 24 },
  caption: { flexDirection: 'row', flexWrap: 'wrap', gap: 5, marginTop: 4, paddingHorizontal: 18, color: colors.text, fontSize: 14, lineHeight: 20 },
  captionUsername: { fontWeight: '700' },
  captionVerified: { color: colors.primary, fontWeight: '800' },
});
