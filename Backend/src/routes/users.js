'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { validate, z, idParam, pageQuery, password, optionalId } = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { csvUpload } = require('../middleware/upload');
const auth = require('../services/authService');
const { importUsers, TEMPLATE } = require('../services/userImportService');
const { User, Categorie } = require('../models');
const { paginate, pageResult, likeTerm, generateTempPassword } = require('../utils/helpers');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();
router.use(requireRole('superadmin'));

const include = [{ model: Categorie, attributes: ['id', 'libelle'] }];
const serialize = (user) => ({
  id: user.id,
  login: user.login,
  email: user.email,
  firstname: user.firstname,
  lastname: user.lastname,
  isActive: user.isActive,
  mustChangePassword: user.mustChangePassword,
  categorie: user.categorie ? { id: user.categorie.id, libelle: user.categorie.libelle } : null,
  lastLoginAt: user.lastLoginAt,
  createdAt: user.createdAt,
});

/** GET /api/v1/users?q=&categorieId=&status=active|inactive&sort=&page=&pageSize= */
router.get('/', validate({
  query: z.object({
    ...pageQuery,
    q: z.string().trim().max(100).optional(),
    categorieId: z.coerce.number().int().positive().optional(),
    status: z.enum(['active', 'inactive']).optional(),
    sort: z.enum(['name', '-createdAt', 'login', '-lastLoginAt']).default('name'),
  }),
}), async (req, res) => {
  const { q, categorieId, status, sort } = req.valid.query;
  const where = {};
  if (q) where[Op.or] = ['login', 'firstname', 'lastname', 'email'].map((field) => ({ [field]: { [Op.like]: likeTerm(q) } }));
  if (categorieId) where.categorieId = categorieId;
  if (status) where.isActive = status === 'active';
  const order = {
    name: [['lastname', 'ASC'], ['firstname', 'ASC']],
    login: [['login', 'ASC']],
    '-createdAt': [['createdAt', 'DESC']],
    '-lastLoginAt': [['lastLoginAt', 'DESC']],
  }[sort];
  const result = await User.findAndCountAll({ where, include, order, ...paginate(req.valid.query) });
  res.json(pageResult({ rows: result.rows.map(serialize), count: result.count }, req.valid.query));
});

/** GET /api/v1/users/import/template — CSV template to fill in. */
router.get('/import/template', (req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="modele_import_etudiants.csv"');
  res.send(TEMPLATE);
});

/** POST /api/v1/users/import — multipart field `file` (CSV). */
router.post('/import', csvUpload.single('file'), async (req, res) => {
  if (!req.file) throw badRequest('Fichier CSV requis');
  res.status(201).json(await importUsers(req.file.buffer));
});

/**
 * POST /api/v1/users/bulk { ids, action: activate|deactivate|setCategory, categorieId? }
 * Applies one action to many students at once (max 500).
 */
router.post('/bulk', validate({
  body: z.object({
    ids: z.array(z.coerce.number().int().positive()).min(1).max(500),
    action: z.enum(['activate', 'deactivate', 'setCategory']),
    categorieId: optionalId,
  }),
}), async (req, res) => {
  const { ids, action, categorieId } = req.valid.body;
  let updated;
  if (action === 'setCategory') {
    if (categorieId && !(await Categorie.findByPk(categorieId))) throw badRequest('Catégorie inconnue');
    [updated] = await User.update({ categorieId: categorieId ?? null }, { where: { id: { [Op.in]: ids } } });
  } else {
    [updated] = await User.update({ isActive: action === 'activate' }, { where: { id: { [Op.in]: ids } } });
    if (action === 'deactivate') await Promise.all(ids.map((id) => auth.revokeAllSessions('user', id)));
  }
  res.json({ updated });
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const user = await User.findByPk(req.valid.params.id, { include });
  if (!user) throw notFound('Utilisateur introuvable');
  res.json(serialize(user));
});

const body = z.object({
  firstname: z.string().trim().min(1).max(100),
  lastname: z.string().trim().min(1).max(100),
  login: z.string().trim().min(3).max(100).regex(/^[\w.@-]+$/, 'login invalide'),
  email: z.union([z.literal(''), z.string().trim().email().max(255)]).optional().transform((value) => value || null),
  categorieId: optionalId,
  isActive: z.boolean().optional(),
});

/**
 * POST /api/v1/users — the password is optional: when omitted a temporary
 * one is generated, returned once, and must be changed at first login.
 */
router.post('/', validate({ body: body.extend({ password: password.optional() }) }), async (req, res) => {
  const { password: given, ...data } = req.valid.body;
  const temporaryPassword = given || generateTempPassword();
  const user = await User.create({
    ...data,
    password: await auth.hashPassword(temporaryPassword),
    mustChangePassword: true,
  });
  res.status(201).json({ user: serialize(await User.findByPk(user.id, { include })), temporaryPassword: given ? undefined : temporaryPassword });
});

router.patch('/:id', validate({ params: idParam, body: body.partial() }), async (req, res) => {
  const user = await User.findByPk(req.valid.params.id);
  if (!user) throw notFound('Utilisateur introuvable');
  await user.update(req.valid.body);
  if (req.valid.body.isActive === false) await auth.revokeAllSessions('user', user.id);
  res.json(serialize(await User.findByPk(user.id, { include })));
});

/** POST /api/v1/users/:id/reset-password — returns a one-time temporary password. */
router.post('/:id/reset-password', validate({ params: idParam }), async (req, res) => {
  const user = await User.findByPk(req.valid.params.id);
  if (!user) throw notFound('Utilisateur introuvable');
  const temporaryPassword = generateTempPassword();
  await user.update({ password: await auth.hashPassword(temporaryPassword), mustChangePassword: true });
  await auth.revokeAllSessions('user', user.id);
  res.json({ temporaryPassword });
});

/**
 * DELETE /api/v1/users/:id — prefer deactivation (PATCH isActive=false):
 * deleting keeps the student's tickets (owner set to NULL) for history.
 */
router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const user = await User.findByPk(req.valid.params.id);
  if (!user) throw notFound('Utilisateur introuvable');
  await auth.revokeAllSessions('user', user.id);
  await user.destroy();
  res.status(204).end();
});

module.exports = router;
