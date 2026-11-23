import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import api from '../api/client';
import { Image, Pressable, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, spacing, useColors, useStyles } from '../theme';
import { formatEvent, timeAgo } from '../utils/format';
import { addToCalendar } from '../utils/calendar';
import { notify, shareNews } from '../utils/files';
import RichText from './RichText';
import MediaGallery from './MediaGallery';
import { Badge, IconButton } from './ui';

const MARK = require('../../assets/sesame-mark.png');

export function EventBlock({ news }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  if (!news.eventStart) return null;
  return (
    <View style={styles.event}>
      <Ionicons name="calendar-outline" size={18} color={colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={styles.eventDate}>{formatEvent(news.eventStart, news.eventEnd)}</Text>
        {news.location ? <Text style={styles.eventPlace}>{news.location}</Text> : null}
      </View>
      <IconButton
        icon="add-circle-outline"
        color={colors.primary}
        accessibilityLabel="Ajouter à mon agenda"
        onPress={() => addToCalendar(news).catch(() => notify('Agenda', 'Impossible d’exporter l’événement.'))}
      />
    </View>
  );
}

/**
 * Feed item: headline first, then event info, excerpt, media and documents.
 * `full` renders the whole text (detail screen).
 */
function BookmarkButton({ news }) {
  const colors = useColors();
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState(Boolean(news.bookmarked));
  const toggle = async () => {
    const next = !saved;
    setSaved(next);
    try {
      if (next) await api.put(`/feed/${news.id}/bookmark`);
      else await api.delete(`/feed/${news.id}/bookmark`);
      queryClient.invalidateQueries({ queryKey: ['feed', 'bookmarks'] });
    } catch {
      setSaved(!next);
      notify('Enregistrement impossible', 'Vérifiez votre connexion.');
    }
  };
  return (
    <IconButton icon={saved ? 'bookmark' : 'bookmark-outline'} color={saved ? colors.primary : colors.textSoft}
      accessibilityLabel={saved ? 'Retirer des enregistrements' : 'Enregistrer pour plus tard'} onPress={toggle} />
  );
}

export default function NewsCard({ news, onPress, full = false, width }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const Wrapper = onPress ? Pressable : View;
  return (
    <View style={styles.card}>
      <Wrapper
        {...(onPress ? { onPress, accessibilityRole: 'button', accessibilityLabel: `Lire : ${news.titre}` } : {})}
        style={{ gap: spacing.sm }}
      >
        <View style={styles.header}>
          <Image source={MARK} style={styles.avatar} accessibilityIgnoresInvertColors />
          <View style={{ flex: 1 }}>
            <Text style={styles.source}>Université SESAME</Text>
            <Text style={styles.meta}>{timeAgo(news.publishAt || news.createdAt)}{news.audienceAll ? '' : ` · ${news.categories.map((c) => c.libelle).join(', ')}`}</Text>
          </View>
          {news.seen === false && !full ? <Badge label="Nouveau" tone="info" /> : null}
          {news.pinned ? <Badge label="Épinglé" tone="accent" icon="pin" /> : null}
        </View>
        <Text style={styles.title} accessibilityRole="header">{news.titre}</Text>
        <EventBlock news={news} />
        <RichText text={news.description} style={styles.body} compact={!full} numberOfLines={full ? undefined : 4} />
      </Wrapper>
      {news.media.length ? <MediaGallery media={news.media} width={width} /> : null}
      <View style={styles.footer}>
        {onPress ? (
          <Pressable accessibilityRole="button" onPress={onPress} style={styles.more} hitSlop={8}>
            <Text style={{ color: colors.primary, fontWeight: '700' }}>Lire la suite</Text>
          </Pressable>
        ) : <View />}
        <View style={{ flexDirection: 'row' }}>
          <BookmarkButton key={`${news.id}-${news.bookmarked}`} news={news} />
          <IconButton icon="share-social-outline" accessibilityLabel="Partager" color={colors.textSoft} onPress={() => shareNews(news).catch(() => {})} />
        </View>
      </View>
    </View>
  );
}

const makeStyles = (colors) => ({
  card: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg, gap: spacing.md },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: '#fff', resizeMode: 'contain' },
  source: { fontWeight: '700', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, lineHeight: 24 },
  body: { fontSize: 15, lineHeight: 22, color: colors.textSoft },
  event: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, backgroundColor: colors.primarySoft, borderRadius: radius.md, paddingLeft: spacing.md, paddingVertical: 2 },
  eventDate: { color: colors.primary, fontWeight: '700' },
  eventPlace: { color: colors.textSoft, fontSize: 13 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: -spacing.sm },
  more: { minHeight: 44, justifyContent: 'center' },
});
