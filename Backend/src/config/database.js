'use strict';

// Shared by the application (src/models/index.js) and by sequelize-cli
// (see .sequelizerc), so migrations always target the same database.
const env = require('./env');

const base = {
  username: env.DB_USER,
  password: env.DB_PASSWORD || null,
  host: env.DB_HOST,
  port: env.DB_PORT,
  dialect: 'mysql',
  // Store every DATETIME in UTC; clients send ISO strings with an offset.
  timezone: '+00:00',
  dialectOptions: { dateStrings: false },
  define: { charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' },
  logging: false,
  migrationStorageTableName: 'SequelizeMeta',
  seederStorage: 'sequelize',
  seederStorageTableName: 'SequelizeData',
};

module.exports = {
  development: { ...base, database: env.DB_NAME },
  test: { ...base, database: env.DB_NAME_TEST },
  production: { ...base, database: env.DB_NAME, pool: { max: 10, min: 0, idle: 10000 } },
};
