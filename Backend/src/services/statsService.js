'use strict';

const { Op, QueryTypes } = require('sequelize');
const { sequelize, Ticket, Department, SuperAdmin, User } = require('../models');
const { localDayKey, zonedMidnight, zonedParts } = require('../utils/helpers');
const env = require('../config/env');

const PERIODS = {
  today: 'Aujourd’hui',
  '7days': '7 derniers jours',
  '30days': '30 derniers jours',
  month: 'Ce mois-ci',
  semester: 'Semestre universitaire en cours',
  year: 'Année universitaire en cours',
};

/** Start of the period, computed in the application time zone. */
function periodStart(period, now = new Date()) {
  const { year, monthIndex, day } = zonedParts(now);
  switch (period) {
    case 'today': return zonedMidnight(year, monthIndex, day);
    case '7days': return zonedMidnight(year, monthIndex, day - 6);
    case '30days': return zonedMidnight(year, monthIndex, day - 29);
    case 'month': return zonedMidnight(year, monthIndex, 1);
    // Academic calendar: S1 = September → January, S2 = February → August.
    case 'semester':
      if (monthIndex >= 8) return zonedMidnight(year, 8, 1);
      if (monthIndex === 0) return zonedMidnight(year - 1, 8, 1);
      return zonedMidnight(year, 1, 1);
    case 'year': return zonedMidnight(monthIndex >= 8 ? year : year - 1, 8, 1);
    default: return zonedMidnight(year, monthIndex, 1);
  }
}

const hours = (ms) => Math.round((ms / 3600000) * 10) / 10;

function summarize(durationsMs) {
  if (!durationsMs.length) return { averageHours: null, medianHours: null };
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  return { averageHours: hours(sorted.reduce((sum, value) => sum + value, 0) / sorted.length), medianHours: hours(median) };
}

function monthKey(date) {
  return localDayKey(date).slice(0, 7);
}

/**
 * @param {object} options { period, departmentId, scope } — scope is the
 *   staff restriction (department of a restricted agent).
 */
async function ticketStatistics({ period = 'month', departmentId, scope = {} }) {
  const now = new Date();
  const start = periodStart(period, now);
  const baseWhere = { ...scope, ...(departmentId ? { departmentId } : {}) };
  if (scope.departmentId && departmentId && scope.departmentId !== departmentId) {
    baseWhere.departmentId = -1; // restricted agent asking for another department → empty
  }
  const createdWhere = { ...baseWhere, createdAt: { [Op.gte]: start, [Op.lte]: now } };
  const closedWhere = { ...baseWhere, closedAt: { [Op.gte]: start, [Op.lte]: now } };

  const [created, closedInPeriod, backlog, oldestOpen] = await Promise.all([
    Ticket.findAll({
      where: createdWhere,
      attributes: ['id', 'status', 'priority', 'departmentId', 'createdAt', 'firstResponseAt'],
      raw: true,
    }),
    Ticket.findAll({
      where: closedWhere,
      attributes: ['id', 'departmentId', 'assignedToId', 'createdAt', 'closedAt', 'rating'],
      raw: true,
    }),
    Ticket.count({ where: { ...baseWhere, status: { [Op.ne]: 'closed' } } }),
    Ticket.min('createdAt', { where: { ...baseWhere, status: { [Op.ne]: 'closed' } } }),
  ]);

  const byStatus = { open: 0, in_progress: 0, closed: 0 };
  created.forEach((ticket) => { byStatus[ticket.status] += 1; });

  const resolutionMs = closedInPeriod.map((ticket) => new Date(ticket.closedAt) - new Date(ticket.createdAt));
  const firstResponseMs = created
    .filter((ticket) => ticket.firstResponseAt)
    .map((ticket) => new Date(ticket.firstResponseAt) - new Date(ticket.createdAt));
  const ratings = closedInPeriod.map((ticket) => ticket.rating).filter((rating) => rating);

  // Departments
  const departments = await Department.findAll({ attributes: ['id', 'name'], raw: true });
  const departmentName = new Map(departments.map((department) => [department.id, department.name]));
  const deptStats = new Map();
  const deptRow = (id) => {
    if (!deptStats.has(id)) {
      deptStats.set(id, { departmentId: id, department: departmentName.get(id) || 'Inconnu', created: 0, open: 0, inProgress: 0, closed: 0, closedInPeriod: 0, resolutionMs: [] });
    }
    return deptStats.get(id);
  };
  created.forEach((ticket) => {
    const row = deptRow(ticket.departmentId);
    row.created += 1;
    if (ticket.status === 'open') row.open += 1;
    else if (ticket.status === 'in_progress') row.inProgress += 1;
    else row.closed += 1;
  });
  closedInPeriod.forEach((ticket) => {
    const row = deptRow(ticket.departmentId);
    row.closedInPeriod += 1;
    row.resolutionMs.push(new Date(ticket.closedAt) - new Date(ticket.createdAt));
  });

  // Agents (tickets they resolved in the period)
  const agentIds = [...new Set(closedInPeriod.map((ticket) => ticket.assignedToId).filter(Boolean))];
  const agents = agentIds.length
    ? await SuperAdmin.findAll({ where: { id: agentIds }, attributes: ['id', 'login', 'displayName'], raw: true })
    : [];
  const agentName = new Map(agents.map((agent) => [agent.id, agent.displayName || agent.login]));
  const agentStats = new Map();
  closedInPeriod.forEach((ticket) => {
    const key = ticket.assignedToId || 0;
    if (!agentStats.has(key)) agentStats.set(key, { agentId: key || null, agent: key ? agentName.get(key) || `#${key}` : 'Non assigné', closed: 0, resolutionMs: [] });
    const row = agentStats.get(key);
    row.closed += 1;
    row.resolutionMs.push(new Date(ticket.closedAt) - new Date(ticket.createdAt));
  });

  // Timeline in local days (≤ 31 days) or local months (longer periods)
  const daily = now - start <= 31 * 24 * 3600 * 1000;
  const keyOf = daily ? localDayKey : monthKey;
  const buckets = new Map();
  for (let cursor = new Date(start); cursor <= now; cursor = new Date(cursor.getTime() + (daily ? 24 : 24 * 28) * 3600 * 1000)) {
    buckets.set(keyOf(cursor), { key: keyOf(cursor), created: 0, closed: 0 });
  }
  buckets.set(keyOf(now), buckets.get(keyOf(now)) || { key: keyOf(now), created: 0, closed: 0 });
  created.forEach((ticket) => { const bucket = buckets.get(keyOf(new Date(ticket.createdAt))); if (bucket) bucket.created += 1; });
  closedInPeriod.forEach((ticket) => { const bucket = buckets.get(keyOf(new Date(ticket.closedAt))); if (bucket) bucket.closed += 1; });

  const priorities = ['urgent', 'high', 'normal', 'low'].map((priority) => ({
    priority,
    count: created.filter((ticket) => ticket.priority === priority).length,
  }));

  const recent = await Ticket.findAll({
    where: createdWhere,
    include: [{ model: Department, as: 'department', attributes: ['id', 'name'] }],
    attributes: ['id', 'title', 'status', 'priority', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 8,
  });

  return {
    period,
    periodLabel: PERIODS[period],
    startDate: start,
    endDate: now,
    timeZone: env.APP_TIMEZONE,
    granularity: daily ? 'day' : 'month',
    created: { total: created.length, ...byStatus },
    closedInPeriod: closedInPeriod.length,
    resolvedShare: created.length ? Math.round((byStatus.closed / created.length) * 1000) / 10 : 0,
    backlog: { total: backlog, oldestCreatedAt: oldestOpen || null },
    resolutionTime: summarize(resolutionMs),
    firstResponseTime: summarize(firstResponseMs),
    satisfaction: {
      average: ratings.length ? Math.round((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length) * 10) / 10 : null,
      count: ratings.length,
    },
    departments: [...deptStats.values()]
      .map(({ resolutionMs: list, ...row }) => ({ ...row, averageResolutionHours: summarize(list).averageHours }))
      .sort((a, b) => b.created - a.created || b.closedInPeriod - a.closedInPeriod),
    agents: [...agentStats.values()]
      .map(({ resolutionMs: list, ...row }) => ({ ...row, averageResolutionHours: summarize(list).averageHours }))
      .sort((a, b) => b.closed - a.closed),
    priorities,
    timeline: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)),
    recent: recent.map((ticket) => ({
      id: ticket.id, title: ticket.title, status: ticket.status, priority: ticket.priority,
      department: ticket.department?.name || null, createdAt: ticket.createdAt,
    })),
  };
}

const csvCell = (value) => {
  if (value === null || value === undefined) return '';
  const text = value instanceof Date ? value.toISOString() : String(value);
  // Neutralise spreadsheet formulas and quote everything.
  const safe = /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
  return `"${safe.replace(/"/g, '""')}"`;
};

/** CSV of every ticket created in the period (one row per ticket). */
async function ticketsCsv({ period = 'month', departmentId, scope = {} }) {
  const start = periodStart(period);
  const where = { ...scope, ...(departmentId ? { departmentId } : {}), createdAt: { [Op.gte]: start } };
  const tickets = await Ticket.findAll({
    where,
    include: [
      { model: Department, as: 'department', attributes: ['name'] },
      { model: SuperAdmin, as: 'assignedTo', attributes: ['login', 'displayName'] },
      { model: User, as: 'user', attributes: ['login'] },
    ],
    order: [['createdAt', 'ASC']],
  });
  const header = ['id', 'titre', 'departement', 'statut', 'priorite', 'etudiant', 'assigne_a', 'cree_le', 'premiere_reponse', 'ferme_le', 'note'];
  const lines = tickets.map((ticket) => [
    ticket.id, ticket.title, ticket.department?.name, ticket.status, ticket.priority, ticket.user?.login,
    ticket.assignedTo ? ticket.assignedTo.displayName || ticket.assignedTo.login : '',
    ticket.createdAt, ticket.firstResponseAt, ticket.closedAt, ticket.rating,
  ].map(csvCell).join(','));
  return `\uFEFF${header.join(',')}\n${lines.join('\n')}\n`;
}

module.exports = { PERIODS, periodStart, ticketStatistics, ticketsCsv, sequelize, QueryTypes };
