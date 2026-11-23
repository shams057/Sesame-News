import { useMemo } from 'react';
import { StyleSheet } from 'react-native';

// SESAME brand: navy #023e9a, teal #3cc1bb.
const light = {
  scheme: 'light',
  primary: '#023e9a',
  primaryDark: '#01205a',
  primarySoft: '#e6edf8',
  accent: '#3cc1bb',
  accentSoft: '#e9f8f7',
  bg: '#f5f7fa',
  card: '#ffffff',
  cardMuted: '#f8fafc',
  text: '#0f172a',
  textSoft: '#475569',
  textMuted: '#64748b',
  border: '#e2e8f0',
  success: '#0f8a5f',
  successSoft: '#e8f7f0',
  warning: '#a15c00',
  warningSoft: '#fff4e0',
  danger: '#c62828',
  dangerSoft: '#fdecec',
  onPrimary: '#ffffff',
  bubbleMine: '#023e9a',
  bubbleOther: '#ffffff',
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };
export const MIN_TOUCH = 44;

/** The app is light-only, whatever the phone's system setting. */
export function useColors() {
  return light;
}

/** `const styles = useStyles(makeStyles)` where makeStyles = (colors) => ({...}). */
export function useStyles(factory) {
  const colors = useColors();
  return useMemo(() => StyleSheet.create(factory(colors)), [colors, factory]);
}

export { light };
