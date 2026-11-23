#!/usr/bin/env node
'use strict';

/**
 * Creates (or resets) a super admin from the command line. This replaces the
 * old public POST /registersuperAdmin endpoint.
 *
 *   npm run create-admin -- <login> [--agent]
 *
 * The password is typed interactively (never passed as an argument, so it
 * doesn't land in the shell history).
 */
const readline = require('readline');
const { sequelize, SuperAdmin } = require('../src/models');
const { hashPassword } = require('../src/services/authService');

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = true;
    rl._writeToOutput = (text) => { if (!rl.stdoutMuted || text.includes(question)) rl.output.write(text); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

async function main() {
  const login = process.argv[2];
  const role = process.argv.includes('--agent') ? 'agent' : 'owner';
  if (!login || !/^[\w.@-]{3,60}$/.test(login)) {
    console.error('Usage: npm run create-admin -- <login> [--agent]');
    process.exit(1);
  }
  const password = await askHidden(`Mot de passe pour ${login} (8 caractères min.) : `);
  if (password.length < 8) {
    console.error('Mot de passe trop court.');
    process.exit(1);
  }
  const confirm = await askHidden('Confirmez le mot de passe : ');
  if (confirm !== password) {
    console.error('Les mots de passe ne correspondent pas.');
    process.exit(1);
  }
  const hashed = await hashPassword(password);
  const existing = await SuperAdmin.findOne({ where: { login } });
  if (existing) {
    await existing.update({ password: hashed, isActive: true });
    console.log(`Mot de passe de « ${login} » réinitialisé.`);
  } else {
    await SuperAdmin.create({ login, password: hashed, displayName: login, role });
    console.log(`Administrateur « ${login} » (${role}) créé.`);
  }
  await sequelize.close();
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
