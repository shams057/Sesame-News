'use strict';

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const env = require('../config/env');
const { badRequest } = require('../utils/errors');

/**
 * Allow-list: the extension AND the declared MIME type must both match the
 * same entry. SVG, HTML and anything script-capable are never accepted.
 */
const FILE_TYPES = {
  '.jpg': { mimes: ['image/jpeg'], kind: 'image' },
  '.jpeg': { mimes: ['image/jpeg'], kind: 'image' },
  '.png': { mimes: ['image/png'], kind: 'image' },
  '.gif': { mimes: ['image/gif'], kind: 'image' },
  '.webp': { mimes: ['image/webp'], kind: 'image' },
  '.mp4': { mimes: ['video/mp4'], kind: 'video' },
  '.webm': { mimes: ['video/webm'], kind: 'video' },
  '.mov': { mimes: ['video/quicktime'], kind: 'video' },
  '.pdf': { mimes: ['application/pdf'], kind: 'document' },
  '.doc': { mimes: ['application/msword'], kind: 'document' },
  '.docx': { mimes: ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'], kind: 'document' },
};

const MB = 1024 * 1024;

for (const dir of [env.publicUploadDir, env.privateUploadDir]) fs.mkdirSync(dir, { recursive: true });

function fileKind(file) {
  const ext = path.extname(file.originalname || '').toLowerCase();
  const type = FILE_TYPES[ext];
  return type && type.mimes.includes(file.mimetype) ? { ext, kind: type.kind } : null;
}

function makeUploader({ dir, kinds, maxSize, maxFiles }) {
  return multer({
    storage: multer.diskStorage({
      destination: dir,
      // Never reuse the client file name on disk.
      filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${fileKind(file).ext}`),
    }),
    limits: { fileSize: maxSize, files: maxFiles },
    fileFilter: (req, file, cb) => {
      const type = fileKind(file);
      if (!type || !kinds.includes(type.kind)) {
        return cb(badRequest(`Type de fichier non autorisé : ${file.originalname}`));
      }
      file.kind = type.kind;
      // Keep a clean display name (no path components, bounded length).
      file.safeName = path.basename(file.originalname).replace(/[^\p{L}\p{N}._ -]/gu, '_').slice(0, 200);
      return cb(null, true);
    },
  });
}

/** News attachments: public, served from /uploads. */
const newsMediaUpload = makeUploader({
  dir: env.publicUploadDir,
  kinds: ['image', 'video', 'document'],
  maxSize: 100 * MB,
  maxFiles: 10,
});

/** Ticket attachments: private, only served through an authorized route. */
const ticketAttachmentUpload = makeUploader({
  dir: env.privateUploadDir,
  kinds: ['image', 'document'],
  maxSize: 10 * MB,
  maxFiles: 1,
});

/** In-memory uploads for files we only parse (CSV). */
const memoryUpload = (maxSize, accept) => multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: maxSize, files: 1 },
  fileFilter: (req, file, cb) => (accept(file) ? cb(null, true) : cb(badRequest('Type de fichier non autorisé'))),
});

const csvUpload = memoryUpload(2 * MB, (file) => /\.csv$/i.test(file.originalname || ''));

/** Deletes a stored file, ignoring "already gone". */
async function removeStoredFile(relativePath, { isPrivate = false } = {}) {
  if (!relativePath) return;
  const base = isPrivate ? env.privateUploadDir : env.publicUploadDir;
  const resolved = path.resolve(base, path.basename(relativePath));
  if (!resolved.startsWith(path.resolve(base))) return;
  await fs.promises.unlink(resolved).catch((error) => {
    if (error.code !== 'ENOENT') throw error;
  });
}

module.exports = {
  FILE_TYPES,
  newsMediaUpload,
  ticketAttachmentUpload,
  csvUpload,
  removeStoredFile,
};
