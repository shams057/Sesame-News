const valid = (value) => value && !Number.isNaN(new Date(value).getTime());

export function timeAgo(value) {
  if (!valid(value)) return '';
  const minutes = Math.floor(Math.max(0, Date.now() - new Date(value).getTime()) / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `il y a ${days} j`;
  return formatDate(value);
}

export const formatDate = (value) => (valid(value)
  ? new Date(value).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
  : '');

export const formatTime = (value) => (valid(value)
  ? new Date(value).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
  : '');

export function formatDateTime(value) {
  if (!valid(value)) return '';
  return `${formatDate(value)} à ${formatTime(value)}`;
}

const capitalize = (text) => (text ? text.charAt(0).toUpperCase() + text.slice(1) : text);

/** "Mardi 2 décembre · 14:00 – 17:00" (time omitted at midnight). */
export function formatEvent(start, end) {
  return capitalize(formatEventRaw(start, end));
}

function formatEventRaw(start, end) {
  if (!valid(start)) return '';
  const s = new Date(start);
  const day = s.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
  const hasTime = s.getHours() !== 0 || s.getMinutes() !== 0;
  if (!valid(end)) return hasTime ? `${day} · ${formatTime(s)}` : day;
  const e = new Date(end);
  if (e.toDateString() === s.toDateString()) return `${day} · ${formatTime(s)} – ${formatTime(e)}`;
  return `${day} → ${e.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}`;
}

export const STATUS = {
  open: { label: 'Ouvert', tone: 'warning' },
  in_progress: { label: 'En cours', tone: 'info' },
  closed: { label: 'Fermé', tone: 'success' },
};

export function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
}
