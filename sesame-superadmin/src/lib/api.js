import axios from 'axios';

export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '');
const TOKEN_KEY = 'sesame.admin.token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (token) => {
    try { localStorage.setItem(TOKEN_KEY, token); } catch { /* storage unavailable */ }
  },
  clear: () => {
    try { localStorage.removeItem(TOKEN_KEY); } catch { /* storage unavailable */ }
  },
};

const api = axios.create({ baseURL: `${API_URL}/api/v1`, timeout: 30000 });

api.interceptors.request.use((config) => {
  const token = tokenStore.get();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Any 401 means the session is gone (expired, revoked, account disabled):
// the auth provider listens for this event and returns to the login page.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      window.dispatchEvent(new Event('sesame:unauthorized'));
    }
    return Promise.reject(error);
  },
);

/** Human-readable message from an API error. */
export function errorMessage(error, fallback = 'Une erreur est survenue') {
  const data = error?.response?.data;
  if (data?.details?.length && data.details[0]?.message) {
    return `${data.error} : ${data.details.map((detail) => detail.message).join(', ')}`;
  }
  if (data?.error) return data.error;
  if (error?.code === 'ECONNABORTED' || error?.message === 'Network Error') return 'Serveur injoignable. Vérifiez votre connexion.';
  return fallback;
}

/** Absolute URL for a media path returned by the API (`/uploads/...`). */
export const mediaUrl = (path) => (path ? (/^https?:/.test(path) ? path : `${API_URL}${path}`) : null);

/** Downloads an authenticated file (CSV export, private attachment). */
export async function downloadFile(url, fallbackName) {
  const response = await api.get(url.replace(/^\/api\/v1/, ''), { responseType: 'blob' });
  const disposition = response.headers['content-disposition'] || '';
  const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
  const name = match ? decodeURIComponent(match[1]) : fallbackName;
  const href = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

/** Builds FormData from a plain object (arrays → JSON, dates → ISO, files appended). */
export function toFormData(values, files = [], fileField = 'files') {
  const form = new FormData();
  Object.entries(values).forEach(([key, value]) => {
    if (value === undefined) return;
    if (value === null) form.append(key, '');
    else if (Array.isArray(value)) form.append(key, JSON.stringify(value));
    else if (value instanceof Date) form.append(key, value.toISOString());
    else form.append(key, String(value));
  });
  files.forEach((file) => form.append(fileField, file));
  return form;
}

export default api;
