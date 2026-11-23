'use strict';

const crypto = require('crypto');
const env = require('../config/env');

/** Builds limit/offset and the response envelope for paginated lists. */
function paginate({ page = 0, pageSize = 20 }) {
  return { limit: pageSize, offset: page * pageSize };
}

function pageResult({ rows, count }, { page = 0, pageSize = 20 }) {
  return {
    content: rows,
    page,
    pageSize,
    totalElements: count,
    totalPages: Math.max(1, Math.ceil(count / pageSize)),
  };
}

/** Escapes LIKE wildcards in user search input. */
function likeTerm(value) {
  return `%${String(value).replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

/** Readable temporary password (no ambiguous characters). */
function generateTempPassword(length = 12) {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789';
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes, (byte) => alphabet[byte % alphabet.length]).join('');
}

/** YYYY-MM-DD of a date in the application time zone. */
function localDayKey(date, timeZone = env.APP_TIMEZONE) {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Offset in minutes of `timeZone` at instant `date` (e.g. +60 for UTC+1). */
function tzOffsetMinutes(date, timeZone = env.APP_TIMEZONE) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return Math.round((asUtc - date.getTime()) / 60000);
}

/** The UTC instant of local midnight (application time zone) for a Y/M/D. */
function zonedMidnight(year, monthIndex, day, timeZone = env.APP_TIMEZONE) {
  const guess = new Date(Date.UTC(year, monthIndex, day));
  return new Date(guess.getTime() - tzOffsetMinutes(guess, timeZone) * 60000);
}

/** Local calendar parts of an instant in the application time zone. */
function zonedParts(date = new Date(), timeZone = env.APP_TIMEZONE) {
  const [year, month, day] = localDayKey(date, timeZone).split('-').map(Number);
  return { year, monthIndex: month - 1, day };
}

function startOfToday(timeZone = env.APP_TIMEZONE) {
  const { year, monthIndex, day } = zonedParts(new Date(), timeZone);
  return zonedMidnight(year, monthIndex, day, timeZone);
}

module.exports = {
  paginate,
  pageResult,
  likeTerm,
  generateTempPassword,
  localDayKey,
  zonedMidnight,
  zonedParts,
  startOfToday,
};
