import React, { useRef, useState } from 'react';
import { Image, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/AuthContext';
import { errorMessage } from '../api/client';
import { radius, spacing, useStyles } from '../theme';
import { Button, KeyboardAvoidingScreen, TextField } from '../components/ui';

const LOGO = require('../../assets/sesame-logo.png');

export default function LoginScreen() {
  const { login } = useAuth();
  const styles = useStyles(makeStyles);
  const passwordRef = useRef(null);
  const [form, setForm] = useState({ login: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!form.login.trim() || !form.password) { setError('Saisissez votre identifiant et votre mot de passe.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(form.login.trim(), form.password);
    } catch (requestError) {
      setError(errorMessage(requestError, 'Connexion impossible'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingScreen>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Image source={LOGO} style={styles.logo} accessibilityLabel="SESAME — School of High-Tech, AI & Management" resizeMode="contain" />
            <Text style={styles.title} accessibilityRole="header">Espace étudiant</Text>
            <Text style={styles.subtitle}>Actualités, agenda et demandes auprès des services de l’université.</Text>
            <TextField
              label="Identifiant"
              value={form.login}
              onChangeText={(value) => setForm({ ...form, login: value })}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="username"
              textContentType="username"
              returnKeyType="next"
              onSubmitEditing={() => passwordRef.current?.focus()}
            />
            <TextField
              ref={passwordRef}
              label="Mot de passe"
              value={form.password}
              onChangeText={(value) => setForm({ ...form, password: value })}
              secureTextEntry
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              onSubmitEditing={submit}
            />
            {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : null}
            <Button title="Se connecter" onPress={submit} loading={loading} />
            <Text style={styles.help}>Identifiants oubliés ? Contactez le service Scolarité pour obtenir un mot de passe temporaire.</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingScreen>
    </SafeAreaView>
  );
}

const makeStyles = (colors) => ({
  safe: { flex: 1, backgroundColor: colors.primaryDark },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { width: '100%', maxWidth: 420, alignSelf: 'center', backgroundColor: colors.card, borderRadius: radius.lg, padding: spacing.xl, gap: spacing.lg },
  logo: { width: '100%', height: 84 },
  title: { fontSize: 22, fontWeight: '800', color: colors.text, textAlign: 'center' },
  subtitle: { color: colors.textMuted, textAlign: 'center', marginTop: -spacing.sm },
  error: { color: colors.danger, backgroundColor: colors.dangerSoft, padding: spacing.md, borderRadius: radius.md },
  help: { color: colors.textMuted, fontSize: 12, textAlign: 'center' },
});
