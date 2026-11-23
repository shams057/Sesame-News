import React, { useState } from 'react';
import { Platform, Pressable, ScrollView, Text, View } from 'react-native';
import Constants from 'expo-constants';
import { Ionicons } from '@expo/vector-icons';
import api, { API_URL, errorMessage } from '../api/client';
import { useAuth } from '../auth/AuthContext';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { confirm } from '../utils/confirm';
import { notify } from '../utils/files';
import { Badge, Button, Card, TextField } from '../components/ui';

function Row({ icon, label, onPress }) {
  const colors = useColors();
  const styles = useStyles(makeStyles);
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.cardMuted }]}>
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.rowLabel}>{label}</Text>
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

export default function ProfileScreen({ navigation }) {
  const { account, logout, setAccount } = useAuth();
  const styles = useStyles(makeStyles);
  const [email, setEmail] = useState(account?.email || '');
  const [saving, setSaving] = useState(false);

  const saveEmail = async () => {
    setSaving(true);
    try {
      const { data } = await api.patch('/me', { email: email.trim() });
      setAccount(data);
      notify('Enregistré', 'Votre e-mail a été mis à jour.');
    } catch (error) {
      notify('Erreur', errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const onLogout = async () => {
    if (await confirm('Se déconnecter ?', 'Vous ne recevrez plus de notifications sur cet appareil.', 'Se déconnecter', true)) {
      await logout();
    }
  };

  if (!account || account.offline) {
    return <View style={styles.screen}><Card style={{ margin: spacing.lg }}><Text style={styles.muted}>Profil indisponible hors connexion.</Text></Card></View>;
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Card style={{ gap: spacing.sm }}>
        <Text style={styles.name} accessibilityRole="header">{account.firstname} {account.lastname}</Text>
        <Text style={styles.muted}>Identifiant : {account.login}</Text>
        {account.categorie ? <Badge label={account.categorie.libelle} tone="info" icon="school-outline" /> : null}
      </Card>

      <Card style={{ gap: spacing.md }}>
        <TextField label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email"
          hint="Facultatif. Utilisé par l’administration pour vous contacter." />
        <Button title="Enregistrer l’e-mail" variant="secondary" onPress={saveEmail} loading={saving} disabled={email.trim() === (account.email || '')} compact />
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        <Row icon="key-outline" label="Changer mon mot de passe" onPress={() => navigation.navigate('ChangePassword')} />
        <Row icon="sparkles-outline" label="Assistant SESAME" onPress={() => navigation.navigate('Assistant')} />
      </Card>

      <Button title="Se déconnecter" variant="danger" icon="log-out-outline" onPress={onLogout} />
      <Text style={styles.version}>SESAME · version {Constants.expoConfig?.version} · {Platform.OS}{__DEV__ ? ` · ${API_URL}` : ''}</Text>
    </ScrollView>
  );
}

const makeStyles = (colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.lg, width: '100%', maxWidth: 680, alignSelf: 'center' },
  name: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { color: colors.textMuted },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: MIN_TOUCH + 8, paddingHorizontal: spacing.lg, borderBottomWidth: 1, borderColor: colors.border },
  rowLabel: { flex: 1, color: colors.text, fontSize: 15, fontWeight: '600' },
  version: { textAlign: 'center', color: colors.textMuted, fontSize: 12, borderRadius: radius.md },
});
