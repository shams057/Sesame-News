import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  StatusBar,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import api from '../api/axios';
import { colors } from '../theme/colors';

const DEPARTMENTS = [
  'Service Scolarité',
  'Service Stage',
  'Département licence Informatique',
  'Département Management',
  'Département Prepa_Ingénieur',
  'Département FTA',
  'Service IT',
  'Service qualité',
  'Service coopération international',
  'Service Marketing',
  'Service Admission',
  'Service Finance',
  'Service Student Success',
];

export default function NewTicketModal({ visible, token, onClose, onCreated }) {
  const insets = useSafeAreaInsets();
  const [department, setDepartment] = useState('');
  const [departmentOpen, setDepartmentOpen] = useState(false);
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const close = () => {
    setDepartment('');
    setDepartmentOpen(false);
    setSubject('');
    setDescription('');
    setError('');
    setSubmitted(false);
    onClose();
  };

  const createTicket = async () => {
    if (!department || !subject.trim() || !description.trim()) {
      setError('Choisis un service et remplis le sujet et la description.');
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const response = await api.post(
        '/createticket',
        {
          title: subject.trim(),
          description: description.trim(),
          department,
          status: 'open',
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      await onCreated?.(response.data);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de créer votre demande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close}>
      <StatusBar barStyle="light-content" backgroundColor={colors.primaryDark} />
      <KeyboardAvoidingView
        style={[
          styles.overlay,
          {
            paddingTop: Math.max(insets.top + 8, 16),
            paddingBottom: Math.max(insets.bottom + 12, 24),
          },
        ]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fermer le formulaire de ticket"
          onPress={close}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.popup}>
          <View style={styles.header}>
            <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
            <View style={styles.headerCopy}>
              <Text style={styles.headerTitle}>Assistance SESAME</Text>
              <Text style={styles.headerSubtitle}>Nouveau ticket</Text>
            </View>
            <TouchableOpacity
              accessibilityRole="button"
              accessibilityLabel="Fermer"
              onPress={close}
              style={styles.closeButton}
            >
              <Text style={styles.closeText}>×</Text>
            </TouchableOpacity>
          </View>

          {submitted ? (
            <View style={styles.successState}>
              <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View>
              <Text style={styles.successTitle}>Demande envoyée</Text>
              <Text style={styles.successCopy}>Votre ticket a bien été créé.</Text>
              <TouchableOpacity style={styles.primaryButton} onPress={close}>
                <Text style={styles.primaryButtonText}>Terminé</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView
              style={styles.popupBody}
              contentContainerStyle={styles.popupContent}
              keyboardShouldPersistTaps="handled"
            >
              <View style={styles.chatIntro}>
                <View style={styles.chatAvatar}><Text style={styles.chatAvatarText}>S</Text></View>
                <Text style={styles.chatMessage}>
                  Bonjour ! Choisissez le service concerné et décrivez votre demande.
                </Text>
              </View>

              <Text style={styles.label}>Service concerné *</Text>
              <TouchableOpacity
                accessibilityRole="button"
                accessibilityState={{ expanded: departmentOpen }}
                onPress={() => setDepartmentOpen((open) => !open)}
                style={styles.departmentSelector}
              >
                <Text style={[styles.selectorText, !department && styles.placeholder]}>
                  {department || 'Choisir un service'}
                </Text>
                <Text style={styles.chevron}>{departmentOpen ? '⌃' : '⌄'}</Text>
              </TouchableOpacity>

              {departmentOpen && (
                <ScrollView
                  style={styles.departmentDropdown}
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="handled"
                >
                  {DEPARTMENTS.map((item) => (
                    <TouchableOpacity
                      key={item}
                      accessibilityRole="button"
                      accessibilityState={{ selected: department === item }}
                      onPress={() => {
                        setDepartment(item);
                        setDepartmentOpen(false);
                      }}
                      style={[styles.departmentOption, department === item && styles.departmentOptionActive]}
                    >
                      <Text style={[styles.departmentOptionText, department === item && styles.departmentOptionTextActive]}>
                        {item}
                      </Text>
                      <Text style={styles.optionCheck}>{department === item ? '✓' : ''}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              <Text style={styles.label}>Sujet *</Text>
              <TextInput
                accessibilityLabel="Sujet du ticket"
                style={styles.input}
                placeholder="Ex. : Demande d'attestation"
                placeholderTextColor={colors.textSoft}
                value={subject}
                onChangeText={setSubject}
                maxLength={100}
              />

              <Text style={styles.label}>Description *</Text>
              <TextInput
                accessibilityLabel="Description de la demande"
                style={[styles.input, styles.descriptionInput]}
                placeholder="Explique ta demande en détail..."
                placeholderTextColor={colors.textSoft}
                value={description}
                onChangeText={setDescription}
                multiline
                textAlignVertical="top"
                maxLength={1000}
              />

              {error ? <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                accessibilityRole="button"
                onPress={createTicket}
                disabled={submitting}
                style={[styles.primaryButton, submitting && styles.disabledButton]}
              >
                {submitting ? (
                  <ActivityIndicator color={colors.white} />
                ) : (
                  <Text style={styles.primaryButtonText}>Créer ma demande  →</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'flex-end',
    justifyContent: 'flex-end',
    paddingHorizontal: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.42)',
  },
  popup: {
    width: '100%',
    maxWidth: 390,
    maxHeight: '72%',
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    overflow: 'hidden',
    elevation: 18,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: colors.primaryDark,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.12)',
    gap: 12,
  },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.white, fontSize: 14, fontWeight: '800' },
  headerSubtitle: { color: '#B9C8E8', fontSize: 11, marginTop: 3 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  closeButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.white, fontSize: 26, lineHeight: 29 },
  popupBody: { flexShrink: 1 },
  popupContent: { paddingHorizontal: 16, paddingTop: 14, paddingBottom: 16 },
  chatIntro: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    marginBottom: 4,
  },
  chatAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: '#EAF0FF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  chatAvatarText: { color: colors.primary, fontSize: 13, fontWeight: '900' },
  chatMessage: {
    flex: 1,
    backgroundColor: '#F3F5F9',
    borderRadius: 12,
    borderBottomLeftRadius: 3,
    paddingHorizontal: 11,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 12,
    lineHeight: 17,
  },
  label: { color: colors.text, fontSize: 12, fontWeight: '800', marginTop: 14, marginBottom: 6 },
  departmentSelector: {
    minHeight: 42,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
  },
  selectorText: { flex: 1, color: colors.text, fontSize: 13 },
  placeholder: { color: colors.textSoft },
  chevron: { color: colors.textSoft, fontSize: 18 },
  departmentDropdown: {
    maxHeight: 150,
    marginTop: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    overflow: 'hidden',
  },
  departmentOption: {
    minHeight: 44,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  departmentOptionActive: { backgroundColor: '#EAF0FF' },
  departmentOptionText: { flex: 1, color: colors.text, fontSize: 13 },
  departmentOptionTextActive: { color: colors.primary, fontWeight: '700' },
  optionCheck: { color: colors.primary, fontSize: 16, fontWeight: '700' },
  input: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    color: colors.text,
  },
  descriptionInput: { minHeight: 76, paddingTop: 10 },
  errorText: { color: colors.danger, fontSize: 12, marginTop: 9 },
  primaryButton: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 9,
    paddingHorizontal: 18,
    marginTop: 14,
  },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  successState: { alignItems: 'center', justifyContent: 'center', padding: 24 },
  successMark: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E7F7F0',
  },
  successMarkText: { color: colors.success, fontSize: 34, fontWeight: '700' },
  successTitle: { color: colors.text, fontSize: 21, fontWeight: '800', marginTop: 20 },
  successCopy: { color: colors.textSoft, fontSize: 14, marginTop: 8 },
});