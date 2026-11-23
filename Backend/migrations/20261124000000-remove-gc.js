'use strict';

/** Drops the undocumented `GC` flag from students (unused by any logic). */
module.exports = {
  async up(queryInterface) {
    await queryInterface.removeColumn('users', 'GC');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.addColumn('users', 'GC', { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false });
  },
};
