'use strict';

const express = require('express');
const { Op } = require('sequelize');
const { validate, z, idParam, pageQuery } = require('../middleware/validate');
const { requireRole, blockIfPasswordChangeRequired } = require('../middleware/auth');
const { News, NewsView, NewsBookmark } = require('../models');
const { newsIncludes, serializeNews, visibleToUserWhere } = require('../services/newsService');
const { paginate, pageResult, likeTerm, startOfToday } = require('../utils/helpers');
const { notFound } = require('../utils/errors');

/**
 * Student feed. The audience is always derived from the authenticated
 * student (never from a userId parameter).
 */
const router = express.Router();
router.use(requireRole('user'), blockIfPasswordChangeRequired);

/** Adds the student's `seen` / `bookmarked` flags to serialized news. */
async function withStudentFlags(userId, newsList) {
  const ids = newsList.map((news) => news.id);
  if (!ids.length) return [];
  const [views, bookmarks] = await Promise.all([
    NewsView.findAll({ where: { userId, newsId: ids }, attributes: ['newsId'], raw: true }),
    NewsBookmark.findAll({ where: { userId, newsId: ids }, attributes: ['newsId'], raw: true }),
  ]);
  const seen = new Set(views.map((row) => row.newsId));
  const saved = new Set(bookmarks.map((row) => row.newsId));
  return newsList.map((news) => ({ ...serializeNews(news), seen: seen.has(news.id), bookmarked: saved.has(news.id) }));
}

/** GET /api/v1/feed?q=&filter=all|events|pinned|media&since=&page=&pageSize= */
router.get('/', validate({
  query: z.object({
    ...pageQuery,
    pageSize: z.coerce.number().int().min(1).max(50).default(10),
    q: z.string().trim().max(100).optional(),
    filter: z.enum(['all', 'events', 'pinned', 'documents', 'bookmarks', 'unseen']).default('all'),
  }),
}), async (req, res) => {
  const { q, filter } = req.valid.query;
  const extra = {};
  if (q) extra[Op.or] = [{ titre: { [Op.like]: likeTerm(q) } }, { description: { [Op.like]: likeTerm(q) } }];
  if (filter === 'events') extra.eventStart = { [Op.ne]: null };
  if (filter === 'pinned') extra.pinned = true;
  if (filter === 'bookmarks') {
    extra.id = { [Op.in]: News.sequelize.literal(`(SELECT newsId FROM newsBookmarks WHERE userId = ${Number(req.auth.id)})`) };
  }
  if (filter === 'unseen') {
    extra.id = { [Op.notIn]: News.sequelize.literal(`(SELECT newsId FROM newsViews WHERE userId = ${Number(req.auth.id)})`) };
  }
  if (filter === 'documents') {
    extra.id = { [Op.in]: News.sequelize.literal('(SELECT newsId FROM newsMedia WHERE kind = \'document\')') };
  }
  const result = await News.findAndCountAll({
    where: visibleToUserWhere(req.auth.account, extra),
    include: newsIncludes,
    distinct: true,
    order: [['pinned', 'DESC'], [News.sequelize.fn('COALESCE', News.sequelize.col('publishAt'), News.sequelize.col('news.createdAt')), 'DESC'], ['id', 'DESC']],
    ...paginate(req.valid.query),
  });
  res.json(pageResult({ rows: await withStudentFlags(req.auth.id, result.rows), count: result.count }, req.valid.query));
});

/** GET /api/v1/feed/unseen-count — "new since your last visit" badge. */
router.get('/unseen-count', async (req, res) => {
  const count = await News.count({
    where: visibleToUserWhere(req.auth.account, {
      id: { [Op.notIn]: News.sequelize.literal(`(SELECT newsId FROM newsViews WHERE userId = ${Number(req.auth.id)})`) },
    }),
  });
  res.json({ count });
});

/** POST /api/v1/feed/seen { ids } — marks news as seen (scrolled past / opened). */
router.post('/seen', validate({ body: z.object({ ids: z.array(z.coerce.number().int().positive()).min(1).max(100) }) }), async (req, res) => {
  const visible = await News.findAll({ where: visibleToUserWhere(req.auth.account, { id: req.valid.body.ids }), attributes: ['id'], raw: true });
  if (visible.length) {
    await NewsView.bulkCreate(visible.map((news) => ({ newsId: news.id, userId: req.auth.id, viewedAt: new Date() })), { ignoreDuplicates: true });
  }
  res.status(204).end();
});

async function assertVisible(req) {
  const news = await News.findOne({ where: visibleToUserWhere(req.auth.account, { id: req.valid.params.id }), attributes: ['id'] });
  if (!news) throw notFound('Actualité introuvable');
}

router.put('/:id/bookmark', validate({ params: idParam }), async (req, res) => {
  await assertVisible(req);
  await NewsBookmark.findOrCreate({ where: { newsId: req.valid.params.id, userId: req.auth.id } });
  res.status(204).end();
});

router.delete('/:id/bookmark', validate({ params: idParam }), async (req, res) => {
  await NewsBookmark.destroy({ where: { newsId: req.valid.params.id, userId: req.auth.id } });
  res.status(204).end();
});

/**
 * GET /api/v1/feed/events?from=&to= — events that are not finished yet
 * (default: from the start of today in the university's time zone).
 */
router.get('/events', validate({
  query: z.object({
    from: z.coerce.date().optional(),
    to: z.coerce.date().optional(),
    limit: z.coerce.number().int().min(1).max(200).default(100),
  }),
}), async (req, res) => {
  const from = req.valid.query.from || startOfToday();
  const range = {
    eventStart: { [Op.ne]: null, ...(req.valid.query.to ? { [Op.lte]: req.valid.query.to } : {}) },
    // Still running or upcoming: end (or start when no end) after `from`.
    [Op.or]: [{ eventEnd: { [Op.gte]: from } }, { eventEnd: null, eventStart: { [Op.gte]: from } }],
  };
  const events = await News.findAll({
    where: visibleToUserWhere(req.auth.account, range),
    include: newsIncludes,
    order: [['eventStart', 'ASC']],
    limit: req.valid.query.limit,
  });
  res.json(await withStudentFlags(req.auth.id, events));
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const news = await News.findOne({ where: visibleToUserWhere(req.auth.account, { id: req.valid.params.id }), include: newsIncludes });
  if (!news) throw notFound('Actualité introuvable');
  // Opening an article marks it as seen.
  await NewsView.findOrCreate({ where: { newsId: news.id, userId: req.auth.id }, defaults: { viewedAt: new Date() } });
  res.json((await withStudentFlags(req.auth.id, [news]))[0]);
});

module.exports = router;
