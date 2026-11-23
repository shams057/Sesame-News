import { describe, expect, test } from 'vitest';
import { formatDuration, fromLocalInput, slaTone, toLocalInput } from '../lib/format';
import { cleanParams } from '../lib/useUrlState';

describe('format helpers', () => {
  test('durations are human readable', () => {
    expect(formatDuration(null)).toBe('—');
    expect(formatDuration(0.5)).toBe('30 min');
    expect(formatDuration(6.5)).toBe('6,5 h');
    expect(formatDuration(72)).toBe('3 j');
  });

  test('datetime-local values round-trip through ISO strings with an offset', () => {
    const iso = fromLocalInput('2026-12-01T14:30');
    expect(iso).toMatch(/Z$/);
    expect(toLocalInput(iso)).toBe('2026-12-01T14:30');
    expect(fromLocalInput('')).toBeNull();
  });

  test('SLA flags unanswered tickets older than 24 h', () => {
    const old = { status: 'open', firstResponseAt: null, createdAt: new Date(Date.now() - 30 * 3600000).toISOString() };
    expect(slaTone(old).tone).toBe('warning');
    expect(slaTone({ ...old, firstResponseAt: new Date().toISOString() })).toBeNull();
    expect(slaTone({ ...old, createdAt: new Date(Date.now() - 50 * 3600000).toISOString() }).tone).toBe('danger');
  });

  test('empty query params are dropped', () => {
    expect(cleanParams({ a: '', b: 0, c: null, d: 'x' })).toEqual({ b: 0, d: 'x' });
  });
});
