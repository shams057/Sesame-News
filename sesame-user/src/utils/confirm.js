import { Alert, Platform } from 'react-native';

/** Cross-platform confirmation dialog → Promise<boolean>. */
export function confirm(title, message, confirmLabel = 'Confirmer', destructive = false) {
  if (Platform.OS === 'web') return Promise.resolve(Boolean(globalThis.confirm?.(`${title}\n\n${message}`)));
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      { text: 'Annuler', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: destructive ? 'destructive' : 'default', onPress: () => resolve(true) },
    ], { cancelable: true, onDismiss: () => resolve(false) });
  });
}
