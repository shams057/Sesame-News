import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
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

export default function NewTicketModal({ visible, token, onClose }) {
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
      await api.post(
        '/createticket',
        {
          title: subject.trim(),
          description: description.trim(),
          department,
          status: 'open',
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : {} }
      );
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Impossible de créer votre demande. Réessayez.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <StatusBar
        barStyle={visible ? 'dark-content' : 'light-content'}
        backgroundColor={visible ? '#F5F7FC' : colors.primaryDark}
      />
      <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <TouchableOpacity
            accessibilityRole="button"
            accessibilityLabel="Fermer le formulaire"
            onPress={close}
            style={styles.closeButton}
          >
            <Text style={styles.closeText}>‹</Text>
          </TouchableOpacity>
          <View style={styles.headerCopy}>
            <Text style={styles.headerTitle}>Nouveau ticket</Text>
            <Text style={styles.headerSubtitle}>Décris ta demande au service concerné</Text>
          </View>
          <View style={styles.logo}><Text style={styles.logoText}>S</Text></View>
        </View>

        {submitted ? (
          <View style={styles.successState}>
            <View style={styles.successMark}><Text style={styles.successMarkText}>✓</Text></View>
            <Text style={styles.successTitle}>Demande envoyée</Text>
            <Text style={styles.successCopy}>Votre ticket a bien été créé.</Text>
            <TouchableOpacity style={styles.primaryButton} onPress={close}>
              <Text style={styles.primaryButtonText}>Retour au fil d'actualités</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <KeyboardAvoidingView
            style={styles.formWrapper}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <ScrollView
              contentContainerStyle={styles.formContent}
              keyboardShouldPersistTaps="handled"
            >
              <Text style={styles.label}>Service concerné *</Text>
              <Text style={styles.hint}>Sélectionne le service à contacter.</Text>
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

              <Text style={styles.hint}>* Tous les champs sont obligatoires.</Text>
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
              <TouchableOpacity style={styles.cancelButton} onPress={close}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F5F7FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: 12,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#F5F7FC',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: { color: colors.text, fontSize: 32, lineHeight: 35 },
  headerCopy: { flex: 1 },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: '800' },
  headerSubtitle: { color: colors.textSoft, fontSize: 12, marginTop: 3 },
  logo: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: { color: colors.white, fontSize: 20, fontWeight: '900' },
  formWrapper: { flex: 1 },
  formContent: { width: '100%', maxWidth: 760, alignSelf: 'center', padding: 20, paddingBottom: 36 },
  label: { color: colors.text, fontSize: 14, fontWeight: '800', marginTop: 20, marginBottom: 8 },
  hint: { color: colors.textSoft, fontSize: 11, lineHeight: 17, marginBottom: 10 },
  departmentSelector: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
  },
  selectorText: { flex: 1, color: colors.text, fontSize: 13 },
  placeholder: { color: colors.textSoft },
  chevron: { color: colors.textSoft, fontSize: 18 },
  departmentDropdown: {
    maxHeight: 240,
    marginTop: 6,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
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
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    color: colors.text,
  },
  descriptionInput: { minHeight: 130, paddingTop: 14 },
  errorText: { color: colors.danger, fontSize: 13, marginTop: 12 },
  primaryButton: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    borderRadius: 10,
    paddingHorizontal: 18,
    marginTop: 12,
  },
  disabledButton: { opacity: 0.7 },
  primaryButtonText: { color: colors.white, fontSize: 14, fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: 14, marginTop: 4 },
  cancelText: { color: colors.textSoft, fontWeight: '700' },
  successState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
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