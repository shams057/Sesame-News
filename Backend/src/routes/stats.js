'use strict';

const express = require('express');
const { validate, z } = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { PERIODS, ticketStatistics, ticketsCsv } = require('../services/statsService');
const { staffScope } = require('../services/ticketService');

const router = express.Router();
router.use(requireRole('superadmin'));

const query = z.object({
  period: z.enum(Object.keys(PERIODS)).default('month'),
  departmentId: z.coerce.number().int().positive().optional(),
});

/** GET /api/v1/stats/periods — labels for the period picker. */
router.get('/periods', (req, res) => {
  res.json(Object.entries(PERIODS).map(([key, label]) => ({ key, label })));
});

/** GET /api/v1/stats/tickets?period=&departmentId= */
router.get('/tickets', validate({ query }), async (req, res) => {
  res.json(await ticketStatistics({ ...req.valid.query, scope: staffScope(req.auth.account) }));
});

/** GET /api/v1/stats/tickets.csv?period=&departmentId= — one row per ticket. */
router.get('/tickets.csv', validate({ query }), async (req, res) => {
  const csv = await ticketsCsv({ ...req.valid.query, scope: staffScope(req.auth.account) });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.attachment(`tickets_${req.valid.query.period}_${new Date().toISOString().slice(0, 10)}.csv`);
  res.send(csv);
});

module.exports = router;
