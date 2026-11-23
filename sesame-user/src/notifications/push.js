import { Platform } from 'react-native';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import api from '../api/client';

let registeredToken = null;

// Show notifications even when the app is open (banner + notification list).
if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: false,
    }),
  });
}

/**
 * Asks permission and registers this device's Expo push token with the API.
 * Silently does nothing on the web, on simulators, or when the EAS project id
 * is not configured (push then simply stays off).
 */
export async function registerForPushNotifications() {
  if (Platform.OS === 'web' || !Device.isDevice) return null;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Notifications SESAME',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
  let { status } = await Notifications.getPermissionsAsync();
  if (status !== 'granted') ({ status } = await Notifications.requestPermissionsAsync());
  if (status !== 'granted') return null;

  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  await api.post('/me/push-tokens', { token, platform: Platform.OS });
  registeredToken = token;
  return token;
}

export async function unregisterPushToken() {
  if (!registeredToken) return;
  await api.delete('/me/push-tokens', { data: { token: registeredToken } });
  registeredToken = null;
}

/** Maps a notification payload to a navigation target. */
export function targetFromNotification(response) {
  const data = response?.notification?.request?.content?.data || {};
  if (data.type === 'ticket' && data.ticketId) return { tab: 'TicketsTab', screen: 'TicketDetail', params: { id: Number(data.ticketId) } };
  if (data.type === 'news' && data.newsId) return { tab: 'FeedTab', screen: 'NewsDetail', params: { id: Number(data.newsId) } };
  return null;
}
