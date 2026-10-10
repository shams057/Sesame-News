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

export default function NewsCard({ item }) {
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  const fileUrl = buildUrl(item.path);
  const showImage = isImage(item.path);
  const showVideo = isVideo(item.path);
  const showFileLink = item.path && !showImage && !showVideo;
  const isLong = (item.description || '').length > 120;

  const handleShare = async () => {
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
    } catch (e) {
      Alert.alert(
        'Partage fichier impossible',
        'Le texte va être partagé.'
      );
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
        Alert.alert('Erreur', 'Impossible d\'ouvrir ce document.');
      }
    }
  };

  return (
    <View style={styles.card}>
      {/* Date + Badge */}
      <View style={styles.metaRow}>
        <Text style={styles.date}>
          {item.createdAt
            ? new Date(item.createdAt).toLocaleDateString('fr-FR', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
              })
            : ''}
        </Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>
            {item.all ? 'Tous' : 'Ma catégorie'}
          </Text>
        </View>
      </View>

      {/* Titre */}
      <Text style={styles.title} numberOfLines={2}>
        {item.titre}
      </Text>

      {/* Description */}
      <LinkifiedText
        text={item.description}
        style={styles.desc}
        numberOfLines={expanded ? undefined : 3}
        selectable
      />

      {isLong && (
        <TouchableOpacity onPress={() => setExpanded(!expanded)}>
          <Text style={styles.more}>
            {expanded ? 'Voir moins' : 'Voir plus'}
          </Text>
        </TouchableOpacity>
      )}

      {/* Image Preview */}
      {showImage && fileUrl ? (
        <TouchableOpacity onPress={openFileInApp} activeOpacity={0.9} style={styles.mediaWrap}>
          <Image
            source={{ uri: encodeURI(fileUrl) }}
            style={styles.image}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ) : null}

      {/* Video Preview */}
      {showVideo && fileUrl ? (
        <View style={{ marginTop: 8 }}>
          <VideoPlayer uri={fileUrl} />
        </View>
      ) : null}

      {/* Document / File link */}
      {showFileLink ? (
        <TouchableOpacity onPress={openFileInApp} style={styles.fileBtn} activeOpacity={0.8}>
          <Text style={styles.fileText}>📎 Voir la pièce jointe</Text>
        </TouchableOpacity>
      ) : null}

      {/* Footer / Share */}
      <View style={styles.footer}>
        <View style={styles.footerLine} />
        <TouchableOpacity
          style={styles.shareBtn}
          onPress={handleShare}
          activeOpacity={0.75}
        >
          <Text style={styles.shareIcon}>↗</Text>
          <Text style={styles.shareText}>Partager</Text>
        </TouchableOpacity>
      </View>

      {/* Fullscreen Media Viewer Modal */}
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
            >
              <Text style={styles.closeBtnText}>✕ Fermer</Text>
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
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  date: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.textSoft,
  },
  badge: {
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 99,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    color: colors.primary,
  },
  title: {
    fontSize: 16.5,
    fontWeight: '700',
    color: colors.text,
    lineHeight: 23,
    marginBottom: 8,
  },
  desc: {
    fontSize: 14,
    color: colors.textSoft,
    lineHeight: 21,
  },
  more: {
    color: colors.primary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 6,
    marginBottom: 8,
  },
  mediaWrap: {
    position: 'relative',
    marginTop: 8,
    marginBottom: 10,
  },
  image: {
    width: '100%',
    height: 190,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
  },
  fileBtn: {
    marginTop: 10,
    marginBottom: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: '#F0F9FF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#BAE6FD',
  },
  fileText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#0284C7',
  },
  footer: {
    marginTop: 12,
  },
  footerLine: {
    height: 1,
    backgroundColor: colors.border,
    marginBottom: 10,
  },
  shareBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: 10,
    backgroundColor: '#F3F4F6',
  },
  shareIcon: {
    fontSize: 14,
    color: colors.textSoft,
    fontWeight: '700',
  },
  shareText: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.textSoft,
  },

  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#000000',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: '#111827',
  },
  modalTitle: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
    marginRight: 12,
  },
  closeBtn: {
    backgroundColor: '#374151',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  closeBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
  },
  modalImage: {
    width: '100%',
    height: '100%',
  },
});