'use strict';

const { Op } = require('sequelize');
const env = require('../config/env');
const { PushToken } = require('../models');
const logger = require('../utils/logger');

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';
const CHUNK = 100;

/**
 * Sends an Expo push notification to the given students. Failures are
 * logged, never thrown: a notification must not break the request that
 * triggered it. Tokens Expo reports as unregistered are deleted.
 */
async function sendToUsers(userIds, { title, body, data }) {
  if (env.isTest || !userIds?.length) return;
  try {
    const tokens = await PushToken.findAll({ where: { userId: { [Op.in]: userIds } }, attributes: ['token'], raw: true });
    await sendToTokens(tokens.map((row) => row.token), { title, body, data });
  } catch (error) {
    logger.warn({ err: error }, 'Push notification failed');
  }
}

async function sendToTokens(tokens, { title, body, data }) {
  for (let i = 0; i < tokens.length; i += CHUNK) {
    const batch = tokens.slice(i, i + CHUNK);
    const response = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
      },
      body: JSON.stringify(batch.map((to) => ({ to, title, body: body?.slice(0, 180), data, sound: 'default' }))),
    });
    if (!response.ok) {
      logger.warn({ status: response.status }, 'Expo push API error');
      continue;
    }
    const { data: tickets = [] } = await response.json();
    const invalid = tickets
      .map((ticket, index) => (ticket.details?.error === 'DeviceNotRegistered' ? batch[index] : null))
      .filter(Boolean);
    if (invalid.length) await PushToken.destroy({ where: { token: { [Op.in]: invalid } } });
  }
}

module.exports = { sendToUsers };
