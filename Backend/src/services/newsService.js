'use strict';

const { Op, literal } = require('sequelize');
const { sequelize, News, NewsMedia, Categorie, SuperAdmin, User } = require('../models');
const realtime = require('./realtime');
const push = require('./pushService');
const logger = require('../utils/logger');

const newsIncludes = [
  { model: Categorie, as: 'categories', attributes: ['id', 'libelle'], through: { attributes: [] } },
  { model: NewsMedia, as: 'media', separate: true, order: [['position', 'ASC'], ['id', 'ASC']] },
  { model: SuperAdmin, as: 'author', attributes: ['id', 'login', 'displayName'] },
];

/** Published and not scheduled in the future. */
function publishedNowCondition(now = new Date()) {
  return {
    status: 'published',
    [Op.and]: [
      { [Op.or]: [{ publishAt: null }, { publishAt: { [Op.lte]: now } }] },
      { [Op.or]: [{ expiresAt: null }, { expiresAt: { [Op.gt]: now } }] },
    ],
  };
}

/** Audience filter for a student: everyone, or one of the student's categories. */
function audienceCondition(user) {
  if (!user.categorieId) return { audienceAll: true };
  return {
    [Op.or]: [
      { audienceAll: true },
      { id: { [Op.in]: literal(`(SELECT newsId FROM newsCategories WHERE categorieId = ${Number(user.categorieId)})`) } },
    ],
  };
}

function visibleToUserWhere(user, extra = {}) {
  return { [Op.and]: [publishedNowCondition(), audienceCondition(user), extra] };
}

function serializeMedia(media) {
  return {
    id: media.id,
    url: `/uploads/${media.path}`,
    kind: media.kind,
    mimeType: media.mimeType,
    originalName: media.originalName,
    size: media.size,
  };
}

function serializeNews(news) {
  const json = news.toJSON ? news.toJSON() : news;
  return {
    id: json.id,
    titre: json.titre,
    description: json.description,
    status: json.status,
    publishAt: json.publishAt,
    pinned: json.pinned,
    audienceAll: json.audienceAll,
    eventStart: json.eventStart,
    eventEnd: json.eventEnd,
    location: json.location,
    expiresAt: json.expiresAt,
    createdAt: json.createdAt,
    updatedAt: json.updatedAt,
    author: json.author ? { id: json.author.id, name: json.author.displayName || json.author.login } : null,
    categories: (json.categories || []).map((category) => ({ id: category.id, libelle: category.libelle })),
    media: (json.media || []).map(serializeMedia),
  };
}

function isVisibleNow(news, now = new Date()) {
  return news.status === 'published' && (!news.publishAt || new Date(news.publishAt) <= now)
    && (!news.expiresAt || new Date(news.expiresAt) > now);
}

/**
 * Notifies students once a news item becomes visible (on creation, on
 * publication of a draft, or when its scheduled time arrives).
 */
async function notifyIfDue(newsId) {
  const news = await News.findByPk(newsId, { include: newsIncludes });
  if (!news || news.notifiedAt || !isVisibleNow(news)) return;

  // Atomic claim so two instances never notify twice.
  const [claimed] = await News.update({ notifiedAt: new Date() }, { where: { id: news.id, notifiedAt: null } });
  if (!claimed) return;

  const payload = serializeNews(news);
  const categoryIds = payload.categories.map((category) => category.id);
  const userWhere = { isActive: true, ...(news.audienceAll ? {} : { categorieId: { [Op.in]: categoryIds } }) };
  const users = await User.findAll({ where: userWhere, attributes: ['id'], raw: true });

  if (news.audienceAll) realtime.toAllUsers('news:published', { id: payload.id });
  else users.forEach((user) => realtime.toUser(user.id, 'news:published', { id: payload.id }));

  await push.sendToUsers(users.map((user) => user.id), {
    title: news.pinned ? `📌 ${news.titre}` : news.titre,
    body: news.description,
    data: { type: 'news', newsId: news.id },
  });
}

/** Called every minute: publishes notifications for scheduled news. */
async function processScheduledNews() {
  try {
    const due = await News.findAll({
      where: { ...publishedNowCondition(), notifiedAt: null },
      attributes: ['id'],
      limit: 50,
      raw: true,
    });
    for (const news of due) await notifyIfDue(news.id);
  } catch (error) {
    logger.warn({ err: error }, 'Scheduled news processing failed');
  }
}

module.exports = {
  newsIncludes,
  visibleToUserWhere,
  serializeNews,
  serializeMedia,
  notifyIfDue,
  processScheduledNews,
  sequelize,
};
