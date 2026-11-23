'use strict';

const { parse } = require('csv-parse/sync');
const { z } = require('zod');
const { Op } = require('sequelize');
const { sequelize, User, Categorie } = require('../models');
const { hashPassword } = require('./authService');
const { generateTempPassword } = require('../utils/helpers');
const { badRequest } = require('../utils/errors');

const MAX_ROWS = 2000;

const TEMPLATE = '﻿firstname,lastname,login,email,categorie\n'
  + 'Amine,Ben Ali,amine.benali,amine.benali@exemple.tn,Informatique\n';

const rowSchema = z.object({
  firstname: z.string().trim().min(1, 'prénom manquant').max(100),
  lastname: z.string().trim().min(1, 'nom manquant').max(100),
  login: z.string().trim().min(3, 'login trop court').max(100).regex(/^[\w.@-]+$/, 'login invalide'),
  email: z.union([z.literal(''), z.string().trim().email('email invalide').max(255)]).optional(),
  categorie: z.string().trim().max(100).optional(),
});

/**
 * Imports students from a CSV. Columns (header row, any order, `,` or `;`):
 * firstname, lastname, login, email?, categorie? (label or id).
 * No password column is read: every imported student gets a generated
 * temporary password (returned once) and must change it at first login.
 * `allowedCategoryIds` (department admins): rows must target one of these
 * classes; the column may be omitted when the admin has a single class.
 * Valid rows are inserted in one transaction; invalid rows are reported.
 */
async function importUsers(buffer, { allowedCategoryIds = null } = {}) {
  let records;
  try {
    const text = buffer.toString('utf8');
    const delimiter = (text.split(/\r?\n/, 1)[0].match(/;/g) || []).length > (text.split(/\r?\n/, 1)[0].match(/,/g) || []).length ? ';' : ',';
    records = parse(text, {
      bom: true,
      columns: (header) => header.map((column) => column.trim().toLowerCase()),
      skip_empty_lines: true,
      trim: true,
      delimiter,
      relax_column_count: true,
    });
  } catch (error) {
    throw badRequest(`CSV illisible : ${error.message}`);
  }
  if (!records.length) throw badRequest('Le fichier ne contient aucun utilisateur');
  if (records.length > MAX_ROWS) throw badRequest(`Maximum ${MAX_ROWS} lignes par import`);

  const categories = await Categorie.findAll({ raw: true });
  const categoryByKey = new Map();
  categories.forEach((category) => {
    categoryByKey.set(String(category.id), category.id);
    categoryByKey.set(category.libelle.toLowerCase(), category.id);
    // Short code accepted too: « LIM » for « LIM (Licence Informatique Multimédia) ».
    categoryByKey.set(category.libelle.split(' (')[0].trim().toLowerCase(), category.id);
  });

  const logins = records.map((record) => String(record.login || '').trim()).filter(Boolean);
  const existing = new Set((await User.findAll({ where: { login: { [Op.in]: logins } }, attributes: ['login'], raw: true }))
    .map((user) => user.login.toLowerCase()));

  const errors = [];
  const valid = [];
  const seen = new Set();
  records.forEach((record, index) => {
    const line = index + 2; // header is line 1
    const parsed = rowSchema.safeParse(record);
    if (!parsed.success) {
      errors.push({ line, login: record.login || '', error: parsed.error.issues.map((issue) => issue.message).join(', ') });
      return;
    }
    const row = parsed.data;
    const key = row.login.toLowerCase();
    if (existing.has(key)) { errors.push({ line, login: row.login, error: 'login déjà utilisé' }); return; }
    if (seen.has(key)) { errors.push({ line, login: row.login, error: 'login en double dans le fichier' }); return; }
    let categorieId = null;
    if (row.categorie) {
      categorieId = categoryByKey.get(row.categorie.toLowerCase()) ?? null;
      if (!categorieId) { errors.push({ line, login: row.login, error: `classe inconnue « ${row.categorie} »` }); return; }
    }
    if (allowedCategoryIds) {
      if (!categorieId && allowedCategoryIds.length === 1) [categorieId] = allowedCategoryIds;
      if (!categorieId) { errors.push({ line, login: row.login, error: 'classe obligatoire' }); return; }
      if (!allowedCategoryIds.includes(categorieId)) { errors.push({ line, login: row.login, error: `classe « ${row.categorie} » hors de votre service` }); return; }
    }
    seen.add(key);
    valid.push({ ...row, categorieId });
  });

  const credentials = [];
  if (valid.length) {
    const prepared = await Promise.all(valid.map(async (row) => {
      const temporaryPassword = generateTempPassword();
      credentials.push({ login: row.login, firstname: row.firstname, lastname: row.lastname, temporaryPassword });
      return {
        firstname: row.firstname,
        lastname: row.lastname,
        login: row.login,
        email: row.email || null,
        categorieId: row.categorieId,
        password: await hashPassword(temporaryPassword),
        mustChangePassword: true,
      };
    }));
    await sequelize.transaction((transaction) => User.bulkCreate(prepared, { transaction, validate: true }));
  }

  return { imported: credentials.length, errors, credentials };
}

module.exports = { importUsers, TEMPLATE };
