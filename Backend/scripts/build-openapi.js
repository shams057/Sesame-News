#!/usr/bin/env node
'use strict';

/**
 * Generates docs/openapi.json from the compact route table below.
 * Run `npm run docs` after changing a route.
 */
const fs = require('fs');
const path = require('path');

const ref = (name) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema) => ({ content: { 'application/json': { schema } } });
const multipart = (properties) => ({ content: { 'multipart/form-data': { schema: { type: 'object', properties } } } });
const idParam = { name: 'id', in: 'path', required: true, schema: { type: 'integer' } };
const q = (name, schema, description) => ({ name, in: 'query', schema, description });
const page = [q('page', { type: 'integer', minimum: 0 }), q('pageSize', { type: 'integer', maximum: 100 })];

// [method, path, tag, summary, roles, extra]
const routes = [
  ['post', '/auth/user/login', 'Auth', 'Student login', 'public', { requestBody: json(ref('Login')), responses: { 200: json(ref('LoginResult')) } }],
  ['post', '/auth/admin/login', 'Auth', 'Staff login', 'public', { requestBody: json(ref('Login')), responses: { 200: json(ref('LoginResult')) } }],
  ['post', '/auth/logout', 'Auth', 'Revoke the current session', 'any'],
  ['get', '/me', 'Profile', 'Current account', 'any'],
  ['patch', '/me', 'Profile', 'Update e-mail (student) or display name (staff)', 'any'],
  ['put', '/me/password', 'Profile', 'Change password (current password required; other sessions revoked)', 'any',
    { requestBody: json({ type: 'object', required: ['currentPassword', 'newPassword'], properties: { currentPassword: { type: 'string' }, newPassword: { type: 'string', minLength: 8 } } }) }],
  ['post', '/me/push-tokens', 'Profile', 'Register an Expo push token', 'user'],
  ['delete', '/me/push-tokens', 'Profile', 'Unregister an Expo push token', 'user'],
  ['get', '/admins', 'Staff', 'List staff accounts', 'staff'],
  ['post', '/admins', 'Staff', 'Create a staff account', 'owner'],
  ['patch', '/admins/{id}', 'Staff', 'Edit a staff account', 'owner', { parameters: [idParam] }],
  ['delete', '/admins/{id}', 'Staff', 'Delete a staff account', 'owner', { parameters: [idParam] }],
  ['get', '/users', 'Students', 'Search students', 'staff', { parameters: [...page, q('q', { type: 'string' }), q('categorieId', { type: 'integer' }), q('status', { enum: ['active', 'inactive'] }), q('sort', { enum: ['name', 'login', '-createdAt', '-lastLoginAt'] })] }],
  ['post', '/users', 'Students', 'Create a student (temporary password returned once when none is given)', 'staff'],
  ['get', '/users/import/template', 'Students', 'CSV import template', 'staff'],
  ['post', '/users/import', 'Students', 'Import students from CSV (valid rows in one transaction, per-row errors, temporary passwords)', 'staff', { requestBody: multipart({ file: { type: 'string', format: 'binary' } }) }],
  ['get', '/users/{id}', 'Students', 'Get a student', 'staff', { parameters: [idParam] }],
  ['patch', '/users/{id}', 'Students', 'Edit / deactivate a student', 'staff', { parameters: [idParam] }],
  ['post', '/users/{id}/reset-password', 'Students', 'Generate a temporary password', 'staff', { parameters: [idParam] }],
  ['post', '/users/bulk', 'Students', 'Bulk activate / deactivate (staff) or set class (owner only); max 500 ids', 'staff'],
  ['delete', '/users/{id}', 'Students', 'Delete a student (tickets are kept)', 'owner', { parameters: [idParam] }],
  ['get', '/categories', 'Reference data', 'List student classes (staff also get user counts and department)', 'any'],
  ['post', '/categories', 'Reference data', 'Create a class (libelle, departmentId)', 'owner'],
  ['patch', '/categories/{id}', 'Reference data', 'Rename a class or change its department', 'owner', { parameters: [idParam] }],
  ['delete', '/categories/{id}', 'Reference data', 'Delete an unused class (409 when used)', 'owner', { parameters: [idParam] }],
  ['get', '/departments', 'Reference data', 'List departments (students: active only)', 'any'],
  ['post', '/departments', 'Reference data', 'Create a department', 'owner'],
  ['patch', '/departments/{id}', 'Reference data', 'Edit / deactivate a department', 'owner', { parameters: [idParam] }],
  ['delete', '/departments/{id}', 'Reference data', 'Delete a department without tickets', 'owner', { parameters: [idParam] }],
  ['get', '/news', 'News (staff)', 'List news', 'staff', { parameters: [...page, q('q', { type: 'string' }), q('status', { enum: ['draft', 'published', 'scheduled', 'expired'] }), q('categorieId', { type: 'integer' })] }],
  ['post', '/news', 'News (staff)', 'Create news (multipart, up to 10 files)', 'owner', { requestBody: multipart({
    titre: { type: 'string', maxLength: 200 }, description: { type: 'string' }, status: { enum: ['draft', 'published'] },
    publishAt: { type: 'string', format: 'date-time' }, pinned: { type: 'boolean' }, audienceAll: { type: 'boolean' },
    categoryIds: { type: 'string', description: 'JSON array of class (category) ids' }, eventStart: { type: 'string', format: 'date-time' },
    eventEnd: { type: 'string', format: 'date-time' }, location: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, files: { type: 'array', items: { type: 'string', format: 'binary' } },
  }), responses: { 201: json(ref('News')) } }],
  ['get', '/news/{id}', 'News (staff)', 'Get news', 'staff', { parameters: [idParam] }],
  ['patch', '/news/{id}', 'News (staff)', 'Edit news (multipart; removeMediaIds to delete files)', 'owner', { parameters: [idParam] }],
  ['delete', '/news/{id}', 'News (staff)', 'Delete news and its files', 'owner', { parameters: [idParam] }],
  ['get', '/feed', 'Feed (students)', 'Visible news for the authenticated student', 'user', { parameters: [...page, q('q', { type: 'string' }), q('filter', { enum: ['all', 'unseen', 'bookmarks', 'events', 'pinned', 'documents'] })] }],
  ['get', '/feed/events', 'Feed (students)', 'Upcoming and ongoing events', 'user', { parameters: [q('from', { type: 'string', format: 'date-time' }), q('to', { type: 'string', format: 'date-time' })] }],
  ['get', '/feed/{id}', 'Feed (students)', 'One visible news item', 'user', { parameters: [idParam] }],
  ['get', '/feed/unseen-count', 'Feed (students)', 'Number of visible news not seen yet', 'user'],
  ['post', '/feed/seen', 'Feed (students)', 'Mark news as seen { ids }', 'user'],
  ['put', '/feed/{id}/bookmark', 'Feed (students)', 'Bookmark a news item', 'user', { parameters: [idParam] }],
  ['delete', '/feed/{id}/bookmark', 'Feed (students)', 'Remove a bookmark', 'user', { parameters: [idParam] }],
  ['get', '/tickets', 'Tickets', 'Students: own tickets. Staff: filterable queue', 'any', { parameters: [...page, q('status', { enum: ['open', 'in_progress', 'closed', 'active'] }), q('departmentId', { type: 'integer' }), q('priority', { enum: ['low', 'normal', 'high', 'urgent'] }), q('assigned', { type: 'string', description: 'me | unassigned | <id>' }), q('unread', { type: 'boolean' }), q('q', { type: 'string' }), q('sort', { enum: ['-createdAt', 'createdAt', '-updatedAt', 'priority'] })] }],
  ['post', '/tickets', 'Tickets', 'Open a ticket', 'user'],
  ['get', '/tickets/unread', 'Tickets', 'Ticket ids with unread messages', 'any'],
  ['get', '/tickets/{id}', 'Tickets', 'Get a ticket', 'any', { parameters: [idParam] }],
  ['patch', '/tickets/{id}', 'Tickets', 'Staff: status/priority/assignment/transfer. Student: close, reopen (14 days), rate', 'any', { parameters: [idParam] }],
  ['delete', '/tickets/{id}', 'Tickets', 'Delete a ticket', 'owner', { parameters: [idParam] }],
  ['get', '/tickets/{id}/messages', 'Tickets', 'Conversation (internal notes for staff only)', 'any', { parameters: [idParam] }],
  ['post', '/tickets/{id}/messages', 'Tickets', 'Send a message (JSON or multipart with `attachment`)', 'any', { parameters: [idParam] }],
  ['post', '/tickets/{id}/read', 'Tickets', 'Mark the conversation as read', 'any', { parameters: [idParam] }],
  ['get', '/tickets/{id}/messages/{messageId}/attachment', 'Tickets', 'Download a private attachment', 'any', { parameters: [idParam, { name: 'messageId', in: 'path', required: true, schema: { type: 'integer' } }] }],
  ['get', '/stats/periods', 'Statistics', 'Available periods', 'staff'],
  ['get', '/stats/tickets', 'Statistics', 'Ticket statistics', 'staff', { parameters: [q('period', { enum: ['today', '7days', '30days', 'month', 'semester', 'year'] }), q('departmentId', { type: 'integer' })] }],
  ['get', '/stats/tickets.csv', 'Statistics', 'CSV export (one row per ticket)', 'staff'],
  ['get', '/canned-replies', 'Canned replies', 'Replies usable for a department (?departmentId=)', 'staff'],
  ['post', '/canned-replies', 'Canned replies', 'Create a canned reply', 'staff'],
  ['patch', '/canned-replies/{id}', 'Canned replies', 'Edit a canned reply', 'staff', { parameters: [idParam] }],
  ['delete', '/canned-replies/{id}', 'Canned replies', 'Delete a canned reply', 'staff', { parameters: [idParam] }],
  ['get', '/assistant', 'Assistant', 'Availability + conversation history', 'user'],
  ['post', '/assistant/messages', 'Assistant', 'Ask a question (RAG over visible news)', 'user', { requestBody: json({ type: 'object', properties: { message: { type: 'string', maxLength: 1000 } } }) }],
  ['delete', '/assistant/messages', 'Assistant', 'Clear the conversation', 'user'],
];

const ROLE_TEXT = {
  public: 'Public.', any: 'Any authenticated account.', user: 'Students only.', staff: 'Staff only. Department admins are limited to their department; for students, to the classes of their department (no class change, no deletion).', owner: 'Staff with the owner role only.',
};

const paths = {};
for (const [method, route, tag, summary, roles, extra = {}] of routes) {
  paths[route] = paths[route] || {};
  paths[route][method] = {
    tags: [tag],
    summary,
    description: ROLE_TEXT[roles],
    ...(roles === 'public' ? { security: [] } : {}),
    responses: { 200: { description: 'OK' }, 400: { description: 'Invalid input' }, 401: { description: 'Not authenticated' }, 403: { description: 'Forbidden' } },
    ...extra,
    ...(extra.responses ? { responses: { ...extra.responses, 400: { description: 'Invalid input' } } } : {}),
  };
}

const spec = {
  openapi: '3.1.0',
  info: { title: 'Sesame News API', version: '2.0.0', description: 'Errors always have the shape `{ "error": string, "details"?: [] }`. WebSocket events: ticket:created, ticket:updated, ticket:deleted, ticket:message, ticket:read, news:published (Socket.IO, `auth: { token }`).' },
  servers: [{ url: '/api/v1' }],
  security: [{ bearer: [] }],
  components: {
    securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } },
    schemas: {
      Login: { type: 'object', required: ['login', 'password'], properties: { login: { type: 'string' }, password: { type: 'string' } } },
      LoginResult: { type: 'object', properties: { token: { type: 'string' }, expiresAt: { type: 'string', format: 'date-time' }, account: { type: 'object' } } },
      Media: { type: 'object', properties: { id: { type: 'integer' }, url: { type: 'string' }, kind: { enum: ['image', 'video', 'document'] }, mimeType: { type: 'string' }, originalName: { type: 'string' }, size: { type: 'integer' } } },
      News: { type: 'object', properties: {
        id: { type: 'integer' }, titre: { type: 'string' }, description: { type: 'string' }, status: { enum: ['draft', 'published'] },
        publishAt: { type: ['string', 'null'], format: 'date-time' }, pinned: { type: 'boolean' }, audienceAll: { type: 'boolean' },
        eventStart: { type: ['string', 'null'], format: 'date-time' }, eventEnd: { type: ['string', 'null'], format: 'date-time' },
        location: { type: ['string', 'null'] }, categories: { type: 'array', items: { type: 'object' } }, media: { type: 'array', items: ref('Media') },
      } },
    },
  },
  paths,
};

fs.writeFileSync(path.join(__dirname, '..', 'docs', 'openapi.json'), `${JSON.stringify(spec, null, 2)}\n`);
console.log(`docs/openapi.json written (${routes.length} operations)`);
