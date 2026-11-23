'use strict';

const http = require('http');
const env = require('./config/env');
const logger = require('./utils/logger');
const { sequelize } = require('./models');
const { createApp } = require('./app');
const { attachSocketServer } = require('./socket');
const { processScheduledNews } = require('./services/newsService');
const { purgeExpiredSessions } = require('./services/authService');

async function start() {
  try {
    await sequelize.authenticate();
  } catch (error) {
    logger.fatal({ err: error }, 'Cannot connect to the database');
    process.exit(1);
  }

  // The schema is managed by migrations only (npm run db:migrate).
  const [pending] = await sequelize.query("SHOW TABLES LIKE 'SequelizeMeta'");
  if (!pending.length) {
    logger.fatal('Database not initialised: run `npm run db:setup` in Backend/');
    process.exit(1);
  }

  const app = createApp();
  const server = http.createServer(app);
  const io = attachSocketServer(server);

  const timers = [
    setInterval(processScheduledNews, 60 * 1000),
    setInterval(() => purgeExpiredSessions().catch((err) => logger.warn({ err }, 'Session purge failed')), 6 * 3600 * 1000),
  ];
  processScheduledNews();

  server.listen(env.PORT, () => logger.info(`API listening on http://localhost:${env.PORT}`));

  let shuttingDown = false;
  const shutdown = (signal) => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'Shutting down');
    timers.forEach(clearInterval);
    io.close();
    server.close(async () => {
      await sequelize.close();
      process.exit(0);
    });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('unhandledRejection', (reason) => logger.error({ err: reason }, 'Unhandled promise rejection'));
}

start();
