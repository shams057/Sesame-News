'use strict';

const express = require('express');
const { validate, z } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { loginLimiter } = require('../middleware/rateLimits');
const auth = require('../services/authService');
const { serializeAccount } = require('./me');

const router = express.Router();

const loginBody = z.object({
  login: z.string().trim().min(1).max(100),
  password: z.string().min(1).max(128),
});

function loginRoute(subjectType) {
  return async (req, res) => {
    const { login, password } = req.valid.body;
    const account = await auth.verifyCredentials(subjectType, login, password);
    await account.update({ lastLoginAt: new Date() });
    const { token, expiresAt } = await auth.issueToken(subjectType, account.id, req.headers['user-agent']);
    const fresh = await account.constructor.findByPk(account.id);
    res.json({ token, expiresAt, account: await serializeAccount(subjectType, fresh) });
  };
}

/** POST /api/v1/auth/user/login — students. */
router.post('/user/login', loginLimiter, validate({ body: loginBody }), loginRoute('user'));

/** POST /api/v1/auth/admin/login — staff. */
router.post('/admin/login', loginLimiter, validate({ body: loginBody }), loginRoute('superadmin'));

/** POST /api/v1/auth/logout — revokes the current session (token in the header, never in the URL). */
router.post('/logout', requireAuth, async (req, res) => {
  await auth.revokeSession(req.auth.session);
  res.status(204).end();
});

module.exports = router;
