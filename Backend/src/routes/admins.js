'use strict';

const express = require('express');
const { validate, z, idParam, password, optionalId } = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const auth = require('../services/authService');
const { Op } = require('sequelize');
const { SuperAdmin, Department } = require('../models');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();

// Staff can list colleagues (needed to assign tickets): a department admin
// only sees the super admins and the admins of their own department.
// Only owners can create, edit or remove accounts.
const ownerOnly = requireRole('superadmin', { owner: true });

const adminIncludes = [{ model: Department, attributes: ['id', 'name'] }];

const serialize = (admin) => ({
  id: admin.id,
  login: admin.login,
  displayName: admin.displayName,
  role: admin.role,
  isActive: admin.isActive,
  department: admin.department ? { id: admin.department.id, name: admin.department.name } : null,
  lastLoginAt: admin.lastLoginAt,
  createdAt: admin.createdAt,
});

router.get('/', requireRole('superadmin'), async (req, res) => {
  const { account } = req.auth;
  const where = account.role === 'owner' || !account.departmentId
    ? {}
    : { [Op.or]: [{ role: 'owner' }, { departmentId: account.departmentId }] };
  const admins = await SuperAdmin.findAll({
    where,
    include: adminIncludes,
    order: [['displayName', 'ASC'], ['login', 'ASC']],
  });
  res.json(admins.map(serialize));
});

const body = z.object({
  login: z.string().trim().min(3).max(60).regex(/^[\w.@-]+$/, 'login invalide'),
  displayName: z.string().trim().min(1).max(100),
  password,
  role: z.enum(['owner', 'agent']).default('agent'),
  departmentId: optionalId,
  isActive: z.boolean().optional(),
});

router.post('/', ownerOnly, validate({ body }), async (req, res) => {
  const { password: plain, ...data } = req.valid.body;
  const admin = await SuperAdmin.create({ ...data, password: await auth.hashPassword(plain) });
  res.status(201).json(serialize(await SuperAdmin.findByPk(admin.id, { include: adminIncludes })));
});

router.patch('/:id', ownerOnly, validate({ params: idParam, body: body.partial() }), async (req, res) => {
  const admin = await SuperAdmin.findByPk(req.valid.params.id);
  if (!admin) throw notFound('Administrateur introuvable');
  const { password: plain, ...data } = req.valid.body;
  if (admin.id === req.auth.id && (data.role === 'agent' || data.isActive === false)) {
    throw badRequest('Vous ne pouvez pas retirer vos propres droits');
  }
  if (plain) data.password = await auth.hashPassword(plain);
  await admin.update(data);
  if (plain || data.isActive === false) await auth.revokeAllSessions('superadmin', admin.id);
  res.json(serialize(await SuperAdmin.findByPk(admin.id, { include: adminIncludes })));
});

router.delete('/:id', ownerOnly, validate({ params: idParam }), async (req, res) => {
  if (req.valid.params.id === req.auth.id) throw badRequest('Vous ne pouvez pas supprimer votre propre compte');
  const admin = await SuperAdmin.findByPk(req.valid.params.id);
  if (!admin) throw notFound('Administrateur introuvable');
  await auth.revokeAllSessions('superadmin', admin.id);
  await admin.destroy();
  res.status(204).end();
});

module.exports = router;
