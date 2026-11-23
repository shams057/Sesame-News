'use strict';

const pino = require('pino');
const env = require('../config/env');

const logger = pino({
  level: env.isTest ? 'silent' : env.LOG_LEVEL,
  // Never log credentials or tokens, even by accident.
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', '*.password', '*.token', '*.newPassword', '*.currentPassword'],
    censor: '[redacted]',
  },
});

module.exports = logger;
