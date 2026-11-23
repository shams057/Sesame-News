'use strict';

const express = require('express');
const { validate, z } = require('../middleware/validate');
const { requireRole, blockIfPasswordChangeRequired } = require('../middleware/auth');
const { assistantLimiter } = require('../middleware/rateLimits');
const env = require('../config/env');
const { AssistantMessage } = require('../models');
const assistant = require('../services/assistantService');

const router = express.Router();
router.use(requireRole('user'), blockIfPasswordChangeRequired);

const HISTORY_LIMIT = 50;
const serialize = (message) => ({
  id: message.id, role: message.role, content: message.content, sources: message.sources || [], createdAt: message.createdAt,
});

/** GET /api/v1/assistant — availability + persisted history (latest 50). */
router.get('/', async (req, res) => {
  const messages = await AssistantMessage.findAll({
    where: { userId: req.auth.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: HISTORY_LIMIT,
  });
  res.json({
    available: env.llmConfigured,
    messages: messages.reverse().map(serialize),
  });
});

async function ask(req, question) {
  const history = (await AssistantMessage.findAll({
    where: { userId: req.auth.id }, order: [['createdAt', 'DESC'], ['id', 'DESC']], limit: 8,
  })).reverse().map((message) => ({ role: message.role, content: message.content }));
  const { reply, sources } = await assistant.answer(req.auth.account, question, history);
  const [userMessage, assistantMessage] = await AssistantMessage.bulkCreate([
    { userId: req.auth.id, role: 'user', content: question },
    { userId: req.auth.id, role: 'assistant', content: reply, sources },
  ]);
  return { question: serialize(userMessage), answer: serialize(assistantMessage) };
}

/** POST /api/v1/assistant/messages { message } */
router.post('/messages', assistantLimiter, validate({
  body: z.object({ message: z.string().trim().min(1, 'Le message est obligatoire').max(1000) }),
}), async (req, res) => {
  res.status(201).json(await ask(req, req.valid.body.message));
});

/** DELETE /api/v1/assistant/messages — clears the conversation. */
router.delete('/messages', async (req, res) => {
  await AssistantMessage.destroy({ where: { userId: req.auth.id } });
  res.status(204).end();
});

module.exports = router;
