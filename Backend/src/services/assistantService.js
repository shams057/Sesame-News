'use strict';

const { Op } = require('sequelize');
const env = require('../config/env');
const { News, Department } = require('../models');
const { visibleToUserWhere } = require('./newsService');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

const MAX_CONTEXT_NEWS = 5;
const REQUEST_TIMEOUT_MS = 30000;
const STOP_WORDS = new Set(('le la les un une des de du et ou en au aux pour par sur dans avec est sont que qui quoi '
  + 'quand comment je tu il elle nous vous ils elles mon ma mes ton ta tes son sa ses ce cette ces a à y ne pas plus '
  + 'the and for with what when how is are').split(' '));

function notConfigured() {
  return new AppError(503, 'L’assistant n’est pas encore configuré. Contactez l’administration.');
}

function keywords(text) {
  return [...new Set(text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !STOP_WORDS.has(word)))].slice(0, 8);
}

/**
 * Retrieval step of the RAG: news the student is allowed to see, ranked by
 * keyword overlap with the question.
 */
async function retrieveNews(user, question) {
  const words = keywords(question);
  if (!words.length) return [];
  const textMatch = { [Op.or]: words.flatMap((word) => [
    { titre: { [Op.like]: `%${word}%` } },
    { description: { [Op.like]: `%${word}%` } },
  ]) };
  const candidates = await News.findAll({
    where: visibleToUserWhere(user, textMatch),
    attributes: ['id', 'titre', 'description', 'eventStart', 'location', 'createdAt'],
    order: [['createdAt', 'DESC']],
    limit: 40,
  });
  const normalize = (value) => (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return candidates
    .map((news) => {
      const title = normalize(news.titre);
      const body = normalize(news.description);
      const score = words.reduce((sum, word) => sum + (title.includes(word) ? 3 : 0) + (body.includes(word) ? 1 : 0), 0);
      return { news, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, MAX_CONTEXT_NEWS)
    .map((entry) => entry.news);
}

function buildSystemPrompt(user, newsItems, departments) {
  const today = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full', timeZone: env.APP_TIMEZONE }).format(new Date());
  const context = newsItems.map((news, index) => [
    `[${index + 1}] ${news.titre}`,
    news.eventStart ? `Date de l’événement : ${news.eventStart.toISOString()}` : null,
    news.location ? `Lieu : ${news.location}` : null,
    news.description.slice(0, 1500),
  ].filter(Boolean).join('\n')).join('\n\n');

  return [
    'Tu es l’assistant officiel de l’Université SESAME. Tu réponds en français, de manière concise et factuelle.',
    `Nous sommes le ${today}. L’étudiant s’appelle ${user.firstname}.`,
    'Utilise UNIQUEMENT les informations ci-dessous. Si la réponse n’y figure pas, dis-le clairement et propose',
    'à l’étudiant d’ouvrir un ticket auprès du service concerné. Cite les sources sous la forme [1], [2].',
    'N’invente jamais de dates, de montants ou de procédures.',
    '',
    `Services disponibles pour les tickets : ${departments.join(', ')}.`,
    '',
    context ? `Actualités pertinentes :\n${context}` : 'Aucune actualité pertinente trouvée.',
  ].join('\n');
}

async function callApi(pathname, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${env.LLM_BASE_URL.replace(/\/$/, '')}${pathname}`, {
      ...init,
      headers: { Authorization: `Bearer ${env.LLM_API_KEY}`, ...init.headers },
      signal: controller.signal,
    });
    if (!response.ok) {
      logger.warn({ status: response.status, body: (await response.text()).slice(0, 500) }, 'LLM provider error');
      throw new AppError(502, 'L’assistant est momentanément indisponible. Réessayez plus tard.');
    }
    return response.json();
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.warn({ err: error }, 'LLM request failed');
    throw new AppError(502, 'L’assistant est momentanément indisponible. Réessayez plus tard.');
  } finally {
    clearTimeout(timer);
  }
}

/**
 * @param user     the authenticated student (model instance)
 * @param question the new question
 * @param history  previous turns [{ role, content }] (most recent last)
 * @returns { reply, sources: [{ type, id, title }] }
 */
async function answer(user, question, history = []) {
  if (!env.llmConfigured) throw notConfigured();

  const [newsItems, departments] = await Promise.all([
    retrieveNews(user, question),
    Department.findAll({ where: { isActive: true }, attributes: ['name'], order: [['name', 'ASC']], raw: true }),
  ]);

  const data = await callApi('/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: env.LLM_MODEL,
      temperature: 0.2,
      messages: [
        { role: 'system', content: buildSystemPrompt(user, newsItems, departments.map((department) => department.name)) },
        ...history.slice(-8).map((turn) => ({ role: turn.role, content: turn.content.slice(0, 2000) })),
        { role: 'user', content: question },
      ],
    }),
  });

  const reply = data?.choices?.[0]?.message?.content?.trim();
  if (!reply) throw new AppError(502, 'L’assistant n’a pas pu générer de réponse.');
  // Only return the sources the model actually cited.
  const sources = newsItems
    .map((news, index) => ({ type: 'news', id: news.id, title: news.titre, ref: index + 1 }))
    .filter((source) => reply.includes(`[${source.ref}]`));
  return { reply, sources };
}

module.exports = { answer, keywords, retrieveNews };
