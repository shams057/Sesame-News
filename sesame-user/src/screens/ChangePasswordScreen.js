import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text } from 'react-native';
import api, { errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { radius, spacing, useStyles } from '../theme';
import { Button, Card, TextField } from '../components/ui';
import { notify } from '../utils/files';

/**
 * Used after a temporary password (forced, no way around it) and from the
 * profile. Requires the current password; other sessions are signed out.
 */
export default function ChangePasswordScreen({ navigation, route }) {
  const forced = Boolean(route.params?.forced);
  const { refreshAccount, logout } = useAuth();
  const styles = useStyles(makeStyles);
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (form.newPassword.length < 8) { setError('Le nouveau mot de passe doit contenir au moins 8 caractères.'); return; }
    if (form.newPassword !== form.confirm) { setError('Les deux mots de passe ne correspondent pas.'); return; }
    setLoading(true);
    try {
      await api.put('/me/password', { currentPassword: form.currentPassword, newPassword: form.newPassword });
      await refreshAccount();
      if (!forced) {
        notify('Mot de passe modifié', 'Vos autres appareils ont été déconnectés.');
        navigation.goBack();
      }
    } catch (requestError) {
      setError(errorMessage(requestError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Card style={styles.card}>
          {forced ? (
            <Text style={styles.intro}>Bienvenue ! Votre compte utilise un mot de passe temporaire. Choisissez un mot de passe personnel pour continuer.</Text>
          ) : null}
          <TextField label={forced ? 'Mot de passe temporaire' : 'Mot de passe actuel'} secureTextEntry autoComplete="current-password"
            value={form.currentPassword} onChangeText={(value) => setForm({ ...form, currentPassword: value })} />
          <TextField label="Nouveau mot de passe" secureTextEntry autoComplete="new-password" hint="8 caractères minimum."
            value={form.newPassword} onChangeText={(value) => setForm({ ...form, newPassword: value })} />
          <TextField label="Confirmer le nouveau mot de passe" secureTextEntry autoComplete="new-password"
            value={form.confirm} onChangeText={(value) => setForm({ ...form, confirm: value })} onSubmitEditing={submit} />
          {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
          <Button title="Enregistrer" onPress={submit} loading={loading} />
          {forced ? <Button title="Se déconnecter" variant="ghost" onPress={logout} /> : null}
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const makeStyles = (colors) => ({
  scroll: { padding: spacing.lg, flexGrow: 1 },
  card: { gap: spacing.lg, width: '100%', maxWidth: 520, alignSelf: 'center' },
  intro: { color: colors.textSoft, lineHeight: 21 },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
});
