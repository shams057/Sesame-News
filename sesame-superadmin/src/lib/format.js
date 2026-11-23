export const STATUS = {
  open: { label: 'Ouvert', tone: 'warning' },
  in_progress: { label: 'En cours', tone: 'info' },
  closed: { label: 'Fermé', tone: 'success' },
};

export const PRIORITY = {
  urgent: { label: 'Urgente', tone: 'danger' },
  high: { label: 'Haute', tone: 'warning' },
  normal: { label: 'Normale', tone: 'neutral' },
  low: { label: 'Basse', tone: 'neutral' },
};

const dateFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });
const dateTimeFmt = new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' });

const valid = (value) => value && !Number.isNaN(new Date(value).getTime());
export const formatDate = (value) => (valid(value) ? dateFmt.format(new Date(value)) : '—');
export const formatDateTime = (value) => (valid(value) ? dateTimeFmt.format(new Date(value)) : '—');
export const formatTime = (value) => (valid(value) ? timeFmt.format(new Date(value)) : '');

export function formatRelative(value) {
  if (!valid(value)) return '—';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return 'à l’instant';
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days < 30) return `il y a ${days} j`;
  return formatDate(value);
}

/** Hours → "45 min", "6,5 h", "2,1 j". */
export function formatDuration(hours) {
  if (hours === null || hours === undefined) return '—';
  if (hours < 1) return `${Math.round(hours * 60)} min`;
  if (hours < 48) return `${hours.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} h`;
  return `${(hours / 24).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} j`;
}

/** ISO string → value for <input type="datetime-local"> in local time. */
export function toLocalInput(value) {
  if (!valid(value)) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** <input type="datetime-local"> value (local time) → ISO string with offset, or null. */
export const fromLocalInput = (value) => (value ? new Date(value).toISOString() : null);

export const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '';
  if (bytes < 1024) return `${bytes} o`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} Ko`;
  return `${(bytes / 1024 / 1024).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} Mo`;
};

/** Age of an unanswered ticket → tone for the SLA indicator. */
export function slaTone(ticket) {
  if (ticket.status === 'closed' || ticket.firstResponseAt) return null;
  const hours = (Date.now() - new Date(ticket.createdAt).getTime()) / 3600000;
  if (hours >= 48) return { tone: 'danger', label: `Sans réponse depuis ${formatDuration(hours)}` };
  if (hours >= 24) return { tone: 'warning', label: `Sans réponse depuis ${formatDuration(hours)}` };
  return null;
}
