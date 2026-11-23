'use strict';

/**
 * Student classes ("catégories") now belong to a department. A department
 * admin manages the students of every class of their department.
 *
 * Also renames two departments to the university's structure and creates
 * the official classes. The next migration moves students out of the old
 * classes and deletes them.
 */
const RENAMES = [
  ['Département Prépa Ingénieur', 'Département ING'],
  ['Département licence Informatique', 'Département Informatique'],
];

const CLASSES = [
  ['Cycle Préparatoire', 'Département ING'],
  ['Cycle Ingénieurs', 'Département ING'],
  ['FTA (Formation Temps Aménagé)', 'Département FTA'],
  ['LIM (Licence Informatique Multimédia)', 'Département Informatique'],
  ['LGLSI (Licence Génie Logiciel et Systèmes Intelligents)', 'Département Informatique'],
  ['LBIS (Licence Business Information System)', 'Département Informatique'],
  ['LSG (Licence Sciences de Gestion)', 'Département Management'],
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('categories', 'departmentId', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'departments', key: 'id' },
      onUpdate: 'CASCADE',
      onDelete: 'SET NULL',
    });
    await queryInterface.addIndex('categories', ['departmentId']);

    const db = queryInterface.sequelize;
    for (const [from, to] of RENAMES) {
      await db.query('UPDATE departments SET name = ? WHERE name = ?', { replacements: [to, from] });
    }
    // Fresh databases get their departments from the seeder, which runs after
    // the migrations: it also creates the classes there (same list).
    const now = new Date();
    for (const [libelle, departmentName] of CLASSES) {
      const [[department]] = await db.query('SELECT id FROM departments WHERE name = ?', { replacements: [departmentName] });
      if (!department) continue;
      const [[existing]] = await db.query('SELECT id FROM categories WHERE libelle = ?', { replacements: [libelle] });
      if (existing) {
        await db.query('UPDATE categories SET departmentId = ? WHERE id = ?', { replacements: [department.id, existing.id] });
      } else {
        await queryInterface.bulkInsert('categories', [{ libelle, departmentId: department.id, createdAt: now, updatedAt: now }]);
      }
    }
  },

  async down(queryInterface) {
    const db = queryInterface.sequelize;
    for (const [from, to] of RENAMES) {
      await db.query('UPDATE departments SET name = ? WHERE name = ?', { replacements: [from, to] });
    }
    await queryInterface.removeColumn('categories', 'departmentId');
  },
};

module.exports.CLASSES = CLASSES;
