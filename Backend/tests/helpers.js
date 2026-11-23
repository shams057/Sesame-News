const request = require('supertest');
const { createApp } = require('../src/app');
const models = require('../src/models');
const { hashPassword } = require('../src/services/authService');

const app = createApp();
let counter = 0;
const unique = (prefix) => `${prefix}${Date.now().toString(36)}${(counter += 1)}`;

async function createAdmin(overrides = {}) {
  const password = 'Password123!';
  const admin = await models.SuperAdmin.create({
    login: unique('admin'), displayName: 'Agent Test', role: 'owner', password: await hashPassword(password), ...overrides,
  });
  const res = await request(app).post('/api/v1/auth/admin/login').send({ login: admin.login, password });
  return { admin, token: res.body.token, password };
}

async function createUser(overrides = {}) {
  const password = 'Password123!';
  const user = await models.User.create({
    login: unique('user'), firstname: 'Amine', lastname: 'Ben Ali', password: await hashPassword(password), ...overrides,
  });
  const res = await request(app).post('/api/v1/auth/user/login').send({ login: user.login, password });
  return { user, token: res.body.token, password };
}

async function createCategory(libelle = unique('Cat')) {
  return models.Categorie.create({ libelle });
}

async function department() {
  return models.Department.findOne({ order: [['id', 'ASC']] });
}

const auth = (token) => ({ Authorization: `Bearer ${token}` });

afterAll(() => models.sequelize.close());

module.exports = { app, request, models, createAdmin, createUser, createCategory, department, auth, unique };
