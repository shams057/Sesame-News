import { Alert, Linking, Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { File, Paths } from 'expo-file-system';
import { absoluteUrl, getAuthToken } from '../api/client';

const safeName = (name) => (name || 'fichier').replace(/[^\p{L}\p{N}._-]/gu, '_');

export function notify(title, message) {
  if (Platform.OS === 'web') globalThis.alert?.(message ? `${title}\n\n${message}` : title);
  else Alert.alert(title, message);
}

/** Opens a public document (PDF, Word) in the in-app browser. */
export async function openDocument(path) {
  const url = absoluteUrl(path);
  if (Platform.OS === 'web') { globalThis.open?.(url, '_blank', 'noopener'); return; }
  await WebBrowser.openBrowserAsync(url);
}

/**
 * Downloads a file (optionally authenticated, e.g. a private ticket
 * attachment) then opens the system share/save sheet.
 */
export async function downloadAndShare(path, name, { authenticated = false, mimeType } = {}) {
  const url = absoluteUrl(path);
  const headers = authenticated && getAuthToken() ? { Authorization: `Bearer ${getAuthToken()}` } : undefined;
  if (Platform.OS === 'web') {
    const response = await fetch(url, { headers });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const href = URL.createObjectURL(await response.blob());
    const link = document.createElement('a');
    link.href = href;
    link.download = name || 'fichier';
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return;
  }
  const destination = new File(Paths.cache, `${Date.now()}-${safeName(name)}`);
  const file = await File.downloadFileAsync(url, destination, { headers });
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: name });
  else await Linking.openURL(file.uri);
}

/** Shares a news item (text + link to the first media if any). */
export async function shareNews(news) {
  const link = news.media?.[0] ? absoluteUrl(news.media[0].url) : '';
  const message = [news.titre, news.description, link].filter(Boolean).join('\n\n');
  if (Platform.OS === 'web') {
    if (globalThis.navigator?.share) {
      try { await globalThis.navigator.share({ title: news.titre, text: message }); return; } catch (error) { if (error?.name === 'AbortError') return; }
    }
    await globalThis.navigator?.clipboard?.writeText(message);
    notify('Copié', 'Le texte de l’actualité a été copié.');
    return;
  }
  await Share.share({ title: news.titre, message });
}
