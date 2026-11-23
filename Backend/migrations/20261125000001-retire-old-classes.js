'use strict';

/**
 * Retires the classes that existed before classes belonged to departments:
 * their students and news targeting move to the matching official class,
 * then the old class is deleted. Classes not listed here are left untouched.
 */
const MOVES = [
  ['Licence Informatique', 'LIM (Licence Informatique Multimédia)'],
  ['Management', 'LSG (Licence Sciences de Gestion)'],
  ['Ingénieure', 'Cycle Ingénieurs'],
];

module.exports = {
  async up(queryInterface) {
    const db = queryInterface.sequelize;
    const idOf = async (libelle) => (await db.query('SELECT id FROM categories WHERE libelle = ?', { replacements: [libelle] }))[0][0]?.id;
    for (const [from, to] of MOVES) {
      const oldId = await idOf(from);
      const newId = await idOf(to);
      if (!oldId || !newId) continue;
      await db.query('UPDATE users SET categorieId = ? WHERE categorieId = ?', { replacements: [newId, oldId] });
      // A news may already target the new class: IGNORE skips those duplicates.
      await db.query('UPDATE IGNORE newsCategories SET categorieId = ? WHERE categorieId = ?', { replacements: [newId, oldId] });
      await db.query('DELETE FROM newsCategories WHERE categorieId = ?', { replacements: [oldId] });
      await db.query('DELETE FROM categories WHERE id = ?', { replacements: [oldId] });
    }
  },

  // Students and news were merged into the new classes: there is nothing
  // reliable to split them back into.
  async down() {},
};
