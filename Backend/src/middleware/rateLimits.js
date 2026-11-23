'use strict';

const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const env = require('../config/env');

const common = {
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  skip: () => env.isTest,
  message: { error: 'Trop de requêtes, réessayez plus tard' },
};

/** Whole API: generous ceiling against floods. */
const apiLimiter = rateLimit({ ...common, windowMs: 60 * 1000, limit: 600 });

/** Login: 10 failed attempts per 15 min per IP + login (brute force). */
const loginLimiter = rateLimit({
  ...common,
  windowMs: 15 * 60 * 1000,
  limit: 10,
  skipSuccessfulRequests: true,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.login || '').toLowerCase()}`,
  message: { error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' },
});

/** Assistant calls cost money: 20 per minute per user. */
const assistantLimiter = rateLimit({
  ...common,
  windowMs: 60 * 1000,
  limit: 20,
  keyGenerator: (req) => (req.auth ? `user:${req.auth.id}` : ipKeyGenerator(req.ip)),
  message: { error: 'Trop de questions envoyées. Patientez une minute.' },
});

module.exports = { apiLimiter, loginLimiter, assistantLimiter };
