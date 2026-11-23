import AsyncStorage from '@react-native-async-storage/async-storage';

const PREFIX = 'sesame.cache.';

/**
 * Tiny persistence for the last successful responses (first feed page,
 * events, tickets) so the app shows something useful offline.
 */
export async function readCache(key) {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export async function writeCache(key, value) {
  try {
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify({ savedAt: new Date().toISOString(), value }));
  } catch {
    // storage full or unavailable: the cache is best-effort
  }
}

export async function clearCache() {
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    await AsyncStorage.multiRemove(keys);
  } catch {
    // ignore
  }
}

/**
 * Wraps a fetcher: on success the result is cached; on a network error the
 * cached value is returned (flagged `fromCache`) instead of failing.
 */
export function withOfflineCache(key, fetcher) {
  return async () => {
    try {
      const value = await fetcher();
      writeCache(key, value);
      return value;
    } catch (error) {
      if (error?.response) throw error;
      const cached = await readCache(key);
      if (!cached) throw error;
      return Array.isArray(cached.value)
        ? Object.assign([...cached.value], { fromCache: cached.savedAt })
        : { ...cached.value, fromCache: cached.savedAt };
    }
  };
}
