'use strict';

const { QueryTypes } = require('sequelize');
const { sequelize, Ticket, TicketMessage, TicketRead, Department, User, SuperAdmin } = require('../models');
const realtime = require('./realtime');
const push = require('./pushService');
const { notFound } = require('../utils/errors');

const STATUS_LABELS = { open: 'Ouvert', in_progress: 'En cours', closed: 'Fermé' };
const PRIORITY_LABELS = { low: 'Basse', normal: 'Normale', high: 'Haute', urgent: 'Urgente' };

const ticketIncludes = [
  { model: Department, as: 'department', attributes: ['id', 'name'] },
  { model: User, as: 'user', attributes: ['id', 'firstname', 'lastname', 'login'] },
  { model: SuperAdmin, as: 'assignedTo', attributes: ['id', 'login', 'displayName'] },
];

/** Restricts staff restricted to a department to that department's tickets. */
function staffScope(admin) {
  return admin.departmentId ? { departmentId: admin.departmentId } : {};
}

async function findTicketFor(auth, ticketId) {
  const where = { id: ticketId };
  if (auth.role === 'user') where.userId = auth.id;
  else Object.assign(where, staffScope(auth.account));
  const ticket = await Ticket.findOne({ where, include: ticketIncludes });
  if (!ticket) throw notFound('Ticket introuvable');
  return ticket;
}

function serializeTicket(ticket, { unreadCount = 0, forUser = false } = {}) {
  const json = ticket.toJSON ? ticket.toJSON() : ticket;
  const base = {
    id: json.id,
    title: json.title,
    description: json.description,
    status: json.status,
    priority: json.priority,
    department: json.department ? { id: json.department.id, name: json.department.name } : null,
    firstResponseAt: json.firstResponseAt,
    closedAt: json.closedAt,
    rating: json.rating,
    ratingComment: json.ratingComment,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    unreadCount,
  };
  if (forUser) return base;
  return {
    ...base,
    user: json.user ? { id: json.user.id, name: `${json.user.firstname} ${json.user.lastname}`.trim(), login: json.user.login } : null,
    assignedTo: json.assignedTo ? { id: json.assignedTo.id, name: json.assignedTo.displayName || json.assignedTo.login } : null,
  };
}

function serializeMessage(message) {
  const json = message.toJSON ? message.toJSON() : message;
  return {
    id: json.id,
    ticketId: json.ticketId,
    content: json.content,
    senderRole: json.senderRole,
    senderName: json.senderName,
    isInternal: json.isInternal,
    createdAt: json.createdAt,
    userReadAt: json.userReadAt,
    attachment: json.attachmentPath
      ? { name: json.attachmentName, mimeType: json.attachmentMime, url: `/api/v1/tickets/${json.ticketId}/messages/${json.id}/attachment` }
      : null,
  };
}

/** Map ticketId → unread count for a student. */
async function userUnreadCounts(userId, ticketIds) {
  if (ticketIds && !ticketIds.length) return new Map();
  const rows = await sequelize.query(`
    SELECT m.ticketId, COUNT(*) AS unread
    FROM ticketMessages m JOIN tickets t ON t.id = m.ticketId
    WHERE t.userId = :userId AND m.senderRole <> 'user' AND m.isInternal = 0 AND m.userReadAt IS NULL
      ${ticketIds ? 'AND m.ticketId IN (:ticketIds)' : ''}
    GROUP BY m.ticketId`, { replacements: { userId, ticketIds }, type: QueryTypes.SELECT });
  return new Map(rows.map((row) => [Number(row.ticketId), Number(row.unread)]));
}

/** Map ticketId → unread count for one staff member (own read cursor). */
async function staffUnreadCounts(admin, ticketIds) {
  if (ticketIds && !ticketIds.length) return new Map();
  const rows = await sequelize.query(`
    SELECT m.ticketId, COUNT(*) AS unread
    FROM ticketMessages m
    JOIN tickets t ON t.id = m.ticketId
    LEFT JOIN ticketReads r ON r.ticketId = m.ticketId AND r.superAdminId = :adminId
    WHERE m.senderRole = 'user' AND m.id > COALESCE(r.lastReadMessageId, 0)
      ${admin.departmentId ? 'AND t.departmentId = :departmentId' : ''}
      ${ticketIds ? 'AND m.ticketId IN (:ticketIds)' : ''}
    GROUP BY m.ticketId`, {
    replacements: { adminId: admin.id, departmentId: admin.departmentId, ticketIds },
    type: QueryTypes.SELECT,
  });
  return new Map(rows.map((row) => [Number(row.ticketId), Number(row.unread)]));
}

async function markRead(auth, ticket) {
  if (auth.role === 'user') {
    await TicketMessage.update({ userReadAt: new Date() }, {
      where: { ticketId: ticket.id, userReadAt: null, isInternal: false, senderRole: ['superadmin', 'system'] },
    });
    realtime.toUser(ticket.userId, 'ticket:read', { ticketId: ticket.id });
  } else {
    const lastId = (await TicketMessage.max('id', { where: { ticketId: ticket.id } })) || 0;
    await TicketRead.upsert({ ticketId: ticket.id, superAdminId: auth.id, lastReadMessageId: lastId });
  }
}

function emitTicketUpdated(ticket) {
  const payload = serializeTicket(ticket);
  realtime.toStaff(ticket.departmentId, 'ticket:updated', payload);
  realtime.toUser(ticket.userId, 'ticket:updated', serializeTicket(ticket, { forUser: true }));
}

/** Creates a message, updates ticket lifecycle fields, notifies everyone concerned. */
async function postMessage(auth, ticket, { content, isInternal = false, file }) {
  const staff = auth.role === 'superadmin';
  const message = await TicketMessage.create({
    ticketId: ticket.id,
    content,
    senderRole: staff ? 'superadmin' : 'user',
    senderName: auth.name,
    userId: staff ? null : auth.id,
    superAdminId: staff ? auth.id : null,
    isInternal: staff && isInternal,
    userReadAt: staff ? null : new Date(),
    attachmentPath: file ? file.filename : null,
    attachmentName: file ? file.safeName : null,
    attachmentMime: file ? file.mimetype : null,
  });

  if (staff && !message.isInternal) {
    const updates = {};
    if (!ticket.firstResponseAt) updates.firstResponseAt = message.createdAt;
    if (ticket.status === 'open') updates.status = 'in_progress';
    if (!ticket.assignedToId) updates.assignedToId = auth.id;
    if (Object.keys(updates).length) {
      await ticket.update(updates);
      await ticket.reload({ include: ticketIncludes });
      emitTicketUpdated(ticket);
    }
  }
  if (staff) await markRead(auth, ticket);

  const payload = serializeMessage(message);
  realtime.toStaff(ticket.departmentId, 'ticket:message', payload);
  if (!message.isInternal) realtime.toUser(ticket.userId, 'ticket:message', payload);

  if (staff && !message.isInternal && ticket.userId) {
    await push.sendToUsers([ticket.userId], {
      title: `Réponse à votre ticket #${ticket.id}`,
      body: content,
      data: { type: 'ticket', ticketId: ticket.id },
    });
  }
  return payload;
}

/** Records a visible system line in the conversation (status changes…). */
async function addSystemMessage(ticket, content) {
  const message = await TicketMessage.create({
    ticketId: ticket.id, content, senderRole: 'system', senderName: 'Système', isInternal: false,
  });
  const payload = serializeMessage(message);
  realtime.toStaff(ticket.departmentId, 'ticket:message', payload);
  realtime.toUser(ticket.userId, 'ticket:message', payload);
  return payload;
}

async function applyStatusChange(ticket, status, actorLabel) {
  if (ticket.status === status) return;
  await ticket.update({ status, closedAt: status === 'closed' ? new Date() : null });
  await addSystemMessage(ticket, `${actorLabel} a changé le statut : ${STATUS_LABELS[status]}`);
  if (ticket.userId && actorLabel !== 'L’étudiant') {
    await push.sendToUsers([ticket.userId], {
      title: `Ticket #${ticket.id} : ${STATUS_LABELS[status]}`,
      body: ticket.title,
      data: { type: 'ticket', ticketId: ticket.id },
    });
  }
}

module.exports = {
  STATUS_LABELS,
  PRIORITY_LABELS,
  ticketIncludes,
  staffScope,
  findTicketFor,
  serializeTicket,
  serializeMessage,
  userUnreadCounts,
  staffUnreadCounts,
  markRead,
  emitTicketUpdated,
  postMessage,
  addSystemMessage,
  applyStatusChange,
};
