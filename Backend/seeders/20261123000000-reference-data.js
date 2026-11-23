'use strict';

const bcrypt = require('bcrypt');
const { CLASSES } = require('../migrations/20261125000000-classes-per-department');

const DEPARTMENTS = [
  'Service Scolarité',
  'Service Stage',
  'Département Informatique',
  'Département Management',
  'Département ING',
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
 * Reference data only: departments and the student classes of each
 * department (same list as the classes migration). The first super admin is created from
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

    for (const [libelle, departmentName] of CLASSES) {
      const [[department]] = await queryInterface.sequelize.query('SELECT id FROM departments WHERE name = ?', { replacements: [departmentName] });
      const [[category]] = await queryInterface.sequelize.query('SELECT id FROM categories WHERE libelle = ?', { replacements: [libelle] });
      if (department && !category) {
        await queryInterface.bulkInsert('categories', [{ libelle, departmentId: department.id, createdAt: now, updatedAt: now }]);
      }
    }

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
