import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'sesame.session';

/**
 * Session token storage: the OS keychain/keystore on phones (expo-secure-store),
 * localStorage on the web build (SecureStore is not available there).
 */
export const tokenStorage = {
  async get() {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
      return await SecureStore.getItemAsync(KEY);
    } catch {
      return null;
    }
  },
  async set(token) {
    if (Platform.OS === 'web') globalThis.localStorage?.setItem(KEY, token);
    else await SecureStore.setItemAsync(KEY, token);
  },
  async clear() {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(KEY);
      else await SecureStore.deleteItemAsync(KEY);
    } catch {
      // already gone
    }
  },
};
