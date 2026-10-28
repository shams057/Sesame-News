const express = require('express');
const route = express.Router();
const db = require('./../models');
const { Op } = require('sequelize');
let io;

const DEPARTMENTS = [
  'Service Scolarité',
  'Service Stage',
  'Département licence Informatique',
  'Département Management',
  'Département Prepa_Ingénieur',
  'Département FTA',
  'Service IT',
  'Service qualité',
  'Service coopération international',
  'Service Marketing',
  'Service Admission',
  'Service Finance',
  'Service Student Success',
];

async function getUserToken(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;
  return db.TokenUser.findOne({ where: { token } });
}

// GET all tickets — paginated, filterable by status and/or department
route.get('/tickets', async (req, res, next) => {
  const size = 20;
  try {
    let page = 0;
    const nbrPage = Number.parseInt(req.query.page);
    if (!Number.isNaN(nbrPage) && nbrPage > 0) page = nbrPage;

    const where = {};
    if (req.query.status && ['open', 'in_progress', 'closed'].includes(req.query.status)) {
      where.status = req.query.status;
    }
    if (req.query.department && DEPARTMENTS.includes(req.query.department)) {
      where.department = req.query.department;
    }

    if (req.query.unread === 'true') {
      const unreadMessages = await db.ticketMessage.findAll({
        where: { senderRole: 'user', adminReadAt: null },
        attributes: ['ticketId'],
        group: ['ticketId'],
        raw: true,
      });
      where.id = { [Op.in]: unreadMessages.map((message) => message.ticketId) };
    }

    const tickets = await db.ticket.findAndCountAll({
      where,
      limit: size,
      offset: page * size,
      order: [['createdAt', 'DESC']],
    });

    const ids = tickets.rows.map((ticket) => ticket.id);
    const unreadRows = ids.length ? await db.ticketMessage.findAll({
      where: { ticketId: { [Op.in]: ids }, senderRole: 'user', adminReadAt: null },
      attributes: ['ticketId', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'unreadCount']],
      group: ['ticketId'],
      raw: true,
    }) : [];
    const unreadByTicket = new Map(unreadRows.map((row) => [Number(row.ticketId), Number(row.unreadCount)]));

    res.status(200).send({
      content: tickets.rows.map((ticket) => ({ ...ticket.toJSON(), unreadChatCount: unreadByTicket.get(ticket.id) || 0 })),
      totalPages: Math.ceil(tickets.count / size),
      totalElements: tickets.count,
    });
  } catch (error) {
    next(error);
  }
});

// Database-backed dashboard aggregates. Ticket records currently store a department,
// title, status and lifecycle timestamps, so the report only exposes metrics derivable
// from those fields.
route.get('/ticket-statistics', async (req, res, next) => {
  try {
    const now = new Date();
    const period = req.query.period || 'month';
    const starts = {
      today: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
      '7days': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      month: new Date(now.getFullYear(), now.getMonth(), 1),
      semester: new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000),
      year: new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000),
    };
    const startDate = starts[period] || starts.month;
    const where = { createdAt: { [Op.gte]: startDate } };
    if (DEPARTMENTS.includes(req.query.department)) where.department = req.query.department;

    const tickets = await db.ticket.findAll({
      where,
      attributes: ['id', 'title', 'description', 'department', 'status', 'createdAt', 'openedAt', 'closedAt'],
      order: [['createdAt', 'DESC']],
    });
    const open = tickets.filter((ticket) => ticket.status !== 'closed').length;
    const closed = tickets.length - open;
    const departments = new Map();
    const categories = new Map();
    const timeline = new Map();
    const classify = (ticket) => {
      const title = `${ticket.title || ''} ${ticket.description || ''}`.toLowerCase();
      if (/stage|convention|pfe/.test(title)) return 'Stages & conventions';
      if (/inscription|admission|attestation|scolar/.test(title)) return 'Scolarité & inscriptions';
      if (/wifi|wi-fi|ent|moodle|informatique|technique|connexion/.test(title)) return 'IT & accès numériques';
      if (/finance|paiement|facture|bourse/.test(title)) return 'Finance';
      return 'Autres demandes';
    };

    tickets.forEach((ticket) => {
      const department = ticket.department || 'Non attribué';
      const group = departments.get(department) || { department, total: 0, open: 0, closed: 0 };
      group.total += 1;
      group[ticket.status === 'closed' ? 'closed' : 'open'] += 1;
      departments.set(department, group);
      const category = classify(ticket);
      categories.set(category, (categories.get(category) || 0) + 1);
      const created = new Date(ticket.createdAt || ticket.openedAt);
      const key = created.toISOString().slice(0, 10);
      const bucket = timeline.get(key) || { date: key, opened: 0, closed: 0 };
      bucket.opened += 1;
      if (ticket.status === 'closed' && ticket.closedAt) bucket.closed += 1;
      timeline.set(key, bucket);
    });

    res.status(200).json({
      period,
      startDate,
      total: tickets.length,
      open,
      closed,
      resolutionRate: tickets.length ? Math.round((closed / tickets.length) * 1000) / 10 : 0,
      departments: [...departments.values()].sort((a, b) => b.total - a.total),
      categories: [...categories.entries()].map(([label, count]) => ({ label, count })).sort((a, b) => b.count - a.count),
      timeline: [...timeline.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-30),
      recent: tickets.slice(0, 8),
    });
  } catch (error) {
    next(error);
  }
});

// GET tickets belonging to the authenticated student
route.get('/mytickets', async (req, res, next) => {
  try {
    const userToken = await getUserToken(req);
    if (!userToken) return res.status(401).json({ error: 'Authentification requise' });

    const tickets = await db.ticket.findAll({
      where: { userId: userToken.userId },
      order: [['createdAt', 'DESC']],
    });

    const ids = tickets.map((ticket) => ticket.id);
    const unreadRows = ids.length ? await db.ticketMessage.findAll({
      where: { ticketId: { [Op.in]: ids }, senderRole: 'superadmin', userReadAt: null },
      attributes: ['ticketId', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'unreadCount']],
      group: ['ticketId'],
      raw: true,
    }) : [];
    const unreadByTicket = new Map(unreadRows.map((row) => [Number(row.ticketId), Number(row.unreadCount)]));

    res.status(200).send({ content: tickets.map((ticket) => ({ ...ticket.toJSON(), unreadChatCount: unreadByTicket.get(ticket.id) || 0 })), totalElements: tickets.length });
  } catch (error) {
    next(error);
  }
});

// Update a ticket only when it belongs to the authenticated student
route.put('/myticket/:id', async (req, res) => {
  try {
    const userToken = await getUserToken(req);
    if (!userToken) return res.status(401).json({ error: 'Authentification requise' });
    if (!['open', 'in_progress', 'closed'].includes(req.body.status)) {
      return res.status(400).json({ error: 'Statut invalide' });
    }

    const ticket = await db.ticket.findOne({
      where: { id: req.params.id, userId: userToken.userId },
    });
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });

    const previousStatus = ticket.status;
    await ticket.update({
      status: req.body.status,
      closedAt: req.body.status === 'closed' ? new Date() : null,
    });
    if (io && previousStatus !== ticket.status) {
      io.to(`user:${ticket.userId}`).emit('ticket:status', {
        ticketId: ticket.id,
        status: ticket.status,
        closedAt: ticket.closedAt,
        updatedAt: ticket.updatedAt,
      });
    }
    res.status(200).send(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
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
route.post('/createticket', async (req, res) => {
  const { title, description, status, department, openedAt, closedAt } = req.body;

  if (!title || !department) {
    return res.status(400).json({ error: 'title et department sont obligatoires' });
  }

  try {
    const userToken = await getUserToken(req);
    const ticket = await db.ticket.create({
      title,
      description: description || null,
      status: status || 'open',
      department,
      openedAt: openedAt || new Date(),
      closedAt: closedAt || null,
      userId: userToken?.userId || null,
    });
    res.status(200).send(ticket);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
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
      if (!['open', 'in_progress', 'closed'].includes(req.body.status)) {
        return res.status(400).json({ error: 'Statut invalide' });
      }
      data.status = req.body.status;
      // Auto-set closedAt when closing
      if (req.body.status === 'closed' && !req.body.closedAt) {
        data.closedAt = new Date();
      }
    }
    if (req.body.closedAt !== undefined) data.closedAt = req.body.closedAt;

    const previous = await db.ticket.findByPk(req.params.id);
    if (!previous) return res.status(404).json({ error: 'Ticket non trouvé' });
    const [updated] = await db.ticket.update(data, { where: { id: req.params.id } });
    if (!updated) return res.status(404).json({ error: 'Ticket non trouvé' });

    const ticket = await db.ticket.findOne({ where: { id: req.params.id } });
    if (io && ticket.userId && previous.status !== ticket.status) {
      io.to(`user:${ticket.userId}`).emit('ticket:status', {
        ticketId: ticket.id,
        status: ticket.status,
        closedAt: ticket.closedAt,
        updatedAt: ticket.updatedAt,
      });
    }
    res.status(200).send(ticket);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

route.setSocketServer = (socketServer) => { io = socketServer; };

// DELETE ticket
route.delete('/ticket/:id', (req, res) => {
  db.ticket
    .destroy({ where: { id: req.params.id } })
    .then((r) => res.status(200).send(r))
    .catch((err) => res.status(400).send(err));
});

module.exports = route;
