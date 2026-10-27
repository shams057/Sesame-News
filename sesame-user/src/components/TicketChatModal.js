import React, { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { io } from 'socket.io-client';
import { BASE_URL, default as api } from '../api/axios';
import { colors } from '../theme/colors';

function messageTime(value) {
  return new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

async function markTicketRead(ticketId, token) {
  if (!ticketId || !token) return;
  try {
    await api.post(`/tickets/${ticketId}/messages/read`, {}, { headers: { Authorization: `Bearer ${token}` } });
  } catch {
    // The history remains available if marking a message as read fails.
  }
}

export default function TicketChatModal({ visible, ticket, token, onClose }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const listRef = useRef(null);
  const ticketId = ticket?.id;

  useEffect(() => {
    if (!visible || !ticketId || !token) return undefined;
    let active = true;
    api.get(`/tickets/${ticketId}/messages`, { headers: { Authorization: `Bearer ${token}` } })
      .then((response) => {
        if (!active) return;
        setMessages(response.data.content || []);
        markTicketRead(ticketId, token);
      })
      .catch((err) => {
        if (active) setError(err.response?.data?.error || 'Impossible de charger la conversation.');
      })
      .finally(() => { if (active) setLoading(false); });
    const socket = io(BASE_URL, { auth: { token }, transports: ['websocket', 'polling'] });
    socket.on('connect', () => socket.emit('ticket:join', ticketId));
    socket.on('ticket:message', (message) => {
      if (Number(message.ticketId) !== Number(ticketId)) return;
      setMessages((current) => current.some((item) => item.id === message.id) ? current : [...current, message]);
      if (message.senderRole !== 'user') markTicketRead(ticketId, token);
    });
    return () => {
      active = false;
      socket.emit('ticket:leave', ticketId);
      socket.disconnect();
    };
  }, [visible, ticketId, token]);

  const sendMessage = async () => {
    const content = input.trim();
    if (!content || sending) return;
    setSending(true);
    setError('');
    setInput('');
    try {
      const response = await api.post(`/tickets/${ticket.id}/messages`, { content }, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setMessages((current) => current.some((item) => item.id === response.data.id) ? current : [...current, response.data]);
    } catch (err) {
      setInput(content);
      setError(err.response?.data?.error || 'Impossible d’envoyer le message.');
    } finally {
      setSending(false);
    }
  };

  const renderMessage = ({ item }) => {
    const own = item.senderRole === 'user';
    return (
      <View style={[styles.messageRow, own ? styles.messageRowOwn : styles.messageRowReceived]}>
        <View style={[styles.messageGroup, own ? styles.messageGroupOwn : styles.messageGroupReceived]}>
          <Text style={[styles.role, own ? styles.roleOwn : styles.roleReceived]}>{own ? 'Vous' : 'Support'}</Text>
          <View style={[styles.bubble, own ? styles.bubbleOwn : styles.bubbleReceived]}>
            <Text style={[styles.messageText, own ? styles.messageTextOwn : styles.messageTextReceived]}>{item.content}</Text>
            <Text style={[styles.timestamp, own ? styles.timestampOwn : styles.timestampReceived]}>{messageTime(item.createdAt)}</Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer la conversation" onPress={onClose} style={StyleSheet.absoluteFill} />
        <View style={styles.popup}>
          <View style={styles.header}>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Ticket #{ticket?.id} · Conversation</Text>
              <Text numberOfLines={1} style={styles.headerSub}>{ticket?.sujet}</Text>
            </View>
            <TouchableOpacity accessibilityRole="button" accessibilityLabel="Fermer le chat" onPress={onClose} style={styles.closeButton}>
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>
          <KeyboardAvoidingView style={styles.chatBody} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
            {loading ? <ActivityIndicator style={styles.loader} color={colors.primary} /> : (
              <FlatList
                ref={listRef}
                data={messages}
                keyExtractor={(item) => String(item.id)}
                renderItem={renderMessage}
                contentContainerStyle={styles.messageList}
                onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: true })}
                ListEmptyComponent={<Text style={styles.empty}>Aucun message. Commencez la conversation avec le support.</Text>}
              />
            )}
            {error ? <Text style={styles.error}>{error}</Text> : null}
            {ticket?.rawStatus === 'closed' ? (
              <Text style={styles.closedNote}>Ce ticket est fermé. Rouvrez-le pour envoyer un message.</Text>
            ) : (
              <View style={styles.inputBar}>
                <TextInput
                  value={input}
                  onChangeText={setInput}
                  style={styles.input}
                  placeholder="Écrire un message…"
                  placeholderTextColor="#9CA3AF"
                  multiline
                  maxLength={4000}
                  editable={!sending}
                />
                <TouchableOpacity style={[styles.sendButton, (!input.trim() || sending) && styles.sendDisabled]} onPress={sendMessage} disabled={!input.trim() || sending}>
                  {sending ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.sendText}>➤</Text>}
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingHorizontal: 12, paddingBottom: 12, backgroundColor: 'rgba(15,23,42,0.34)' },
  popup: { width: '100%', height: '76%', maxHeight: 650, maxWidth: 460, overflow: 'hidden', borderRadius: 18, backgroundColor: '#fff', elevation: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.22, shadowRadius: 18 },
  header: { minHeight: 68, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.primaryDark },
  headerCopy: { flex: 1, minWidth: 0 },
  headerTitle: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerSub: { color: colors.textSoft, fontSize: 11, marginTop: 3 },
  closeButton: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center', borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.14)', marginLeft: 12 },
  closeText: { color: '#fff', fontSize: 24, lineHeight: 27 },
  chatBody: { flex: 1, minHeight: 0, backgroundColor: colors.bg },
  loader: { flex: 1 },
  messageList: { padding: 16, paddingBottom: 20, flexGrow: 1 },
  messageRow: { flexDirection: 'row', marginBottom: 14 },
  messageRowOwn: { justifyContent: 'flex-end' },
  messageRowReceived: { justifyContent: 'flex-start' },
  messageGroup: { maxWidth: '84%' },
  messageGroupOwn: { alignItems: 'flex-end' },
  messageGroupReceived: { alignItems: 'flex-start' },
  role: { fontSize: 10, fontWeight: '700', marginBottom: 4 },
  roleOwn: { color: '#64748B', textAlign: 'right' },
  roleReceived: { color: colors.primary },
  bubble: { paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, minWidth: 64 },
  bubbleOwn: { backgroundColor: '#F3F4F6', borderBottomRightRadius: 4 },
  bubbleReceived: { backgroundColor: colors.primary, borderBottomLeftRadius: 4 },
  messageText: { fontSize: 14, lineHeight: 20 },
  messageTextOwn: { color: colors.text },
  messageTextReceived: { color: '#fff' },
  timestamp: { fontSize: 10, marginTop: 5, alignSelf: 'flex-end' },
  timestampOwn: { color: '#9CA3AF' },
  timestampReceived: { color: 'rgba(255,255,255,.72)' },
  empty: { flex: 1, textAlign: 'center', textAlignVertical: 'center', color: colors.textSoft, fontSize: 13, lineHeight: 20, paddingHorizontal: 24 },
  error: { color: colors.danger, fontSize: 12, paddingHorizontal: 14, paddingBottom: 7 },
  closedNote: { padding: 14, textAlign: 'center', color: colors.textSoft, backgroundColor: '#fff', fontSize: 12 },
  inputBar: { flexDirection: 'row', alignItems: 'center', padding: 12, backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: colors.border, gap: 8 },
  input: { flex: 1, maxHeight: 96, minHeight: 42, paddingHorizontal: 15, paddingVertical: 10, borderRadius: 20, borderWidth: 1, borderColor: colors.border, backgroundColor: '#F9FAFB', color: colors.text, fontSize: 14 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primary },
  sendDisabled: { backgroundColor: '#9CA3AF' },
  sendText: { color: '#fff', fontSize: 17, fontWeight: '700' },
});
