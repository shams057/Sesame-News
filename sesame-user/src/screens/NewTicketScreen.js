import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import api, { errorMessage } from '../api/client';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { Button, Chip, ErrorState, KeyboardAvoidingScreen, Loading, TextField } from '../components/ui';

export default function NewTicketScreen({ navigation }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  const queryClient = useQueryClient();
  const departments = useQuery({ queryKey: ['departments'], queryFn: () => api.get('/departments').then((r) => r.data), staleTime: 10 * 60 * 1000 });
  const [form, setForm] = useState({ departmentId: null, title: '', description: '', priority: 'normal' });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const set = (changes) => setForm((current) => ({ ...current, ...changes }));

  const submit = async () => {
    const nextErrors = {};
    if (!form.departmentId) nextErrors.departmentId = 'Choisissez le service concerné.';
    if (form.title.trim().length < 3) nextErrors.title = 'Le sujet doit contenir au moins 3 caractères.';
    if (form.description.trim().length < 10) nextErrors.description = 'Décrivez votre demande (10 caractères minimum).';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    setSubmitting(true);
    try {
      const { data } = await api.post('/tickets', { ...form, title: form.title.trim(), description: form.description.trim() });
      queryClient.invalidateQueries({ queryKey: ['tickets'] });
      navigation.replace('TicketDetail', { id: data.id, created: true });
    } catch (error) {
      setErrors({ form: errorMessage(error, 'Impossible d’envoyer la demande. Réessayez.') });
    } finally {
      setSubmitting(false);
    }
  };

  if (departments.isPending) return <Loading />;
  if (departments.isError) return <ErrorState message={errorMessage(departments.error)} onRetry={departments.refetch} />;

  return (
    <KeyboardAvoidingScreen>
      <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label} accessibilityRole="header">Service concerné</Text>
          <View accessibilityRole="radiogroup" style={styles.departments}>
            {departments.data.map((department) => {
              const selected = form.departmentId === department.id;
              return (
                <Pressable
                  key={department.id}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  onPress={() => set({ departmentId: department.id })}
                  style={[styles.department, selected && styles.departmentSelected]}
                >
                  <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} color={selected ? colors.primary : colors.textMuted} />
                  <Text style={[styles.departmentText, selected && { color: colors.primary, fontWeight: '700' }]}>{department.name}</Text>
                </Pressable>
              );
            })}
          </View>
          {errors.departmentId ? <Text style={styles.error}>{errors.departmentId}</Text> : null}
        </View>
        <TextField label="Sujet" value={form.title} onChangeText={(title) => set({ title })} maxLength={150} error={errors.title} hint={`${form.title.length}/150`} />
        <TextField label="Votre demande" value={form.description} onChangeText={(description) => set({ description })} multiline maxLength={4000}
          error={errors.description} hint="Précisez votre filière, les dates et ce que vous avez déjà essayé." />
        <View style={{ gap: spacing.sm }}>
          <Text style={styles.label}>Urgence</Text>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <Chip label="Normale" selected={form.priority === 'normal'} onPress={() => set({ priority: 'normal' })} />
            <Chip label="Urgente" selected={form.priority === 'high'} onPress={() => set({ priority: 'high' })} />
          </View>
        </View>
        {errors.form ? <Text style={styles.formError} accessibilityRole="alert">{errors.form}</Text> : null}
        <Button title="Envoyer la demande" icon="send" onPress={submit} loading={submitting} />
        <Text style={styles.note}>Vous pourrez ajouter une pièce jointe (capture d’écran, PDF) dans la conversation après l’envoi.</Text>
      </ScrollView>
    </KeyboardAvoidingScreen>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 680, alignSelf: 'center', paddingBottom: 48 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  departments: { backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  department: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 4, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  departmentSelected: { backgroundColor: colors.primarySoft },
  departmentText: { color: colors.text, fontSize: 15, flex: 1 },
  error: { color: colors.danger, fontSize: 13 },
  formError: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  note: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
