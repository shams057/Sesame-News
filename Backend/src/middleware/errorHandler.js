'use strict';

const multer = require('multer');
const { ZodError } = require('zod');
const { BaseError, UniqueConstraintError, ForeignKeyConstraintError, ValidationError } = require('sequelize');
const { AppError } = require('../utils/errors');
const logger = require('../utils/logger');

function notFoundHandler(req, res) {
  res.status(404).json({ error: 'Route introuvable' });
}

// Express recognises error handlers by their 4 parameters.
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    return res.status(err.status).json({ error: err.message, ...(err.details ? { details: err.details } : {}) });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }
  if (err instanceof multer.MulterError) {
    const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : 400;
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Fichier trop volumineux' : 'Envoi de fichier invalide';
    return res.status(status).json({ error: message });
  }
  if (err instanceof UniqueConstraintError) {
    return res.status(409).json({ error: 'Cette valeur existe déjà', details: Object.keys(err.fields || {}) });
  }
  if (err instanceof ForeignKeyConstraintError) {
    return res.status(409).json({ error: 'Opération impossible : des éléments liés existent ou la référence est invalide' });
  }
  if (err instanceof ValidationError) {
    return res.status(400).json({
      error: 'Données invalides',
      details: err.errors.map((item) => ({ field: item.path, message: item.message })),
    });
  }
  if (err?.type === 'entity.too.large') return res.status(413).json({ error: 'Requête trop volumineuse' });
  if (err?.type === 'entity.parse.failed') return res.status(400).json({ error: 'JSON invalide' });

  // Unknown error: log everything, reveal nothing.
  (req.log || logger).error({ err: err instanceof BaseError ? { name: err.name, message: err.message } : err }, 'Unhandled error');
  return res.status(500).json({ error: 'Erreur interne du serveur' });
}

module.exports = { notFoundHandler, errorHandler };
