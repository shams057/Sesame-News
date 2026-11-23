import { buildIcs } from '../utils/calendar';
import { formatEvent, timeAgo } from '../utils/format';
import { INLINE_PATTERN as URL_PATTERN, parseBlocks } from '../components/RichText';
import { withOfflineCache, readCache } from '../utils/offlineCache';

describe('calendar export', () => {
  test('builds a valid iCalendar event with escaped text and a reminder', () => {
    const ics = buildIcs({ id: 7, titre: 'Atelier, IA; L3', description: 'Ligne 1\nLigne 2', location: 'Labo 2', eventStart: '2026-12-03T13:20:00.000Z', eventEnd: null });
    expect(ics).toContain('BEGIN:VEVENT');
    expect(ics).toContain('UID:news-7@sesame');
    expect(ics).toContain('DTSTART:20261203T132000Z');
    expect(ics).toContain('DTEND:20261203T142000Z');
    expect(ics).toContain('SUMMARY:Atelier\\, IA\\; L3');
    expect(ics).toContain('DESCRIPTION:Ligne 1\\nLigne 2');
    expect(ics).toContain('TRIGGER:-PT1H');
  });
});

describe('formatting', () => {
  test('event dates start with a capital but keep French month names lowercase', () => {
    const text = formatEvent('2026-12-03T14:00:00', '2026-12-03T17:00:00');
    expect(text.charAt(0)).toBe(text.charAt(0).toUpperCase());
    expect(text).toMatch(/décembre/);
    expect(text).toMatch(/14:00 – 17:00/);
  });

  test('relative times', () => {
    expect(timeAgo(new Date().toISOString())).toBe('à l’instant');
    expect(timeAgo(new Date(Date.now() - 3 * 3600000).toISOString())).toBe('il y a 3 h');
  });
});

describe('rich text in news', () => {
  test('URLs are detected without trailing punctuation', () => {
    const parts = 'Voir https://universitesesame.com/planning. Merci'.split(URL_PATTERN);
    expect(parts[1]).toBe('https://universitesesame.com/planning');
  });

  test('paragraphs and bullet lists are recognised', () => {
    expect(parseBlocks('Intro **gras**\n\n- un\n- deux')).toEqual([
      { type: 'paragraph', text: 'Intro **gras**' },
      { type: 'list', items: ['un', 'deux'] },
    ]);
  });
});

describe('offline cache', () => {
  test('returns the last good response when the network fails', async () => {
    await withOfflineCache('test', async () => ({ content: [1, 2] }))();
    const offline = await withOfflineCache('test', async () => { throw new Error('Network Error'); })();
    expect(offline.content).toEqual([1, 2]);
    expect(offline.fromCache).toBeTruthy();
    expect((await readCache('test')).value.content).toEqual([1, 2]);
  });

  test('HTTP errors are not masked by the cache', async () => {
    const httpError = Object.assign(new Error('403'), { response: { status: 403 } });
    await expect(withOfflineCache('test', async () => { throw httpError; })()).rejects.toBe(httpError);
  });
});
