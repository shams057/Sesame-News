import React, { useState } from 'react';
import VideoPlayer from './VideoPlayer';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Share,
  Image,
  Modal,
  StatusBar,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '../theme/colors';
import LinkifiedText from './LinkifiedText';
import { BASE_URL } from '../api/axios';

import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import * as Clipboard from 'expo-clipboard';
import * as WebBrowser from 'expo-web-browser';

const IMAGE_EXT = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'];
const VIDEO_EXT = ['.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v'];

function buildUrl(path) {
  if (!path) return null;
  if (path.startsWith('http')) return path;
  const clean = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_URL}${clean}`;
}

function getExt(path) {
  if (!path) return '';
  return path.toLowerCase().split('?')[0];
}

function isImage(path) {
  const lower = getExt(path);
  return IMAGE_EXT.some((ext) => lower.endsWith(ext));
}

function isVideo(path) {
  const lower = getExt(path);
  return VIDEO_EXT.some((ext) => lower.endsWith(ext));
}

function guessMime(filename = '') {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.mov')) return 'video/quicktime';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

function displayName(path) {
  const raw = (path || '').split('?')[0].split('/').pop() || '';
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function Action({ icon, label, onPress, busy }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={busy}
      activeOpacity={0.6}
      hitSlop={{ top: 10, bottom: 10, left: 6, right: 6 }}
      style={styles.action}
    >
      {busy ? (
        <ActivityIndicator size="small" color={colors.textSoft} />
      ) : (
        <Text style={{ fontSize: 16, color: colors.textSoft, lineHeight: 20 }}>{icon}</Text>
      )}
      <Text style={styles.actionText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function NewsCard({ item }) {
  const [sharing, setSharing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [imageAspectRatio, setImageAspectRatio] = useState(null);
  const [downloading, setDownloading] = useState(false);

  const fileUrl = buildUrl(item.path);
  const showImage = isImage(item.path);
  const showVideo = isVideo(item.path);
  const showFileLink = item.path && !showImage && !showVideo;

  const fileName = displayName(item.path);
  const fileExt = (fileName.split('.').pop() || 'FILE').toUpperCase().slice(0, 4);

  const handleShare = async () => {
    if (sharing) return;
    const text = `${item.titre}\n\n${item.description || ''}`.trim();

    if (!fileUrl) {
      await Share.share({ message: text, title: item.titre });
      return;
    }

    setSharing(true);
    try {
      const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory;

      if (!dir) {
        await Share.share({ message: text, title: item.titre });
        return;
      }

      const filename =
        (item.path && item.path.split('/').pop()) || `news_${item.id}.bin`;
      const localUri = `${dir}${filename}`;

      const download = await FileSystem.downloadAsync(fileUrl, localUri);

      if (download.status !== 200) {
        throw new Error('Téléchargement échoué: ' + download.status);
      }

      await Clipboard.setStringAsync(text);

      const canShare = await Sharing.isAvailableAsync();

      if (canShare) {
        await Sharing.shareAsync(download.uri, {
          dialogTitle: item.titre || 'Partager',
          mimeType: guessMime(filename),
          UTI: guessMime(filename),
        });
      } else {
        await Share.share({ message: text, title: item.titre });
      }
    } catch (_error) {
      Alert.alert('Partage fichier impossible', 'Le texte va être partagé.');
      try {
        await Share.share({ message: text, title: item.titre });
      } catch {
        Alert.alert('Erreur', 'Impossible de partager');
      }
    } finally {
      setSharing(false);
    }
  };

  const openFileInApp = async () => {
    if (!fileUrl) return;

    if (showImage || showVideo) {
      setModalVisible(true);
    } else {
      try {
        await WebBrowser.openBrowserAsync(fileUrl, {
          toolbarColor: colors.primaryDark,
          controlsColor: '#FFFFFF',
          dismissButtonStyle: 'close',
        });
      } catch (e) {
        console.log('In-app browser error:', e);
        Alert.alert('Erreur', "Impossible d'ouvrir ce document.");
      }
    }
  };

  const downloadFile = async () => {
    if (!fileUrl || downloading) return;
    setDownloading(true);
    try {
      const directory = FileSystem.documentDirectory || FileSystem.cacheDirectory;
      if (!directory) throw new Error('No local directory');
      const filename = item.path?.split('/').pop() || `news_${item.id}.bin`;
      const result = await FileSystem.downloadAsync(fileUrl, `${directory}${filename}`);
      if (result.status !== 200) throw new Error(`HTTP ${result.status}`);
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(result.uri, { mimeType: guessMime(filename) });
      } else {
        Alert.alert('Téléchargement terminé', filename);
      }
    } catch (_error) {
      Alert.alert('Téléchargement impossible', "Le média n'a pas pu être téléchargé.");
    } finally {
      setDownloading(false);
    }
  };

  const date = item.createdAt
    ? new Date(item.createdAt).toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '';

  return (
    <View style={styles.row}>
      {/* Audience + date */}
      <View style={styles.metaRow}>
        <View style={styles.audience}>
          <View style={[styles.dot, item.all ? styles.dotAll : styles.dotMine]} />
          <Text style={styles.audienceText}>{item.all ? 'Tous' : 'Ma catégorie'}</Text>
        </View>
        <Text style={styles.date}>{date}</Text>
      </View>

      <Text style={styles.title}>{item.titre}</Text>

      <LinkifiedText text={item.description} style={styles.desc} selectable />

      {/* Image */}
      {showImage && fileUrl ? (
        <TouchableOpacity onPress={openFileInApp} activeOpacity={0.92} style={styles.media}>
          <Image
            source={{ uri: encodeURI(fileUrl) }}
            style={[styles.image, imageAspectRatio && { aspectRatio: imageAspectRatio }]}
            resizeMode="cover"
            onLoad={({ nativeEvent }) => {
              const source = nativeEvent?.source;
              if (source?.width > 0 && source?.height > 0) {
                setImageAspectRatio(source.width / source.height);
              }
            }}
          />
          <View style={styles.expand} pointerEvents="none">
            <Text style={{ fontSize: 13, color: '#FFFFFF', lineHeight: 16 }}>⤢</Text>
          </View>
        </TouchableOpacity>
      ) : null}

      {/* Video */}
      {showVideo && fileUrl ? (
        <View style={[styles.media, styles.videoWrap]}>
          <VideoPlayer uri={fileUrl} />
        </View>
      ) : null}

      {/* Document */}
      {showFileLink ? (
        <TouchableOpacity onPress={openFileInApp} style={styles.file} activeOpacity={0.7}>
          <View style={styles.fileTile}>
            <Text style={styles.fileExt}>{fileExt}</Text>
          </View>
          <View style={styles.fileInfo}>
            <Text style={styles.fileName} numberOfLines={1}>
              {fileName || 'Pièce jointe'}
            </Text>
            <Text style={styles.fileHint}>Ouvrir la pièce jointe</Text>
          </View>
          <Text style={{ fontSize: 16, color: '#94A3B8', lineHeight: 20 }}>›</Text>
        </TouchableOpacity>
      ) : null}

      {/* Actions */}
      <View style={styles.actions}>
        <Action
          icon="↗"
          label={sharing ? 'Préparation…' : 'Partager'}
          onPress={handleShare}
          busy={sharing}
        />
        {fileUrl ? (
          <Action
            icon="↓"
            label={downloading ? 'Téléchargement…' : 'Télécharger'}
            onPress={downloadFile}
            busy={downloading}
          />
        ) : null}
      </View>

      {/* Fullscreen viewer */}
      <Modal
        visible={modalVisible}
        transparent={false}
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <StatusBar barStyle="light-content" backgroundColor="#000000" />
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle} numberOfLines={1}>
              {item.titre}
            </Text>
            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={styles.closeBtn}
              accessibilityLabel="Fermer"
            >
              <Text style={{ fontSize: 18, color: '#FFFFFF', lineHeight: 22, fontWeight: '500' }}>✕</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.modalContent}>
            {showImage && fileUrl ? (
              <Image
                source={{ uri: encodeURI(fileUrl) }}
                style={styles.modalImage}
                resizeMode="contain"
              />
            ) : showVideo && fileUrl ? (
              <VideoPlayer uri={fileUrl} />
            ) : null}
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    paddingVertical: 22,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  audience: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 7, height: 7, borderRadius: 4 },
  dotAll: { backgroundColor: '#94A3B8' },
  dotMine: { backgroundColor: colors.primary },
  audienceText: { fontSize: 13, fontWeight: '600', color: colors.text },
  date: { fontSize: 13, color: colors.textSoft },

  title: {
    fontSize: 19,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 26,
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  desc: {
    fontSize: 15,
    color: colors.textSoft,
    lineHeight: 23,
  },

  media: { marginTop: 16 },
  image: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
  },
  videoWrap: { borderRadius: 14, overflow: 'hidden' },
  expand: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(15,23,42,0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  file: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: '#F8FAFC',
  },
  fileTile: {
    width: 42,
    height: 42,
    borderRadius: 10,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fileExt: { fontSize: 11, fontWeight: '800', color: colors.primary },
  fileInfo: { flex: 1 },
  fileName: { fontSize: 14, fontWeight: '600', color: colors.text },
  fileHint: { fontSize: 12, color: colors.textSoft, marginTop: 2 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 24,
    marginTop: 18,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  actionText: { fontSize: 13.5, fontWeight: '600', color: colors.textSoft },

  // Modal
  modalContainer: { flex: 1, backgroundColor: '#000000' },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  modalImage: { width: '100%', height: '100%' },
});