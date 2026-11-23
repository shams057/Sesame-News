'use strict';

const path = require('path');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const env = require('./config/env');
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const { apiLimiter } = require('./middleware/rateLimits');
const { notFoundHandler, errorHandler } = require('./middleware/errorHandler');
const { categories, departments } = require('./routes/referenceData');

function corsOptions() {
  return {
    origin(origin, callback) {
      // Native mobile apps send no Origin header.
      if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
    exposedHeaders: ['Content-Disposition'],
  };
}

function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  app.use(helmet({
    // Media are embedded by the admin (other origin) and the apps.
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors(corsOptions()));
  app.use(pinoHttp({ logger, autoLogging: { ignore: (req) => req.url === '/health' } }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/health', async (req, res) => {
    try {
      await sequelize.authenticate();
      res.json({ status: 'ok', database: 'up', uptime: Math.round(process.uptime()) });
    } catch {
      res.status(503).json({ status: 'degraded', database: 'down' });
    }
  });

  // Public news media only (ticket attachments live in a private folder).
  app.use('/uploads', express.static(env.publicUploadDir, {
    index: false,
    dotfiles: 'deny',
    fallthrough: false,
    maxAge: '7d',
    setHeaders: (res, filePath) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      if (/\.(docx?)$/i.test(filePath)) res.setHeader('Content-Disposition', 'attachment');
    },
  }));

  const api = express.Router();
  api.use(apiLimiter);
  api.get('/openapi.json', (req, res) => res.sendFile(path.join(__dirname, '..', 'docs', 'openapi.json')));
  api.use('/auth', require('./routes/auth'));
  api.use('/me', require('./routes/me'));
  api.use('/admins', require('./routes/admins'));
  api.use('/users', require('./routes/users'));
  api.use('/categories', categories);
  api.use('/departments', departments);
  api.use('/news', require('./routes/news'));
  api.use('/feed', require('./routes/feed'));
  api.use('/tickets', require('./routes/tickets'));
  api.use('/stats', require('./routes/stats'));
  api.use('/canned-replies', require('./routes/cannedReplies'));
  api.use('/assistant', require('./routes/assistant'));
  app.use('/api/v1', api);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}

module.exports = { createApp, corsOptions };
