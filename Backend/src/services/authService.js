'use strict';

const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const env = require('../config/env');
const { Session, User, SuperAdmin } = require('../models');
const { unauthorized } = require('../utils/errors');

const BCRYPT_ROUNDS = env.isTest ? 4 : 12;
// A real hash compared against when the login does not exist, so response
// time does not reveal whether an account exists.
const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', BCRYPT_ROUNDS);

const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

const hashPassword = (password) => bcrypt.hash(password, BCRYPT_ROUNDS);

/**
 * Signed JWT (verified on every request) + a session row holding its hash,
 * so tokens expire on their own and can also be revoked (logout, password
 * change, account disabled).
 */
async function issueToken(subjectType, subjectId, userAgent) {
  const token = jwt.sign(
    { role: subjectType, jti: crypto.randomUUID() },
    env.JWT_SECRET,
    { subject: String(subjectId), expiresIn: env.JWT_EXPIRES_IN, algorithm: 'HS256' },
  );
  const { exp } = jwt.decode(token);
  const expiresAt = new Date(exp * 1000);
  await Session.create({
    tokenHash: sha256(token),
    subjectType,
    subjectId,
    expiresAt,
    userAgent: userAgent ? String(userAgent).slice(0, 255) : null,
  });
  return { token, expiresAt };
}

/** Returns `{ role, id, name, account, session }` or throws 401. */
async function authenticateToken(token) {
  if (!token) throw unauthorized();
  let payload;
  try {
    payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ['HS256'] });
  } catch {
    throw unauthorized('Session expirée ou invalide');
  }
  const session = await Session.findOne({ where: { tokenHash: sha256(token) } });
  if (!session || session.revokedAt || session.expiresAt < new Date()
    || session.subjectType !== payload.role || String(session.subjectId) !== payload.sub) {
    throw unauthorized('Session expirée ou invalide');
  }

  const Model = payload.role === 'user' ? User : SuperAdmin;
  const account = await Model.findByPk(session.subjectId);
  if (!account || !account.isActive) throw unauthorized('Compte désactivé');

  const name = payload.role === 'user'
    ? `${account.firstname} ${account.lastname}`.trim()
    : account.displayName || account.login;
  return { role: payload.role, id: account.id, name, account, session };
}

async function verifyCredentials(subjectType, login, password) {
  const Model = subjectType === 'user' ? User : SuperAdmin;
  const account = await Model.scope('withPassword').findOne({ where: { login } });
  const ok = await bcrypt.compare(password, account ? account.password : DUMMY_HASH);
  // One message for every failure: no account enumeration.
  if (!account || !ok || !account.isActive) throw unauthorized('Identifiant ou mot de passe incorrect');
  return account;
}

const comparePassword = (password, hash) => bcrypt.compare(password, hash);

function revokeSession(session) {
  return session.update({ revokedAt: new Date() });
}

/** Revokes every active session of an account (password change, disable…). */
function revokeAllSessions(subjectType, subjectId, exceptSessionId) {
  const where = { subjectType, subjectId, revokedAt: null };
  if (exceptSessionId) where.id = { [Op.ne]: exceptSessionId };
  return Session.update({ revokedAt: new Date() }, { where });
}

function purgeExpiredSessions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 3600 * 1000);
  return Session.destroy({
    where: { [Op.or]: [{ expiresAt: { [Op.lt]: new Date() } }, { revokedAt: { [Op.lt]: cutoff } }] },
  });
}

module.exports = {
  hashPassword,
  comparePassword,
  issueToken,
  authenticateToken,
  verifyCredentials,
  revokeSession,
  revokeAllSessions,
  purgeExpiredSessions,
};
