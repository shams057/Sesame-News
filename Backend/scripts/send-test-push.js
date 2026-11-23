#!/usr/bin/env node
'use strict';

/**
 * Sends a test push notification to every device registered by a student.
 *
 *   npm run test-push -- <login>
 *
 * Prints Expo's response for each device so delivery problems are visible
 * (e.g. missing FCM credentials on Android).
 */
const env = require('../src/config/env');
const { sequelize, User, PushToken } = require('../src/models');

async function main() {
  const login = process.argv[2];
  if (!login) {
    console.error('Usage: npm run test-push -- <login étudiant>');
    process.exit(1);
  }
  const user = await User.findOne({ where: { login } });
  if (!user) throw new Error(`Étudiant « ${login} » introuvable`);
  const tokens = await PushToken.findAll({ where: { userId: user.id } });
  if (!tokens.length) throw new Error(`Aucun appareil enregistré pour « ${login} » (ouvrez l’app sur le téléphone et acceptez les notifications)`);

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(env.EXPO_ACCESS_TOKEN ? { Authorization: `Bearer ${env.EXPO_ACCESS_TOKEN}` } : {}),
    },
    body: JSON.stringify(tokens.map((row) => ({
      to: row.token,
      title: 'Test SESAME',
      body: `Notification de test envoyée à ${new Date().toLocaleTimeString('fr-FR')}`,
      data: { type: 'test' },
      sound: 'default',
    }))),
  });
  const result = await response.json();
  tokens.forEach((row, index) => {
    console.log(`${row.platform || '?'} ${row.token}`);
    console.log('  →', JSON.stringify(result.data?.[index] || result));
  });

  // Expo resolves delivery asynchronously: fetch receipts a few seconds later.
  const ids = (result.data || []).map((ticket) => ticket.id).filter(Boolean);
  if (ids.length) {
    await new Promise((resolve) => setTimeout(resolve, 5000));
    const receipts = await (await fetch('https://exp.host/--/api/v2/push/getReceipts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ ids }),
    })).json();
    console.log('Receipts:', JSON.stringify(receipts.data || receipts));
  }
  await sequelize.close();
}

main().catch(async (error) => {
  console.error(error.message);
  await sequelize.close().catch(() => {});
  process.exit(1);
});
