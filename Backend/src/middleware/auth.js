'use strict';

const { authenticateToken } = require('../services/authService');
const { forbidden } = require('../utils/errors');

function bearerToken(req) {
  const header = req.headers.authorization || '';
  return header.startsWith('Bearer ') ? header.slice(7).trim() : '';
}

/** Requires a valid session; exposes it as `req.auth`. */
async function requireAuth(req, res, next) {
  req.auth = await authenticateToken(bearerToken(req));
  next();
}

/**
 * Role guard. `requireRole('superadmin')`, `requireRole('user')`, or
 * `requireRole('superadmin', { owner: true })` for owner-only actions.
 */
function requireRole(role, { owner = false } = {}) {
  return async (req, res, next) => {
    if (!req.auth) await requireAuth(req, res, () => {});
    if (req.auth.role !== role) throw forbidden();
    if (owner && req.auth.account.role !== 'owner') throw forbidden('Réservé aux administrateurs principaux');
    next();
  };
}

/** Students flagged `mustChangePassword` may only reach the password route. */
function blockIfPasswordChangeRequired(req, res, next) {
  if (req.auth?.role === 'user' && req.auth.account.mustChangePassword) {
    throw forbidden('Vous devez changer votre mot de passe avant de continuer');
  }
  next();
}

module.exports = { requireAuth, requireRole, blockIfPasswordChangeRequired, bearerToken };
