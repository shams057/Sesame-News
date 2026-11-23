'use strict';

const express = require('express');
const path = require('path');
const { Op } = require('sequelize');
const { validate, z, idParam, pageQuery, boolish, optionalId } = require('../middleware/validate');
const { requireAuth, requireRole, blockIfPasswordChangeRequired } = require('../middleware/auth');
const { ticketAttachmentUpload, removeStoredFile } = require('../middleware/upload');
const env = require('../config/env');
const { Ticket, TicketMessage, Department, SuperAdmin } = require('../models');
const svc = require('../services/ticketService');
const realtime = require('../services/realtime');
const { paginate, pageResult, likeTerm } = require('../utils/helpers');
const { notFound, badRequest, forbidden } = require('../utils/errors');

const router = express.Router();
router.use(requireAuth, blockIfPasswordChangeRequired);

const REOPEN_WINDOW_DAYS = 14;
const isStaff = (req) => req.auth.role === 'superadmin';

/**
 * GET /api/v1/tickets
 *  students: their own tickets
 *  staff:    ?status=&departmentId=&priority=&assigned=me|unassigned|<id>&unread=true&q=&sort=
 */
router.get('/', validate({
  query: z.object({
    ...pageQuery,
    status: z.enum(['open', 'in_progress', 'closed', 'active']).optional(),
    departmentId: z.coerce.number().int().positive().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assigned: z.string().regex(/^(me|unassigned|\d+)$/).optional(),
    unread: boolish.optional(),
    q: z.string().trim().max(100).optional(),
    sort: z.enum(['-createdAt', 'createdAt', '-updatedAt', 'priority']).default('-createdAt'),
  }),
}), async (req, res) => {
  const query = req.valid.query;
  const where = isStaff(req) ? svc.staffScope(req.auth.account) : { userId: req.auth.id };
  if (query.status === 'active') where.status = { [Op.ne]: 'closed' };
  else if (query.status) where.status = query.status;
  if (query.priority) where.priority = query.priority;
  if (query.q) {
    const asId = Number(query.q.replace(/^#/, ''));
    where[Op.or] = [
      { title: { [Op.like]: likeTerm(query.q) } },
      { description: { [Op.like]: likeTerm(query.q) } },
      ...(Number.isInteger(asId) && asId > 0 ? [{ id: asId }] : []),
    ];
  }
  if (isStaff(req)) {
    if (query.departmentId && !where.departmentId) where.departmentId = query.departmentId;
    if (query.departmentId && where.departmentId && where.departmentId !== query.departmentId) where.id = -1;
    if (query.assigned === 'me') where.assignedToId = req.auth.id;
    else if (query.assigned === 'unassigned') where.assignedToId = null;
    else if (query.assigned) where.assignedToId = Number(query.assigned);
    if (query.unread) {
      const unread = await svc.staffUnreadCounts(req.auth.account);
      where.id = { [Op.in]: [...unread.keys(), -1] };
    }
  }

  const order = {
    '-createdAt': [['createdAt', 'DESC']],
    createdAt: [['createdAt', 'ASC']],
    '-updatedAt': [['updatedAt', 'DESC']],
    priority: [[Ticket.sequelize.literal("FIELD(priority, 'urgent', 'high', 'normal', 'low')"), 'ASC'], ['createdAt', 'ASC']],
  }[query.sort];
  const result = await Ticket.findAndCountAll({ where, include: svc.ticketIncludes, order, ...paginate(query) });
  const ids = result.rows.map((ticket) => ticket.id);
  const unread = isStaff(req) ? await svc.staffUnreadCounts(req.auth.account, ids) : await svc.userUnreadCounts(req.auth.id, ids);
  const rows = result.rows.map((ticket) => svc.serializeTicket(ticket, { unreadCount: unread.get(ticket.id) || 0, forUser: !isStaff(req) }));
  res.json(pageResult({ rows, count: result.count }, query));
});

/** GET /api/v1/tickets/unread — ids of tickets with unread messages for the caller. */
router.get('/unread', async (req, res) => {
  const unread = isStaff(req) ? await svc.staffUnreadCounts(req.auth.account) : await svc.userUnreadCounts(req.auth.id);
  res.json({ ticketIds: [...unread.keys()], count: unread.size });
});

/** POST /api/v1/tickets — students open a ticket for a department. */
router.post('/', requireRole('user'), validate({
  body: z.object({
    title: z.string().trim().min(3, 'Sujet trop court').max(150),
    description: z.string().trim().min(10, 'Décrivez votre demande (10 caractères minimum)').max(4000),
    departmentId: z.coerce.number().int().positive(),
    priority: z.enum(['low', 'normal', 'high']).default('normal'),
  }),
}), async (req, res) => {
  const { title, description, departmentId, priority } = req.valid.body;
  const department = await Department.findOne({ where: { id: departmentId, isActive: true } });
  if (!department) throw badRequest('Service inconnu');
  const ticket = await Ticket.create({ title, description, departmentId, priority, userId: req.auth.id, status: 'open' });
  // The description becomes the first message of the conversation.
  await TicketMessage.create({
    ticketId: ticket.id, content: description, senderRole: 'user', senderName: req.auth.name, userId: req.auth.id, userReadAt: new Date(),
  });
  await ticket.reload({ include: svc.ticketIncludes });
  realtime.toStaff(ticket.departmentId, 'ticket:created', svc.serializeTicket(ticket, { unreadCount: 1 }));
  res.status(201).json(svc.serializeTicket(ticket, { forUser: true }));
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const ticket = await svc.findTicketFor(req.auth, req.valid.params.id);
  res.json(svc.serializeTicket(ticket, { forUser: !isStaff(req) }));
});

/**
 * PATCH /api/v1/tickets/:id
 *  staff:    status, priority, assignedToId, departmentId (transfer)
 *  students: status (close, or reopen within 14 days), rating 1-5 + comment once closed
 */
router.patch('/:id', validate({
  params: idParam,
  body: z.object({
    status: z.enum(['open', 'in_progress', 'closed']).optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    assignedToId: optionalId,
    departmentId: z.coerce.number().int().positive().optional(),
    rating: z.coerce.number().int().min(1).max(5).optional(),
    ratingComment: z.string().trim().max(500).optional(),
  }),
}), async (req, res) => {
  const ticket = await svc.findTicketFor(req.auth, req.valid.params.id);
  const body = req.valid.body;

  if (isStaff(req)) {
    if (body.rating !== undefined || body.ratingComment !== undefined) throw forbidden('Seul l’étudiant peut noter un ticket');
    const updates = {};
    if (body.priority && body.priority !== ticket.priority) updates.priority = body.priority;
    if (body.assignedToId !== undefined && body.assignedToId !== ticket.assignedToId) {
      if (body.assignedToId) {
        const agent = await SuperAdmin.findOne({ where: { id: body.assignedToId, isActive: true } });
        if (!agent) throw badRequest('Agent inconnu ou désactivé');
        if (agent.departmentId && agent.departmentId !== ticket.departmentId) throw badRequest('Cet agent ne traite pas ce service');
      }
      updates.assignedToId = body.assignedToId;
    }
    if (body.departmentId && body.departmentId !== ticket.departmentId) {
      if (!(await Department.findByPk(body.departmentId))) throw badRequest('Service inconnu');
      updates.departmentId = body.departmentId;
      updates.assignedToId = null;
    }
    const previousDepartment = ticket.departmentId;
    if (Object.keys(updates).length) await ticket.update(updates);
    if (updates.departmentId) {
      const department = await Department.findByPk(updates.departmentId);
      await svc.addSystemMessage(ticket, `Ticket transféré au service : ${department.name}`);
      realtime.toStaff(previousDepartment, 'ticket:updated', { id: ticket.id, departmentId: ticket.departmentId, transferred: true });
    }
    if (body.status) await svc.applyStatusChange(ticket, body.status, req.auth.name);
  } else {
    if (body.priority || body.assignedToId !== undefined || body.departmentId) throw forbidden();
    if (body.status === 'in_progress') throw forbidden('Statut non autorisé');
    if (body.status === 'open' && ticket.status === 'closed') {
      const closedSince = Date.now() - new Date(ticket.closedAt).getTime();
      if (closedSince > REOPEN_WINDOW_DAYS * 24 * 3600 * 1000) {
        throw badRequest(`Ce ticket est fermé depuis plus de ${REOPEN_WINDOW_DAYS} jours : ouvrez un nouveau ticket.`);
      }
      await ticket.update({ rating: null, ratingComment: null });
    }
    if (body.status) await svc.applyStatusChange(ticket, body.status, 'L’étudiant');
    if (body.rating !== undefined) {
      if (ticket.status !== 'closed') throw badRequest('Vous pourrez noter le ticket une fois fermé');
      await ticket.update({ rating: body.rating, ratingComment: body.ratingComment || null });
    }
  }

  await ticket.reload({ include: svc.ticketIncludes });
  svc.emitTicketUpdated(ticket);
  res.json(svc.serializeTicket(ticket, { forUser: !isStaff(req) }));
});

/** DELETE /api/v1/tickets/:id — owners only (prefer closing). */
router.delete('/:id', requireRole('superadmin', { owner: true }), validate({ params: idParam }), async (req, res) => {
  const ticket = await Ticket.findByPk(req.valid.params.id, { include: [{ model: TicketMessage, as: 'messages', attributes: ['attachmentPath'] }] });
  if (!ticket) throw notFound('Ticket introuvable');
  const files = ticket.messages.map((message) => message.attachmentPath).filter(Boolean);
  await ticket.destroy();
  await Promise.all(files.map((file) => removeStoredFile(file, { isPrivate: true })));
  realtime.toStaff(ticket.departmentId, 'ticket:deleted', { id: ticket.id });
  res.status(204).end();
});

// ─── Conversation ───────────────────────────────────────────────────────────
router.get('/:id/messages', validate({ params: idParam }), async (req, res) => {
  const ticket = await svc.findTicketFor(req.auth, req.valid.params.id);
  const where = { ticketId: ticket.id, ...(isStaff(req) ? {} : { isInternal: false }) };
  const messages = await TicketMessage.findAll({ where, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
  res.json({ content: messages.map(svc.serializeMessage) });
});

/** POST /api/v1/tickets/:id/messages — JSON or multipart (`attachment`). */
router.post('/:id/messages', ticketAttachmentUpload.single('attachment'), async (req, res) => {
  try {
    const { id } = idParam.parse(req.params);
    const body = z.object({
      content: z.string().trim().max(4000).default(''),
      isInternal: boolish.optional(),
    }).parse(req.body ?? {});
    const ticket = await svc.findTicketFor(req.auth, id);
    if (ticket.status === 'closed') throw badRequest('Ce ticket est fermé : rouvrez-le pour continuer la conversation');
    if (!body.content && !req.file) throw badRequest('Le message est vide');
    if (body.isInternal && !isStaff(req)) throw forbidden();
    const message = await svc.postMessage(req.auth, ticket, {
      content: body.content || `📎 ${req.file.safeName}`,
      isInternal: Boolean(body.isInternal),
      file: req.file,
    });
    res.status(201).json(message);
  } catch (error) {
    if (req.file) await removeStoredFile(req.file.filename, { isPrivate: true });
    throw error;
  }
});

router.post('/:id/read', validate({ params: idParam }), async (req, res) => {
  const ticket = await svc.findTicketFor(req.auth, req.valid.params.id);
  await svc.markRead(req.auth, ticket);
  res.status(204).end();
});

/** Private attachment download, after the same access check as the conversation. */
router.get('/:id/messages/:messageId/attachment', validate({
  params: z.object({ id: z.coerce.number().int().positive(), messageId: z.coerce.number().int().positive() }),
}), async (req, res) => {
  const ticket = await svc.findTicketFor(req.auth, req.valid.params.id);
  const message = await TicketMessage.findOne({ where: { id: req.valid.params.messageId, ticketId: ticket.id } });
  if (!message?.attachmentPath || (message.isInternal && !isStaff(req))) throw notFound('Pièce jointe introuvable');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'private, no-store');
  res.attachment(message.attachmentName || 'piece-jointe');
  res.type(message.attachmentMime || 'application/octet-stream');
  res.sendFile(path.join(env.privateUploadDir, path.basename(message.attachmentPath)));
});

module.exports = router;
