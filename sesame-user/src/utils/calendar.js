import { Platform, Share } from 'react-native';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

const stamp = (date) => new Date(date).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
const escapeText = (value = '') => value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** iCalendar (.ics) content for one event — understood by every calendar app. */
export function buildIcs(news) {
  const start = new Date(news.eventStart);
  const end = news.eventEnd ? new Date(news.eventEnd) : new Date(start.getTime() + 60 * 60 * 1000);
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//SESAME//Espace etudiant//FR',
    'BEGIN:VEVENT',
    `UID:news-${news.id}@sesame`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(start)}`,
    `DTEND:${stamp(end)}`,
    `SUMMARY:${escapeText(news.titre)}`,
    news.location ? `LOCATION:${escapeText(news.location)}` : null,
    `DESCRIPTION:${escapeText(news.description.slice(0, 1000))}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapeText(news.titre)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean).join('\r\n');
}

/** Hands the event to the user's calendar app (with a reminder 1 h before). */
export async function addToCalendar(news) {
  const content = buildIcs(news);
  const filename = `evenement-${news.id}.ics`;
  if (Platform.OS === 'web') {
    const href = URL.createObjectURL(new Blob([content], { type: 'text/calendar' }));
    const link = document.createElement('a');
    link.href = href;
    link.download = filename;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
    return;
  }
  const file = new File(Paths.cache, filename);
  file.write(content);
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event' });
  else await Share.share({ message: content });
}
