import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StatusBar,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../context/AuthContext';
import api from '../api/axios';
import { colors } from '../theme/colors';

const QUICK_QUESTIONS = [
  "Quels sont les horaires de la bibliothèque ?",
  "Comment contacter le service scolarité ?",
  "Procédure d'inscription universitaire",
  "Où se trouve le département IT ?",
];

export default function ChatScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const [messages, setMessages] = useState([
    {
      id: 'welcome',
      role: 'assistant',
      content: `Bonjour ${user?.firstname || ''} ! Je suis l'assistant RAG de l'Université SESAME. Posez-moi vos questions par texte ou message vocal sur les cours, les départements ou les démarches administratives.`,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const flatListRef = useRef(null);
  const timerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const scrollToBottom = () => {
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);
  };

  const handleSendText = async (textToSend) => {
    const query = (textToSend || input).trim();
    if (!query || sending) return;

    const userMsg = {
      id: Date.now().toString(),
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    scrollToBottom();

    try {
      const historyPayload = messages
        .filter((m) => m.id !== 'welcome')
        .slice(-6)
        .map((m) => ({ role: m.role, content: m.content }));

      const res = await api.post('/chat', {
        message: query,
        userId: user?.id,
        history: historyPayload,
      });

      const assistantMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: res.data?.reply || 'Désolé, aucune réponse générée.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '⚠️ Erreur de connexion avec le serveur RAG.',
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        isError: true,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setSending(false);
      scrollToBottom();
    }
  };

  const toggleRecording = async () => {
    if (!recording) {
      setRecording(true);
      setRecordingSeconds(0);
      timerRef.current = setInterval(() => {
        setRecordingSeconds((sec) => sec + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
      const duration = recordingSeconds;
      setRecording(false);
      setRecordingSeconds(0);

      if (duration < 1) {
        Alert.alert('Message vocal trop court', 'Maintenez l\'enregistrement plus d\'une seconde.');
        return;
      }

      const voiceUserMsg = {
        id: Date.now().toString(),
        role: 'user',
        content: `🎙️ Message vocal (${duration}s)`,
        isVoice: true,
        timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      };

      setMessages((prev) => [...prev, voiceUserMsg]);
      setSending(true);
      scrollToBottom();

      try {
        const formData = new FormData();
        formData.append('audio', {
          uri: Platform.OS === 'android' ? 'file:///tmp/voice.m4a' : 'voice.m4a',
          type: 'audio/m4a',
          name: 'voice.m4a',
        });

        const res = await api.post('/chat/voice', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });

        const assistantMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: res.data?.reply || 'Message vocal traité.',
          transcription: res.data?.transcription,
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
        };

        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        console.error('Voice chat error:', err);
        const errorMsg = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: '⚠️ Erreur lors du traitement du message vocal par le serveur RAG.',
          timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          isError: true,
        };
        setMessages((prev) => [...prev, errorMsg]);
      } finally {
        setSending(false);
        scrollToBottom();
      }
    }
  };

  const handleClearHistory = () => {
    Alert.alert(
      'Effacer la conversation',
      'Voulez-vous réinitialiser le chat ?',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Effacer',
          style: 'destructive',
          onPress: () => {
            setMessages([
              {
                id: 'welcome',
                role: 'assistant',
                content: `Bonjour ${user?.firstname || ''} ! Chat réinitialisé. Posez-moi vos questions par texte ou message vocal.`,
                timestamp: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
              },
            ]);
          },
        },
      ]
    );
  };

  const renderMessageItem = ({ item }) => {
    const isUser = item.role === 'user';
    return (
      <View
        style={[
          styles.msgRow,
          isUser ? styles.msgRowUser : styles.msgRowAssistant,
        ]}
      >
        {!isUser && (
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>🤖</Text>
          </View>
        )}
        <View
          style={[
            styles.bubble,
            isUser ? styles.bubbleUser : styles.bubbleAssistant,
            item.isError && styles.bubbleError,
          ]}
        >
          <Text style={[styles.msgText, isUser ? styles.msgTextUser : styles.msgTextAssistant]}>
            {item.content}
          </Text>
          {item.transcription ? (
            <Text style={styles.transcriptionText}>
              Transcription: "{item.transcription}"
            </Text>
          ) : null}
          <Text style={[styles.timestamp, isUser ? styles.timestampUser : styles.timestampAssistant]}>
            {item.timestamp}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />

      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top + 10, Platform.OS === 'android' ? 36 : 16) }]}>
        <View>
          <View style={styles.headerTitleRow}>
            <Text style={styles.headerTitle}>Assistant IA SESAME</Text>
            <View style={styles.serverBadge}>
              <Text style={styles.serverBadgeText}>RAG Model (Serveur)</Text>
            </View>
          </View>
          <Text style={styles.headerSub}>Questions & Réponses Université</Text>
        </View>

        <TouchableOpacity onPress={handleClearHistory} style={styles.clearBtn}>
          <Text style={styles.clearBtnText}>Effacer</Text>
        </TouchableOpacity>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessageItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={scrollToBottom}
          ListFooterComponent={
            sending ? (
              <View style={styles.typingIndicator}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.typingText}>L'assistant rédigé sa réponse...</Text>
              </View>
            ) : null
          }
        />

        {messages.length < 3 && !sending && (
          <View style={styles.quickQuestionsContainer}>
            <Text style={styles.quickTitle}>Suggestions d'échantillons :</Text>
            <FlatList
              horizontal
              showsHorizontalScrollIndicator={false}
              data={QUICK_QUESTIONS}
              keyExtractor={(q, i) => String(i)}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.chip}
                  onPress={() => handleSendText(item)}
                >
                  <Text style={styles.chipText}>{item}</Text>
                </TouchableOpacity>
              )}
            />
          </View>
        )}

        {recording && (
          <View style={styles.recordingBanner}>
            <View style={styles.redDot} />
            <Text style={styles.recordingText}>Enregistrement vocal en cours... {recordingSeconds}s</Text>
          </View>
        )}

        {/* Bottom Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={[styles.voiceBtn, recording && styles.voiceBtnActive]}
            onPress={toggleRecording}
            activeOpacity={0.8}
          >
            <Text style={styles.voiceIcon}>{recording ? '⏹' : '🎙️'}</Text>
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            value={input}
            onChangeText={setInput}
            placeholder={recording ? "Enregistrement en cours..." : "Posez votre question par texte..."}
            placeholderTextColor="#9CA3AF"
            editable={!recording && !sending}
            multiline
            maxLength={500}
          />

          <TouchableOpacity
            style={[
              styles.sendBtn,
              (!input.trim() || sending || recording) && styles.sendBtnDisabled,
            ]}
            onPress={() => handleSendText()}
            disabled={!input.trim() || sending || recording}
            activeOpacity={0.85}
          >
            {sending ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Text style={styles.sendIcon}>➔</Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  header: {
    backgroundColor: colors.primaryDark,
    paddingBottom: 14,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    color: '#FFFFFF',
    fontSize: 17,
    fontWeight: '700',
  },
  serverBadge: {
    backgroundColor: 'rgba(14, 165, 233, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(14, 165, 233, 0.4)',
  },
  serverBadgeText: {
    color: '#38BDF8',
    fontSize: 10,
    fontWeight: '700',
  },
  headerSub: {
    color: colors.textSoft,
    fontSize: 12,
    marginTop: 2,
  },
  clearBtn: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  clearBtnText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 24,
  },
  msgRow: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
  },
  msgRowUser: {
    justifyContent: 'flex-end',
  },
  msgRowAssistant: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#EFF6FF',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
    borderWidth: 1,
    borderColor: '#DBEAFE',
  },
  avatarText: {
    fontSize: 16,
  },
  bubble: {
    maxWidth: '80%',
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 3,
    elevation: 1,
  },
  bubbleUser: {
    backgroundColor: colors.primary,
    borderBottomRightRadius: 4,
  },
  bubbleAssistant: {
    backgroundColor: '#FFFFFF',
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bubbleError: {
    backgroundColor: '#FEF2F2',
    borderColor: '#FECACA',
  },
  msgText: {
    fontSize: 14.5,
    lineHeight: 21,
  },
  msgTextUser: {
    color: '#FFFFFF',
  },
  msgTextAssistant: {
    color: colors.text,
  },
  transcriptionText: {
    fontSize: 12,
    fontStyle: 'italic',
    color: colors.textSoft,
    marginTop: 6,
  },
  timestamp: {
    fontSize: 10,
    marginTop: 6,
    alignSelf: 'flex-end',
  },
  timestampUser: {
    color: 'rgba(255,255,255,0.7)',
  },
  timestampAssistant: {
    color: '#9CA3AF',
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  typingText: {
    fontSize: 13,
    color: colors.textSoft,
    fontStyle: 'italic',
  },
  quickQuestionsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  quickTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.textSoft,
    marginBottom: 6,
  },
  chip: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
  },
  chipText: {
    fontSize: 12.5,
    color: colors.primary,
    fontWeight: '500',
  },
  recordingBanner: {
    backgroundColor: '#FEF2F2',
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#FECACA',
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  redDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#EF4444',
  },
  recordingText: {
    color: '#DC2626',
    fontSize: 13,
    fontWeight: '600',
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 8,
  },
  voiceBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
  },
  voiceBtnActive: {
    backgroundColor: '#EF4444',
    borderColor: '#DC2626',
  },
  voiceIcon: {
    fontSize: 18,
  },
  textInput: {
    flex: 1,
    maxHeight: 100,
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14.5,
    color: colors.text,
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: {
    backgroundColor: '#9CA3AF',
  },
  sendIcon: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
