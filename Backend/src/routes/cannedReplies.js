'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { validate, z, idParam, optionalId } = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { CannedReply, Department } = require('../models');
const { notFound, forbidden } = require('../utils/errors');

/**
 * Canned replies ("réponses types") for frequent questions. A reply is
 * global (no department) or scoped to one department; agents restricted
 * to a department only see/manage global replies and their own department's.
 */
const router = express.Router();
router.use(requireRole('superadmin'));

const serialize = (reply) => ({
  id: reply.id,
  title: reply.title,
  content: reply.content,
  department: reply.department ? { id: reply.department.id, name: reply.department.name } : null,
  updatedAt: reply.updatedAt,
});

function scopeFor(admin, departmentId) {
  const allowed = admin.departmentId ? [null, admin.departmentId] : null;
  const where = {};
  if (departmentId) where.departmentId = { [Op.or]: [null, departmentId] };
  if (allowed) where.departmentId = { [Op.or]: allowed };
  return where;
}

/** GET /api/v1/canned-replies?departmentId= — replies usable for that department. */
router.get('/', validate({ query: z.object({ departmentId: z.coerce.number().int().positive().optional() }) }), async (req, res) => {
  const replies = await CannedReply.findAll({
    where: scopeFor(req.auth.account, req.valid.query.departmentId),
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    order: [['title', 'ASC']],
  });
  res.json(replies.map(serialize));
});

const body = z.object({
  title: z.string().trim().min(1).max(100),
  content: z.string().trim().min(1).max(4000),
  departmentId: optionalId,
});

function assertCanManage(admin, departmentId) {
  if (admin.departmentId && departmentId !== admin.departmentId) {
    throw forbidden('Vous ne pouvez gérer que les réponses de votre service');
  }
}

router.post('/', validate({ body }), async (req, res) => {
  const departmentId = req.valid.body.departmentId ?? (req.auth.account.departmentId || null);
  assertCanManage(req.auth.account, departmentId);
  const reply = await CannedReply.create({ ...req.valid.body, departmentId, createdById: req.auth.id });
  res.status(201).json(serialize(await CannedReply.findByPk(reply.id, { include: [{ model: Department, as: 'department' }] })));
});

router.patch('/:id', validate({ params: idParam, body: body.partial() }), async (req, res) => {
  const reply = await CannedReply.findByPk(req.valid.params.id);
  if (!reply) throw notFound('Réponse introuvable');
  assertCanManage(req.auth.account, reply.departmentId);
  if (req.valid.body.departmentId !== undefined) assertCanManage(req.auth.account, req.valid.body.departmentId);
  await reply.update(req.valid.body);
  res.json(serialize(await CannedReply.findByPk(reply.id, { include: [{ model: Department, as: 'department' }] })));
});

router.delete('/:id', validate({ params: idParam }), async (req, res) => {
  const reply = await CannedReply.findByPk(req.valid.params.id);
  if (!reply) throw notFound('Réponse introuvable');
  assertCanManage(req.auth.account, reply.departmentId);
  await reply.destroy();
  res.status(204).end();
});

module.exports = router;
