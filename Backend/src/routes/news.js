'use strict';

const express = require('express');
const { Op, fn, col } = require('sequelize');
const { validate, z, idParam, pageQuery, boolish, optionalDate } = require('../middleware/validate');
const { requireRole } = require('../middleware/auth');
const { newsMediaUpload, removeStoredFile } = require('../middleware/upload');
const { sequelize, News, NewsMedia, NewsView, Categorie } = require('../models');
const { newsIncludes, serializeNews, notifyIfDue } = require('../services/newsService');
const { paginate, pageResult, likeTerm } = require('../utils/helpers');
const { notFound, badRequest } = require('../utils/errors');

const router = express.Router();
router.use(requireRole('superadmin'));

// Department admins can read news but only the super admin can publish,
// edit or delete them.
const ownerOnly = requireRole('superadmin', { owner: true });

/** Multipart forms send arrays as JSON strings or repeated fields. */
const idList = z.union([z.array(z.coerce.number().int().positive()), z.string()]).optional().transform((value, ctx) => {
  if (value === undefined) return undefined;
  if (Array.isArray(value)) return value;
  if (value.trim() === '') return [];
  try {
    const parsed = value.trim().startsWith('[') ? JSON.parse(value) : value.split(',');
    return parsed.map(Number).filter((n) => Number.isInteger(n) && n > 0);
  } catch {
    ctx.addIssue({ code: 'custom', message: 'Liste invalide' });
    return z.NEVER;
  }
});

const newsBody = z.object({
  titre: z.string().trim().min(1, 'Titre obligatoire').max(200),
  description: z.string().trim().min(1, 'Description obligatoire').max(20000),
  status: z.enum(['draft', 'published']).default('published'),
  publishAt: optionalDate,
  pinned: boolish.optional(),
  audienceAll: boolish.default(true),
  categoryIds: idList,
  eventStart: optionalDate,
  eventEnd: optionalDate,
  location: z.string().trim().max(200).optional().transform((value) => (value === '' ? null : value)),
  expiresAt: optionalDate,
  removeMediaIds: idList,
});

function checkConsistency(data, existing = {}) {
  const merged = { ...existing, ...data };
  if (merged.audienceAll === false && !(data.categoryIds ?? existing.categoryIds ?? []).length) {
    throw badRequest('Choisissez au moins une catégorie ou rendez l’actualité visible par tous');
  }
  if (merged.eventStart && merged.eventEnd && merged.eventEnd < merged.eventStart) {
    throw badRequest('La fin de l’événement doit être après le début');
  }
  if (merged.eventEnd && !merged.eventStart) throw badRequest('Indiquez la date de début de l’événement');
  if (merged.expiresAt && merged.publishAt && merged.expiresAt <= merged.publishAt) throw badRequest('L’expiration doit être après la publication');
}

async function assertCategoriesExist(ids) {
  if (!ids?.length) return;
  const count = await Categorie.count({ where: { id: ids } });
  if (count !== new Set(ids).size) throw badRequest('Catégorie inconnue');
}

async function cleanupUploaded(req) {
  await Promise.all((req.files || []).map((file) => removeStoredFile(file.filename)));
}

/** GET /api/v1/news?q=&status=draft|published|scheduled&categorieId=&page=&pageSize= */
router.get('/', validate({
  query: z.object({
    ...pageQuery,
    q: z.string().trim().max(100).optional(),
    status: z.enum(['draft', 'published', 'scheduled', 'expired']).optional(),
    categorieId: z.coerce.number().int().positive().optional(),
  }),
}), async (req, res) => {
  const { q, status, categorieId } = req.valid.query;
  const now = new Date();
  const where = {};
  if (q) where[Op.or] = [{ titre: { [Op.like]: likeTerm(q) } }, { description: { [Op.like]: likeTerm(q) } }];
  if (status === 'draft') where.status = 'draft';
  if (status === 'published') Object.assign(where, { status: 'published', [Op.and]: [{ [Op.or]: [{ publishAt: null }, { publishAt: { [Op.lte]: now } }] }] });
  if (status === 'scheduled') Object.assign(where, { status: 'published', publishAt: { [Op.gt]: now } });
  if (status === 'expired') where.expiresAt = { [Op.lte]: now };
  if (status === 'published') where[Op.and].push({ [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] });
  if (categorieId) where.id = { [Op.in]: sequelize.literal(`(SELECT newsId FROM newsCategories WHERE categorieId = ${categorieId})`) };

  const result = await News.findAndCountAll({
    where,
    include: newsIncludes,
    distinct: true,
    order: [['pinned', 'DESC'], ['createdAt', 'DESC']],
    ...paginate(req.valid.query),
  });
  const ids = result.rows.map((news) => news.id);
  const views = ids.length ? await NewsView.findAll({
    where: { newsId: ids }, attributes: ['newsId', [fn('COUNT', col('userId')), 'count']], group: ['newsId'], raw: true,
  }) : [];
  const viewCount = new Map(views.map((row) => [row.newsId, Number(row.count)]));
  res.json(pageResult({ rows: result.rows.map((news) => ({ ...serializeNews(news), viewCount: viewCount.get(news.id) || 0 })), count: result.count }, req.valid.query));
});

router.get('/:id', validate({ params: idParam }), async (req, res) => {
  const news = await News.findByPk(req.valid.params.id, { include: newsIncludes });
  if (!news) throw notFound('Actualité introuvable');
  res.json(serializeNews(news));
});

async function addMedia(newsId, files, startPosition, transaction) {
  if (!files?.length) return;
  await NewsMedia.bulkCreate(files.map((file, index) => ({
    newsId,
    path: file.filename,
    originalName: file.safeName,
    mimeType: file.mimetype,
    size: file.size,
    kind: file.kind,
    position: startPosition + index,
  })), { transaction });
}

/** POST /api/v1/news — multipart; attachments in the `files` field (max 10). */
router.post('/', ownerOnly, newsMediaUpload.array('files', 10), async (req, res) => {
  try {
    const { removeMediaIds: _ignored, categoryIds = [], ...data } = newsBody.parse(req.body ?? {});
    checkConsistency({ ...data, categoryIds });
    await assertCategoriesExist(categoryIds);
    const news = await sequelize.transaction(async (transaction) => {
      const created = await News.create({ ...data, superAdminId: req.auth.id }, { transaction });
      if (!data.audienceAll) await created.setCategories(categoryIds, { transaction });
      await addMedia(created.id, req.files, 0, transaction);
      return created;
    });
    await notifyIfDue(news.id);
    res.status(201).json(serializeNews(await News.findByPk(news.id, { include: newsIncludes })));
  } catch (error) {
    await cleanupUploaded(req);
    throw error;
  }
});

/**
 * PATCH /api/v1/news/:id — multipart; new files are appended, ids listed
 * in `removeMediaIds` are deleted (from the database and the disk).
 */
router.patch('/:id', ownerOnly, newsMediaUpload.array('files', 10), async (req, res) => {
  let removed = [];
  try {
    const { id } = idParam.parse(req.params);
    const news = await News.findByPk(id, { include: newsIncludes });
    if (!news) throw notFound('Actualité introuvable');
    const { removeMediaIds = [], categoryIds, ...data } = newsBody.partial().parse(req.body ?? {});
    const existingCategoryIds = news.categories.map((category) => category.id);
    checkConsistency({ ...data, categoryIds }, { ...news.get({ plain: true }), categoryIds: existingCategoryIds });
    await assertCategoriesExist(categoryIds);

    await sequelize.transaction(async (transaction) => {
      await news.update(data, { transaction });
      const audienceAll = data.audienceAll ?? news.audienceAll;
      if (audienceAll) await news.setCategories([], { transaction });
      else if (categoryIds) await news.setCategories(categoryIds, { transaction });
      if (removeMediaIds.length) {
        removed = await NewsMedia.findAll({ where: { id: removeMediaIds, newsId: news.id }, transaction });
        await NewsMedia.destroy({ where: { id: removed.map((media) => media.id) }, transaction });
      }
      const maxPosition = (await NewsMedia.max('position', { where: { newsId: news.id }, transaction })) ?? -1;
      await addMedia(news.id, req.files, maxPosition + 1, transaction);
    });
    await Promise.all(removed.map((media) => removeStoredFile(media.path)));
    await notifyIfDue(news.id);
    res.json(serializeNews(await News.findByPk(news.id, { include: newsIncludes })));
  } catch (error) {
    await cleanupUploaded(req);
    throw error;
  }
});

router.delete('/:id', ownerOnly, validate({ params: idParam }), async (req, res) => {
  const news = await News.findByPk(req.valid.params.id, { include: [{ model: NewsMedia, as: 'media' }] });
  if (!news) throw notFound('Actualité introuvable');
  const files = news.media.map((media) => media.path);
  await news.destroy();
  await Promise.all(files.map((file) => removeStoredFile(file)));
  res.status(204).end();
});

module.exports = router;
