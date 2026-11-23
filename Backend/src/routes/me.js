'use strict';

const express = require('express');
const { validate, z, password } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const auth = require('../services/authService');
const { User, SuperAdmin, Categorie, Department, PushToken } = require('../models');
const { badRequest } = require('../utils/errors');

const router = express.Router();

async function serializeAccount(role, account) {
  if (role === 'user') {
    const category = account.categorieId ? await Categorie.findByPk(account.categorieId) : null;
    return {
      role: 'user',
      id: account.id,
      login: account.login,
      email: account.email,
      firstname: account.firstname,
      lastname: account.lastname,
      categorie: category ? { id: category.id, libelle: category.libelle } : null,
      mustChangePassword: account.mustChangePassword,
    };
  }
  const department = account.departmentId ? await Department.findByPk(account.departmentId) : null;
  const managed = account.role === 'owner' || !account.departmentId
    ? []
    : await Categorie.findAll({ where: { departmentId: account.departmentId }, order: [['libelle', 'ASC']] });
  return {
    role: 'superadmin',
    id: account.id,
    login: account.login,
    displayName: account.displayName,
    adminRole: account.role,
    department: department ? { id: department.id, name: department.name } : null,
    // Student classes this admin manages (all of their department's classes).
    managedCategories: managed.map((category) => ({ id: category.id, libelle: category.libelle })),
  };
}

/** GET /api/v1/me — validates the session and returns the profile. */
router.get('/', requireAuth, async (req, res) => {
  res.json(await serializeAccount(req.auth.role, req.auth.account));
});

/** PATCH /api/v1/me — students edit their e-mail, staff their display name. */
router.patch('/', requireAuth, validate({
  body: z.object({
    email: z.union([z.literal(''), z.string().trim().email().max(255)]).optional(),
    displayName: z.string().trim().min(1).max(100).optional(),
  }),
}), async (req, res) => {
  const { email, displayName } = req.valid.body;
  if (req.auth.role === 'user' && email !== undefined) await req.auth.account.update({ email: email || null });
  if (req.auth.role === 'superadmin' && displayName !== undefined) await req.auth.account.update({ displayName });
  res.json(await serializeAccount(req.auth.role, req.auth.account));
});

/**
 * PUT /api/v1/me/password — requires the current password. Revokes every
 * other session of the account.
 */
router.put('/password', requireAuth, validate({
  body: z.object({ currentPassword: z.string().min(1).max(128), newPassword: password }),
}), async (req, res) => {
  const { currentPassword, newPassword } = req.valid.body;
  const Model = req.auth.role === 'user' ? User : SuperAdmin;
  const account = await Model.scope('withPassword').findByPk(req.auth.id);
  if (!(await auth.comparePassword(currentPassword, account.password))) throw badRequest('Mot de passe actuel incorrect');
  if (currentPassword === newPassword) throw badRequest('Le nouveau mot de passe doit être différent');
  await account.update({
    password: await auth.hashPassword(newPassword),
    ...(req.auth.role === 'user' ? { mustChangePassword: false } : {}),
  });
  await auth.revokeAllSessions(req.auth.role, req.auth.id, req.auth.session.id);
  res.status(204).end();
});

/** POST /api/v1/me/push-tokens — registers this device for notifications. */
router.post('/push-tokens', requireRole('user'), validate({
  body: z.object({
    token: z.string().trim().regex(/^(ExponentPushToken|ExpoPushToken)\[.+\]$/, 'Jeton Expo invalide').max(255),
    platform: z.enum(['ios', 'android', 'web']).optional(),
  }),
}), async (req, res) => {
  const { token, platform } = req.valid.body;
  // A device that changed hands moves to the new account.
  await PushToken.destroy({ where: { token } });
  await PushToken.create({ userId: req.auth.id, token, platform: platform || null });
  res.status(204).end();
});

/** DELETE /api/v1/me/push-tokens — unregisters a device (on logout). */
router.delete('/push-tokens', requireRole('user'), validate({
  body: z.object({ token: z.string().trim().max(255) }),
}), async (req, res) => {
  await PushToken.destroy({ where: { token: req.valid.body.token, userId: req.auth.id } });
  res.status(204).end();
});

module.exports = router;
module.exports.serializeAccount = serializeAccount;
