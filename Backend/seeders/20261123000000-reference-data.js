'use strict';

const bcrypt = require('bcrypt');

const DEPARTMENTS = [
  'Service Scolarité',
  'Service Stage',
  'Département licence Informatique',
  'Département Management',
  'Département Prépa Ingénieur',
  'Département FTA',
  'Service IT',
  'Service Qualité',
  'Service Coopération Internationale',
  'Service Marketing',
  'Service Admission',
  'Service Finance',
  'Service Student Success',
];

/**
 * Reference data only: departments. The first super admin is created from
 * SEED_ADMIN_LOGIN / SEED_ADMIN_PASSWORD when both are set; otherwise run
 * `npm run create-admin`. No real credentials ever live in the repository.
 */
module.exports = {
  async up(queryInterface) {
    const now = new Date();
    const [existing] = await queryInterface.sequelize.query('SELECT name FROM departments');
    const known = new Set(existing.map((row) => row.name));
    const rows = DEPARTMENTS.filter((name) => !known.has(name))
      .map((name) => ({ name, isActive: true, createdAt: now, updatedAt: now }));
    if (rows.length) await queryInterface.bulkInsert('departments', rows);

    const { SEED_ADMIN_LOGIN: login, SEED_ADMIN_PASSWORD: password } = process.env;
    if (login && password) {
      const [admins] = await queryInterface.sequelize.query(
        'SELECT id FROM superAdmins WHERE login = ?', { replacements: [login] },
      );
      if (!admins.length) {
        await queryInterface.bulkInsert('superAdmins', [{
          login,
          password: await bcrypt.hash(password, 12),
          displayName: login,
          role: 'owner',
          isActive: true,
          createdAt: now,
          updatedAt: now,
        }]);
      }
    }
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('departments', { name: DEPARTMENTS });
  },
};
