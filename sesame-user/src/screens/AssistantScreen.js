import React, { useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import api, { errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { confirm } from '../utils/confirm';
import { notify } from '../utils/files';
import { EmptyState, ErrorState, IconButton, KeyboardAvoidingScreen, Loading } from '../components/ui';

const SUGGESTIONS = ['Quand ont lieu les examens ?', 'Comment obtenir une attestation de scolarité ?', 'Quels sont les prochains événements ?'];

function Bubble({ message, onOpenSource }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const mine = message.role === 'user';
  return (
    <View style={{ alignItems: mine ? 'flex-end' : 'flex-start', gap: 4 }}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={{ color: mine ? '#fff' : colors.text, fontSize: 15, lineHeight: 21 }} selectable>{message.content}</Text>
      </View>
      {message.sources?.length ? (
        <View style={styles.sources}>
          {message.sources.map((source) => (
            <Pressable key={source.id} accessibilityRole="link" onPress={() => onOpenSource(source)} style={styles.source}>
              <Ionicons name="newspaper-outline" size={13} color={colors.primary} />
              <Text numberOfLines={1} style={{ color: colors.primary, fontSize: 12, fontWeight: '600', flexShrink: 1 }}>[{source.ref}] {source.title}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export default function AssistantScreen({ navigation }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const listRef = useRef(null);
  const [input, setInput] = useState('');
  const [pending, setPending] = useState(null);

  const state = useQuery({ queryKey: ['assistant'], queryFn: () => api.get('/assistant').then((r) => r.data) });

  const clear = async () => {
    if (!(await confirm('Effacer la conversation ?', 'L’historique de vos questions sera supprimé.', 'Effacer', true))) return;
    await api.delete('/assistant/messages').catch(() => {});
    queryClient.invalidateQueries({ queryKey: ['assistant'] });
  };

  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => (state.data?.messages.length ? <IconButton icon="trash-outline" accessibilityLabel="Effacer la conversation" color={colors.textSoft} onPress={clear} /> : null) });
  });

  const onSuccess = () => {
    setPending(null);
    queryClient.invalidateQueries({ queryKey: ['assistant'] });
  };
  const onError = (error) => {
    setPending(null);
    notify('Assistant', errorMessage(error, 'L’assistant n’a pas pu répondre.'));
  };

  const ask = useMutation({
    mutationFn: (message) => api.post('/assistant/messages', { message }),
    onSuccess,
    onError,
  });

  const send = (text = input) => {
    const message = text.trim();
    if (!message || ask.isPending) return;
    setInput('');
    setPending(message);
    ask.mutate(message);
  };

  if (state.isPending) return <Loading />;
  if (state.isError) return <ErrorState message={errorMessage(state.error)} onRetry={state.refetch} />;
  if (!state.data.available) {
    return (
      <EmptyState
        icon="sparkles-outline"
        title="Assistant bientôt disponible"
        message="L’assistant n’est pas encore activé par l’université. En attendant, ouvrez une demande auprès du service concerné."
      />
    );
  }

  const messages = [...state.data.messages, ...(pending ? [{ id: 'pending', role: 'user', content: pending }] : [])];
  const busy = ask.isPending;

  return (
    <KeyboardAvoidingScreen style={styles.screen}>
      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(message) => String(message.id)}
        renderItem={({ item }) => (
          <Bubble message={item} onOpenSource={(source) => navigation.navigate('Main', { screen: 'FeedTab', params: { screen: 'NewsDetail', params: { id: source.id } } })} />
        )}
        contentContainerStyle={styles.list}
        onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
        ListHeaderComponent={(
          <Text style={styles.disclaimer}>L’assistant répond à partir des actualités publiées par l’université et cite ses sources. Vérifiez les informations importantes auprès des services.</Text>
        )}
        ListEmptyComponent={(
          <View style={{ gap: spacing.sm }}>
            {SUGGESTIONS.map((suggestion) => (
              <Pressable key={suggestion} accessibilityRole="button" onPress={() => send(suggestion)} style={styles.suggestion}>
                <Text style={{ color: colors.primary, fontWeight: '600' }}>{suggestion}</Text>
              </Pressable>
            ))}
          </View>
        )}
        ListFooterComponent={busy ? <ActivityIndicator style={{ marginTop: spacing.md }} color={colors.primary} accessibilityLabel="L’assistant rédige une réponse" /> : null}
      />
      <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
        <TextInput
          value={input}
          onChangeText={setInput}
          placeholder="Posez votre question…"
          placeholderTextColor={colors.textMuted}
          accessibilityLabel="Votre question"
          maxLength={1000}
          multiline
          style={styles.input}
          onSubmitEditing={() => send()}
        />
        <IconButton icon="send" color={input.trim() && !busy ? colors.primary : colors.textMuted} accessibilityLabel="Envoyer la question" onPress={() => send()} />
      </View>
    </KeyboardAvoidingScreen>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 760, alignSelf: 'center' },
  disclaimer: { color: colors.textMuted, fontSize: 12, textAlign: 'center', marginBottom: spacing.sm },
  bubble: { maxWidth: '88%', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 18 },
  mine: { backgroundColor: colors.bubbleMine, borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.bubbleOther, borderWidth: 1, borderColor: colors.border, borderBottomLeftRadius: 4 },
  sources: { gap: 4, maxWidth: '88%' },
  source: { flexDirection: 'row', alignItems: 'center', gap: 4, minHeight: 28 },
  suggestion: { padding: spacing.md, minHeight: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 4, padding: spacing.sm, borderTopWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  input: { flex: 1, minHeight: MIN_TOUCH, maxHeight: 120, paddingHorizontal: spacing.md, paddingVertical: 10, borderRadius: 22, backgroundColor: colors.cardMuted, color: colors.text, fontSize: 15 },
});
