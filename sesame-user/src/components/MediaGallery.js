import React, { useState } from 'react';
import { Image, Pressable, ScrollView, Text, View, useWindowDimensions } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';
import { absoluteUrl, errorMessage } from '../api/client';
import { radius, spacing, useColors } from '../theme';
import { downloadAndShare, notify, openDocument } from '../utils/files';
import { formatBytes } from '../utils/format';

function Video({ uri, width }) {
  const player = useVideoPlayer(uri, (instance) => { instance.loop = false; });
  return <VideoView player={player} style={{ width, height: (width * 9) / 16, borderRadius: radius.md, backgroundColor: '#000' }} nativeControls contentFit="contain" allowsFullscreen />;
}

function Visual({ media, width }) {
  const uri = absoluteUrl(media.url);
  if (media.kind === 'video') return <Video uri={uri} width={width} />;
  return (
    <Image
      source={{ uri }}
      accessibilityLabel={media.originalName}
      style={{ width, height: Math.round(width * 0.66), borderRadius: radius.md, backgroundColor: '#e2e8f0' }}
      resizeMode="cover"
    />
  );
}

/** A PDF/Word attachment shown as a document, never as a broken image. */
export function DocumentRow({ media }) {
  const colors = useColors();
  const [busy, setBusy] = useState(false);
  const isPdf = media.mimeType === 'application/pdf';
  const open = async () => {
    try {
      if (isPdf) await openDocument(media.url);
      else {
        setBusy(true);
        await downloadAndShare(media.url, media.originalName, { mimeType: media.mimeType });
      }
    } catch (error) {
      notify('Ouverture impossible', errorMessage(error, 'Le document n’a pas pu être ouvert.'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvrir le document ${media.originalName}`}
      onPress={open}
      disabled={busy}
      style={({ pressed }) => ({
        flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 56, padding: spacing.md,
        borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: pressed ? colors.cardMuted : colors.card,
      })}
    >
      <View style={{ width: 38, height: 38, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: isPdf ? colors.dangerSoft : colors.primarySoft }}>
        <Ionicons name="document-text-outline" size={20} color={isPdf ? colors.danger : colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text numberOfLines={1} style={{ color: colors.text, fontWeight: '600' }}>{media.originalName}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>{isPdf ? 'PDF' : 'Document Word'} · {formatBytes(media.size)}</Text>
      </View>
      <Ionicons name={isPdf ? 'open-outline' : 'download-outline'} size={20} color={colors.primary} />
    </Pressable>
  );
}

/** Images/videos in a swipeable strip, documents listed below. */
export default function MediaGallery({ media, width: containerWidth }) {
  const colors = useColors();
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(containerWidth || windowWidth - 64, 640);
  const [index, setIndex] = useState(0);
  const visuals = media.filter((item) => item.kind !== 'document');
  const documents = media.filter((item) => item.kind === 'document');

  return (
    <View style={{ gap: spacing.sm }}>
      {visuals.length === 1 ? <Visual media={visuals[0]} width={width} /> : null}
      {visuals.length > 1 ? (
        <View>
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
            style={{ width }}
          >
            {visuals.map((item) => <Visual key={item.id} media={item} width={width} />)}
          </ScrollView>
          <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 8 }} accessibilityLabel={`Média ${index + 1} sur ${visuals.length}`}>
            {visuals.map((item, dot) => (
              <View key={item.id} style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: dot === index ? colors.primary : colors.border }} />
            ))}
          </View>
        </View>
      ) : null}
      {documents.map((item) => <DocumentRow key={item.id} media={item} />)}
    </View>
  );
}
