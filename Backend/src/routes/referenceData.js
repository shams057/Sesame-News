'use strict';

const express = require('express');
const { fn, col } = require('sequelize');
const { validate, z, idParam, optionalId } = require('../middleware/validate');
const { requireAuth, requireRole } = require('../middleware/auth');
const { Categorie, Department, User, NewsCategorie, Ticket } = require('../models');
const { notFound, conflict } = require('../utils/errors');

// ─── Categories (student groups used to target news) ────────────────────────
const categories = express.Router();
// Student classes; each belongs to a department whose admins manage its students.
const categoryBody = z.object({ libelle: z.string().trim().min(1).max(100), departmentId: optionalId });
const categoryOwner = requireRole('superadmin', { owner: true });

categories.get('/', requireAuth, async (req, res) => {
  const rows = await Categorie.findAll({ include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }], order: [['libelle', 'ASC']] });
  if (req.auth.role !== 'superadmin') return res.json(rows.map(({ id, libelle }) => ({ id, libelle })));
  const counts = await User.findAll({ attributes: ['categorieId', [fn('COUNT', col('id')), 'count']], group: ['categorieId'], raw: true });
  const byCategory = new Map(counts.map((row) => [row.categorieId, Number(row.count)]));
  return res.json(rows.map(({ id, libelle, createdAt, department }) => ({
    id, libelle, createdAt, userCount: byCategory.get(id) || 0, department: department ? { id: department.id, name: department.name } : null,
  })));
});

categories.post('/', categoryOwner, validate({ body: categoryBody }), async (req, res) => {
  res.status(201).json(await Categorie.create(req.valid.body));
});

categories.patch('/:id', categoryOwner, validate({ params: idParam, body: categoryBody.partial() }), async (req, res) => {
  const category = await Categorie.findByPk(req.valid.params.id);
  if (!category) throw notFound('Catégorie introuvable');
  res.json(await category.update(req.valid.body));
});

/** Refuses to delete a category still used by students or news (never cascades). */
categories.delete('/:id', categoryOwner, validate({ params: idParam }), async (req, res) => {
  const category = await Categorie.findByPk(req.valid.params.id);
  if (!category) throw notFound('Catégorie introuvable');
  const [users, news] = await Promise.all([
    User.count({ where: { categorieId: category.id } }),
    NewsCategorie.count({ where: { categorieId: category.id } }),
  ]);
  if (users || news) {
    throw conflict(`Catégorie utilisée par ${users} étudiant(s) et ${news} actualité(s). Réaffectez-les avant de la supprimer.`);
  }
  await category.destroy();
  res.status(204).end();
});

// ─── Departments (ticket routing) ───────────────────────────────────────────
const departments = express.Router();
const departmentBody = z.object({ name: z.string().trim().min(1).max(120), isActive: z.boolean().optional() });
const ownerOnly = requireRole('superadmin', { owner: true });

/** GET /api/v1/departments — students only get active ones. */
departments.get('/', requireAuth, async (req, res) => {
  const where = req.auth.role === 'user' ? { isActive: true } : {};
  const rows = await Department.findAll({ where, order: [['name', 'ASC']], attributes: ['id', 'name', 'isActive'] });
  res.json(rows);
});

departments.post('/', ownerOnly, validate({ body: departmentBody }), async (req, res) => {
  res.status(201).json(await Department.create(req.valid.body));
});

departments.patch('/:id', ownerOnly, validate({ params: idParam, body: departmentBody.partial() }), async (req, res) => {
  const department = await Department.findByPk(req.valid.params.id);
  if (!department) throw notFound('Service introuvable');
  res.json(await department.update(req.valid.body));
});

departments.delete('/:id', ownerOnly, validate({ params: idParam }), async (req, res) => {
  const department = await Department.findByPk(req.valid.params.id);
  if (!department) throw notFound('Service introuvable');
  if (await Ticket.count({ where: { departmentId: department.id } })) {
    throw conflict('Ce service a des tickets : désactivez-le au lieu de le supprimer.');
  }
  await department.destroy();
  res.status(204).end();
});

module.exports = { categories, departments };
