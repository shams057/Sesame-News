const express = require('express');
const route = express.Router();
const db = require('./../models');

const DEPARTMENTS = ['Finance', 'IT', 'RH', 'Pédagogie', 'Administration', 'Direction', 'Autre'];

// GET all tickets — paginated, filterable by status and/or department
route.get('/tickets', async (req, res, next) => {
  const size = 20;
  try {
    let page = 0;
    const nbrPage = Number.parseInt(req.query.page);
    if (!Number.isNaN(nbrPage) && nbrPage > 0) page = nbrPage;

    const where = {};
    if (req.query.status && ['open', 'closed'].includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.department && DEPARTMENTS.includes(req.query.department)) {
      where.department = req.query.department;
    }

    const tickets = await db.ticket.findAndCountAll({
      where,
      limit: size,
      offset: page * size,
      order: [['createdAt', 'DESC']],
    });

    res.status(200).send({
      content: tickets.rows,
      totalPages: Math.ceil(tickets.count / size),
      totalElements: tickets.count,
    });
  } catch (error) {
    next(error);
  }
});

// GET one ticket
route.get('/ticket/:id', (req, res) => {
  db.ticket
    .findOne({ where: { id: req.params.id } })
    .then((r) => res.status(200).send(r))
    .catch((err) => res.status(400).send(err));
});

// POST create ticket
route.post('/createticket', (req, res) => {
  const { title, description, status, department, openedAt, closedAt } = req.body;

  if (!title || !department) {
    return res.status(400).json({ error: 'title et department sont obligatoires' });
  }

  db.ticket
    .create({
      title,
      description: description || null,
      status: status || 'open',
      department,
      openedAt: openedAt || new Date(),
      closedAt: closedAt || null,
    })
    .then((r) => res.status(200).send(r))
    .catch((err) => res.status(400).json({ error: err.message }));
});

// PUT update ticket
route.put('/ticket/:id', async (req, res) => {
  try {
    const data = {};
    if (req.body.title !== undefined) data.title = req.body.title;
    if (req.body.description !== undefined) data.description = req.body.description;
    if (req.body.department !== undefined) data.department = req.body.department;
    if (req.body.openedAt !== undefined) data.openedAt = req.body.openedAt;

    if (req.body.status !== undefined) {
      data.status = req.body.status;
      // Auto-set closedAt when closing
      if (req.body.status === 'closed' && !req.body.closedAt) {
        data.closedAt = new Date();
      }
    }
    if (req.body.closedAt !== undefined) data.closedAt = req.body.closedAt;

    const [updated] = await db.ticket.update(data, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Ticket non trouvé' });

    const ticket = await db.ticket.findOne({ where: { id: req.params.id } });
    res.status(200).send(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE ticket
route.delete('/ticket/:id', (req, res) => {
  db.ticket
    .destroy({ where: { id: req.params.id } })
    .then((r) => res.status(200).send(r))
    .catch((err) => res.status(400).send(err));
});

module.exports = route;
