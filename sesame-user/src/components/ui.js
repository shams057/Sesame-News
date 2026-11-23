import React from 'react';
import { ActivityIndicator, Pressable, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { MIN_TOUCH, radius, spacing, useColors, useStyles } from '../theme';
import { formatDateTime } from '../utils/format';

export function Icon({ name, size = 20, color, style }) {
  const colors = useColors();
  return <Ionicons name={name} size={size} color={color || colors.text} style={style} />;
}

export function Button({ title, onPress, variant = 'primary', icon, loading, disabled, accessibilityLabel, style, compact }) {
  const colors = useColors();
  const styles = useStyles(buttonStyles);
  const palette = {
    primary: { bg: colors.primary, fg: colors.onPrimary, border: colors.primary },
    secondary: { bg: colors.card, fg: colors.text, border: colors.border },
    ghost: { bg: 'transparent', fg: colors.primary, border: 'transparent' },
    danger: { bg: colors.dangerSoft, fg: colors.danger, border: colors.dangerSoft },
  }[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: Boolean(inactive), busy: Boolean(loading) }}
      onPress={onPress}
      disabled={inactive}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: palette.bg, borderColor: palette.border, opacity: inactive ? 0.55 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={palette.fg} /> : icon ? <Ionicons name={icon} size={18} color={palette.fg} /> : null}
      {title ? <Text style={[styles.label, { color: palette.fg }]}>{title}</Text> : null}
    </Pressable>
  );
}

const buttonStyles = () => ({
  button: {
    minHeight: MIN_TOUCH, paddingHorizontal: spacing.lg, borderRadius: radius.md, borderWidth: 1,
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm,
  },
  compact: { minHeight: 36, paddingHorizontal: spacing.md },
  label: { fontSize: 15, fontWeight: '700' },
});

export function IconButton({ icon, onPress, accessibilityLabel, color, badge, size = 22 }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => ({ width: MIN_TOUCH, height: MIN_TOUCH, alignItems: 'center', justifyContent: 'center', borderRadius: radius.pill, opacity: pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={size} color={color || colors.text} />
      {badge ? <View style={{ position: 'absolute', top: 9, right: 9, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.danger }} /> : null}
    </Pressable>
  );
}

/** Labelled input: the label stays visible while typing (no placeholder-as-label). */
export function TextField({ label, error, hint, multiline, style, ...props }) {
  const colors = useColors();
  const styles = useStyles(fieldStyles);
  return (
    <View style={[styles.field, style]}>
      <Text style={styles.label} nativeID={`label-${label}`}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        aria-labelledby={`label-${label}`}
        placeholderTextColor={colors.textMuted}
        style={[styles.input, multiline && styles.multiline, error && { borderColor: colors.danger }]}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
      {error ? <Text style={styles.error} accessibilityRole="alert">{error}</Text> : hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
}

const fieldStyles = (colors) => ({
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '600', color: colors.textSoft },
  input: {
    minHeight: MIN_TOUCH + 4, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md,
    paddingHorizontal: spacing.md, paddingVertical: 10, fontSize: 16, color: colors.text, backgroundColor: colors.card,
  },
  multiline: { minHeight: 120 },
  hint: { fontSize: 12, color: colors.textMuted },
  error: { fontSize: 13, color: colors.danger },
});

const TONES = {
  neutral: (c) => [c.cardMuted, c.textSoft],
  info: (c) => [c.primarySoft, c.primary],
  success: (c) => [c.successSoft, c.success],
  warning: (c) => [c.warningSoft, c.warning],
  danger: (c) => [c.dangerSoft, c.danger],
  accent: (c) => [c.accentSoft, c.accent],
};

export function Badge({ label, tone = 'neutral', icon }) {
  const colors = useColors();
  const [bg, fg] = TONES[tone](colors);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 }}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label}</Text>
    </View>
  );
}

export function Card({ children, style }) {
  const colors = useColors();
  return <View style={[{ backgroundColor: colors.card, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, padding: spacing.lg }, style]}>{children}</View>;
}

export function EmptyState({ icon = 'documents-outline', title, message, action }) {
  const colors = useColors();
  return (
    <View style={{ alignItems: 'center', padding: spacing.xl, gap: spacing.sm }}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text, textAlign: 'center' }}>{title}</Text>
      {message ? <Text style={{ color: colors.textMuted, textAlign: 'center', lineHeight: 20 }}>{message}</Text> : null}
      {action ? <View style={{ marginTop: spacing.sm }}>{action}</View> : null}
    </View>
  );
}

export function ErrorState({ message, onRetry }) {
  return <EmptyState icon="cloud-offline-outline" title="Chargement impossible" message={message} action={onRetry ? <Button title="Réessayer" variant="secondary" icon="refresh" onPress={onRetry} /> : null} />;
}

/** Shown above lists served from the offline cache. */
export function OfflineBanner({ savedAt }) {
  const colors = useColors();
  if (!savedAt) return null;
  return (
    <View accessibilityRole="alert" style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.warningSoft, padding: spacing.md, borderRadius: radius.md, marginBottom: spacing.md }}>
      <Ionicons name="cloud-offline-outline" size={18} color={colors.warning} />
      <Text style={{ color: colors.warning, flex: 1, fontSize: 13 }}>Hors connexion — données du {formatDateTime(savedAt)}</Text>
    </View>
  );
}

export function Loading() {
  const colors = useColors();
  return <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl }}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function Chip({ label, selected, onPress }) {
  const colors = useColors();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={{
        minHeight: 36, justifyContent: 'center', paddingHorizontal: 14, borderRadius: radius.pill, borderWidth: 1,
        borderColor: selected ? colors.primary : colors.border, backgroundColor: selected ? colors.primary : colors.card,
      }}
    >
      <Text style={{ fontWeight: '600', color: selected ? colors.onPrimary : colors.textSoft }}>{label}</Text>
    </Pressable>
  );
}
