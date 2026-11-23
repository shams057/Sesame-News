import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as DocumentPicker from 'expo-document-picker';
import { Ionicons } from '@expo/vector-icons';
import api, { appendFile, errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { formatDateTime, formatTime } from '../utils/format';
import { downloadAndShare, notify } from '../utils/files';
import { confirm } from '../utils/confirm';
import StatusBadge from '../components/StatusBadge';
import { Button, ErrorState, IconButton, Loading } from '../components/ui';

const REOPEN_DAYS = 14;
const withinReopenWindow = (closedAt) => Boolean(closedAt) && Date.now() - new Date(closedAt).getTime() < REOPEN_DAYS * 86400000;

function Message({ message }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  if (message.senderRole === 'system') {
    return <Text style={styles.system}>{message.content} · {formatTime(message.createdAt)}</Text>;
  }
  const mine = message.senderRole === 'user';
  const openAttachment = () => downloadAndShare(message.attachment.url, message.attachment.name, { authenticated: true, mimeType: message.attachment.mimeType })
    .catch((error) => notify('Téléchargement impossible', errorMessage(error, 'Réessayez plus tard.')));
  return (
    <View style={[styles.messageRow, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
      {!mine ? <Text style={styles.sender}>{message.senderName} · Support</Text> : null}
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15, lineHeight: 21 }} selectable>{message.content}</Text>
        {message.attachment ? (
          <Pressable accessibilityRole="button" accessibilityLabel={`Ouvrir la pièce jointe ${message.attachment.name}`} onPress={openAttachment} style={styles.attachment}>
            <Ionicons name="attach" size={16} color={mine ? '#fff' : colors.primary} />
            <Text numberOfLines={1} style={{ color: mine ? '#fff' : colors.primary, fontWeight: '600', flexShrink: 1 }}>{message.attachment.name}</Text>
          </Pressable>
        ) : null}
      </View>
      <Text style={styles.time}>{formatTime(message.createdAt)}</Text>
    </View>
  );
}

function Rating({ ticket }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const save = useMutation({
    mutationFn: () => api.patch(`/tickets/${ticket.id}`, { rating, ratingComment: comment.trim() || undefined }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ticket', ticket.id] }),
    onError: (error) => notify('Erreur', errorMessage(error)),
  });
  if (ticket.rating) {
    return <Text style={styles.ratingDone}>Merci pour votre avis : {'★'.repeat(ticket.rating)}{'☆'.repeat(5 - ticket.rating)}</Text>;
  }
  return (
    <View style={styles.ratingBox}>
      <Text style={styles.ratingTitle}>Votre demande a-t-elle été bien traitée ?</Text>
      <View style={{ flexDirection: 'row', justifyContent: 'center' }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((value) => (
          <IconButton key={value} icon={value <= rating ? 'star' : 'star-outline'} color={colors.warning} size={28}
            accessibilityLabel={`${value} étoile${value > 1 ? 's' : ''}`} onPress={() => setRating(value)} />
        ))}
      </View>
      {rating ? (
        <>
          <TextInput value={comment} onChangeText={setComment} placeholder="Un commentaire ? (optionnel)" placeholderTextColor={colors.textMuted}
            accessibilityLabel="Commentaire" maxLength={500} style={styles.ratingInput} />
          <Button title="Envoyer mon avis" onPress={() => save.mutate()} loading={save.isPending} compact />
        </>
      ) : null}
    </View>
  );
}

export default function TicketDetailScreen({ route, navigation }) {
  const { id, created } = route.params;
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef(null);
  const [text, setText] = useState('');
  const [file, setFile] = useState(null);

  const ticket = useQuery({ queryKey: ['ticket', Number(id)], queryFn: () => api.get(`/tickets/${id}`).then((r) => r.data) });
  const messages = useQuery({ queryKey: ['messages', Number(id)], queryFn: () => api.get(`/tickets/${id}/messages`).then((r) => r.data.content) });

  useLayoutEffect(() => { navigation.setOptions({ title: `Demande #${id}` }); }, [navigation, id]);

  // Reading the conversation clears its unread badge.
  useEffect(() => {
    if (!messages.data) return;
    api.post(`/tickets/${id}/read`).then(() => {
      queryClient.invalidateQueries({ queryKey: ['unread'] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    }).catch(() => {});
  }, [messages.data, id, queryClient]);

  const send = useMutation({
    mutationFn: async () => {
      if (!file) return api.post(`/tickets/${id}/messages`, { content: text.trim() });
      const form = new FormData();
      form.append('content', text.trim());
      await appendFile(form, 'attachment', file);
      return api.post(`/tickets/${id}/messages`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
    },
    onSuccess: () => {
      setText('');
      setFile(null);
      queryClient.invalidateQueries({ queryKey: ['messages', Number(id)] });
    },
    onError: (error) => notify('Envoi impossible', errorMessage(error)),
  });

  const setStatus = useMutation({
    mutationFn: (status) => api.patch(`/tickets/${id}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ticket', Number(id)] });
      queryClient.invalidateQueries({ queryKey: ['messages', Number(id)] });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
    },
    onError: (error) => notify('Action impossible', errorMessage(error)),
  });

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['image/*', 'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    if (asset.size && asset.size > 10 * 1024 * 1024) { notify('Fichier trop volumineux', 'La taille maximale est de 10 Mo.'); return; }
    setFile(asset);
  };

  if (ticket.isPending) return <Loading />;
  if (ticket.isError) return <ErrorState message={ticket.error?.response?.status === 404 ? 'Demande introuvable.' : errorMessage(ticket.error)} onRetry={ticket.refetch} />;
  const t = ticket.data;
  const closed = t.status === 'closed';
  const canReopen = closed && withinReopenWindow(t.closedAt);

  const header = (
    <View style={styles.header}>
      {created ? <Text style={styles.created} accessibilityRole="alert">Demande envoyée ! Le service {t.department?.name} vous répondra ici. Vous recevrez une notification.</Text> : null}
      <Text style={styles.title} accessibilityRole="header">{t.title}</Text>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
        <StatusBadge status={t.status} />
        <Text style={styles.meta}>{t.department?.name} · ouverte le {formatDateTime(t.createdAt)}</Text>
      </View>
    </View>
  );

  const footer = closed ? (
    <View style={[styles.closedBox, { paddingBottom: Math.max(insets.bottom, spacing.lg) }]}>
      <Rating ticket={t} />
      {canReopen ? <Button title="Rouvrir la demande" variant="secondary" icon="refresh" onPress={() => setStatus.mutate('open')} loading={setStatus.isPending} /> : (
        <Text style={styles.meta}>Fermée depuis plus de {REOPEN_DAYS} jours : ouvrez une nouvelle demande si besoin.</Text>
      )}
    </View>
  ) : (
    <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {file ? (
        <View style={styles.fileChip}>
          <Ionicons name="document-attach-outline" size={16} color={colors.primary} />
          <Text numberOfLines={1} style={{ flex: 1, color: colors.text }}>{file.name}</Text>
          <IconButton icon="close" accessibilityLabel="Retirer la pièce jointe" onPress={() => setFile(null)} size={18} />
        </View>
      ) : null}
      <View style={styles.composerRow}>
        <IconButton icon="attach" accessibilityLabel="Joindre un fichier" color={colors.textSoft} onPress={pickFile} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Votre message…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Votre message"
          multiline
          maxLength={4000}
          style={styles.input}
        />
        <IconButton
          icon="send"
          color={text.trim() || file ? colors.primary : colors.textMuted}
          accessibilityLabel="Envoyer"
          onPress={() => { if ((text.trim() || file) && !send.isPending) send.mutate(); }}
        />
      </View>
      <Pressable accessibilityRole="button" onPress={async () => {
        if (await confirm('Fermer la demande ?', 'Fermez-la si votre problème est résolu. Vous pourrez la rouvrir pendant 14 jours.', 'Fermer')) setStatus.mutate('closed');
      }} style={styles.closeLink}>
        <Text style={{ color: colors.textSoft, fontWeight: '600' }}>Mon problème est résolu — fermer la demande</Text>
      </Pressable>
    </View>
  );

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <FlatList
        ref={listRef}
        data={messages.data || []}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => <Message message={item} />}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
        ListEmptyComponent={messages.isPending ? <Loading /> : null}
      />
      {footer}
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  header: { gap: spacing.sm, marginBottom: spacing.sm },
  created: { backgroundColor: colors.successSoft, color: colors.success, padding: spacing.md, borderRadius: radius.md, fontWeight: '600' },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  meta: { color: colors.textMuted, fontSize: 13 },
  messageRow: { gap: 3 },
  sender: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  bubble: { maxWidth: '85%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18, gap: 6 },
  mine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.bubbleOther, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  attachment: { flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36 },
  time: { fontSize: 11, color: colors.textMuted },
  system: { alignSelf: 'center', color: colors.textMuted, fontSize: 12, textAlign: 'center', paddingVertical: 4 },
  composer: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  input: { flex: 1, minHeight: MIN_TOUCH, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.cardMuted, color: colors.text, fontSize: 15 },
  fileChip: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingLeft: spacing.md, marginBottom: 4, backgroundColor: colors.primarySoft, borderRadius: radius.md },
  closeLink: { alignItems: 'center', justifyContent: 'center', minHeight: MIN_TOUCH },
  closedBox: { borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card, padding: spacing.lg, gap: spacing.md },
  ratingBox: { gap: spacing.sm },
  ratingTitle: { textAlign: 'center', fontWeight: '700', color: colors.text },
  ratingInput: { minHeight: MIN_TOUCH, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: spacing.md, color: colors.text },
  ratingDone: { textAlign: 'center', color: colors.textSoft },
});
