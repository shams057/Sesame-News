import { create } from 'axios';
import { Platform } from 'react-native';

/**
 * Backend URL from EXPO_PUBLIC_API_URL (.env.local or the EAS profile).
 * On a USB-connected Android phone keep localhost and run
 * `adb reverse tcp:3000 tcp:3000`.
 */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3000').replace(/\/$/, '');

let currentToken = null;
let onUnauthorized = () => {};

export function setAuthToken(token) {
  currentToken = token;
}

export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

export const getAuthToken = () => currentToken;

const api = create({ baseURL: `${API_URL}/api/v1`, timeout: 20000 });

// One place adds the token to every request.
api.interceptors.request.use((config) => {
  if (currentToken) config.headers.Authorization = `Bearer ${currentToken}`;
  return config;
});

// A 401 means the session expired or was revoked: back to the login screen.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && currentToken && !error.config?.url?.startsWith('/auth/')) onUnauthorized();
    return Promise.reject(error);
  },
);

export function errorMessage(error, fallback = 'Une erreur est survenue') {
  const data = error?.response?.data;
  if (data?.details?.length && data.details[0]?.message) return data.details.map((detail) => detail.message).join('\n');
  if (data?.error) return data.error;
  if (error?.code === 'ECONNABORTED' || error?.message === 'Network Error') return 'Connexion impossible. Vérifiez votre réseau.';
  return fallback;
}

export const isNetworkError = (error) => !error?.response;

/** Absolute URL for `/uploads/...` or `/api/v1/...` paths returned by the API. */
export const absoluteUrl = (path) => (!path ? null : /^https?:/.test(path) ? path : `${API_URL}${path}`);

/** Multipart upload of a picked file (works on native and web). */
export async function appendFile(form, field, file) {
  if (Platform.OS === 'web') {
    const blob = file.file || await (await fetch(file.uri)).blob();
    form.append(field, blob, file.name);
  } else {
    form.append(field, { uri: file.uri, name: file.name, type: file.mimeType || 'application/octet-stream' });
  }
}

export default api;
