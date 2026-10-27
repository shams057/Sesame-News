const express = require('express');
const { Op } = require('sequelize');
const db = require('../models');

const route = express.Router();
let io;

async function getParticipant(req) {
  const authorization = req.headers.authorization || '';
  const token = authorization.startsWith('Bearer ') ? authorization.slice(7) : '';
  if (!token) return null;

  const [userToken, adminToken] = await Promise.all([
    db.TokenUser.findOne({ where: { token } }),
    db.TokenSuperAdmin.findOne({ where: { token } }),
  ]);
  if (userToken) {
    const user = await db.user.findByPk(userToken.userId);
    return user && { role: 'user', id: user.id, name: `${user.firstname} ${user.lastname}`.trim() };
  }
  if (adminToken) {
    const admin = await db.superAdmin.findByPk(adminToken.superAdminId);
    return admin && { role: 'superadmin', id: admin.id, name: admin.login || 'Support' };
  }
  return null;
}

async function findAccessibleTicket(req, participant) {
  const where = { id: req.params.id };
  if (participant.role === 'user') where.userId = participant.id;
  return db.ticket.findOne({ where });
}

function publicMessage(message) {
  return {
    id: message.id,
    ticketId: message.ticketId,
    content: message.content,
    senderRole: message.senderRole,
    senderName: message.senderName,
    createdAt: message.createdAt,
    userReadAt: message.userReadAt,
    adminReadAt: message.adminReadAt,
  };
}

async function unreadTicketIds(role, userId) {
  const where = role === 'user'
    ? { senderRole: 'superadmin', userReadAt: null }
    : { senderRole: 'user', adminReadAt: null };
  if (role === 'user') {
    const tickets = await db.ticket.findAll({ where: { userId }, attributes: ['id'] });
    where.ticketId = { [Op.in]: tickets.map((ticket) => ticket.id) };
  }
  const rows = await db.ticketMessage.findAll({ where, attributes: ['ticketId'], group: ['ticketId'], raw: true });
  return rows.map((row) => Number(row.ticketId));
}

route.get('/ticket-chat/unread', async (req, res) => {
  try {
    const participant = await getParticipant(req);
    if (!participant) return res.status(401).json({ error: 'Authentification requise' });
    const ticketIds = await unreadTicketIds(participant.role, participant.id);
    res.json({ ticketIds, count: ticketIds.length });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger les messages non lus' });
  }
});

route.get('/tickets/:id/messages', async (req, res) => {
  try {
    const participant = await getParticipant(req);
    if (!participant) return res.status(401).json({ error: 'Authentification requise' });
    const ticket = await findAccessibleTicket(req, participant);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
    const messages = await db.ticketMessage.findAll({ where: { ticketId: ticket.id }, order: [['createdAt', 'ASC'], ['id', 'ASC']] });
    res.json({ content: messages.map(publicMessage) });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de charger la conversation' });
  }
});

route.post('/tickets/:id/messages/read', async (req, res) => {
  try {
    const participant = await getParticipant(req);
    if (!participant) return res.status(401).json({ error: 'Authentification requise' });
    const ticket = await findAccessibleTicket(req, participant);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
    const readField = participant.role === 'user' ? 'userReadAt' : 'adminReadAt';
    const senderRole = participant.role === 'user' ? 'superadmin' : 'user';
    const [updated] = await db.ticketMessage.update({ [readField]: new Date() }, {
      where: { ticketId: ticket.id, senderRole, [readField]: null },
    });
    if (updated && io) {
      io.to(`user:${ticket.userId}`).emit('ticket:read', { ticketId: ticket.id });
      io.to('superadmins').emit('ticket:read', { ticketId: ticket.id });
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Impossible de marquer la conversation comme lue' });
  }
});

route.post('/tickets/:id/messages', async (req, res) => {
  try {
    const participant = await getParticipant(req);
    if (!participant) return res.status(401).json({ error: 'Authentification requise' });
    const ticket = await findAccessibleTicket(req, participant);
    if (!ticket) return res.status(404).json({ error: 'Ticket non trouvé' });
    if (!['open', 'in_progress'].includes(ticket.status)) {
      return res.status(409).json({ error: 'La conversation est fermée avec ce ticket' });
    }
    const content = typeof req.body.content === 'string' ? req.body.content.trim() : '';
    if (!content) return res.status(400).json({ error: 'Le message est obligatoire' });
    if (content.length > 4000) return res.status(400).json({ error: 'Le message ne peut pas dépasser 4000 caractères' });

    const message = await db.ticketMessage.create({
      ticketId: ticket.id,
      content,
      senderRole: participant.role,
      senderName: participant.name,
      userId: participant.role === 'user' ? participant.id : null,
      superAdminId: participant.role === 'superadmin' ? participant.id : null,
      userReadAt: participant.role === 'user' ? new Date() : null,
      adminReadAt: participant.role === 'superadmin' ? new Date() : null,
    });
    const result = publicMessage(message);
    if (io) {
      io.to(`ticket:${ticket.id}`).emit('ticket:message', result);
      io.to(participant.role === 'user' ? 'superadmins' : `user:${ticket.userId}`).emit('ticket:message', result);
    }
    res.status(201).json(result);
  } catch (error) {
    res.status(500).json({ error: 'Impossible d’envoyer le message' });
  }
});

route.setSocketServer = (socketServer) => { io = socketServer; };
route.getParticipant = getParticipant;
route.findAccessibleTicket = findAccessibleTicket;
module.exports = route;
