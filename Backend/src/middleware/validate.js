'use strict';

const { z } = require('zod');

/**
 * Validates and coerces `req.body`, `req.query` and `req.params` with zod
 * schemas. Parsed values are stored on `req.valid` (Express 5 makes
 * `req.query` read-only).
 */
function validate({ body, query, params } = {}) {
  return (req, res, next) => {
    req.valid = {
      body: body ? body.parse(req.body ?? {}) : req.body,
      query: query ? query.parse(req.query ?? {}) : req.query,
      params: params ? params.parse(req.params ?? {}) : req.params,
    };
    next();
  };
}

// Reusable field schemas.
const id = z.coerce.number().int().positive();
const idParam = z.object({ id });
const pageQuery = {
  page: z.coerce.number().int().min(0).default(0),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
};
/** Accepts true/false/'true'/'false'/'1'/'0'/'on' (multipart forms send strings). */
const boolish = z.union([z.boolean(), z.string()]).transform((value) => (
  typeof value === 'boolean' ? value : ['true', '1', 'on', 'oui', 'yes'].includes(value.toLowerCase())
));
/** ISO date string (with offset) or empty → null. */
const optionalDate = z.union([z.string(), z.null()]).optional().transform((value, ctx) => {
  if (value === undefined) return undefined;
  if (value === null || value.trim() === '') return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    ctx.addIssue({ code: 'custom', message: 'Date invalide' });
    return z.NEVER;
  }
  return date;
});
const optionalId = z.union([z.coerce.number().int().positive(), z.literal(''), z.null()])
  .optional()
  .transform((value) => (value === '' ? null : value));
const password = z.string().min(8, 'Le mot de passe doit contenir au moins 8 caractères').max(128);

module.exports = { validate, z, id, idParam, pageQuery, boolish, optionalDate, optionalId, password };
