'use strict';

/**
 * News expiry, read tracking ("new" badges + view counts), bookmarks, and
 * canned replies for the support team.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, DATE } = Sequelize;
    const fk = (table, onDelete, allowNull = false) => ({
      type: INTEGER, allowNull, references: { model: table, key: 'id' }, onUpdate: 'CASCADE', onDelete,
    });

    // Hidden from the feed after this instant (NULL = never).
    await queryInterface.addColumn('news', 'expiresAt', { type: DATE, allowNull: true });
    await queryInterface.addIndex('news', ['expiresAt']);

    await queryInterface.createTable('newsViews', {
      newsId: { ...fk('news', 'CASCADE'), primaryKey: true },
      userId: { ...fk('users', 'CASCADE'), primaryKey: true },
      viewedAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('newsViews', ['userId']);

    await queryInterface.createTable('newsBookmarks', {
      newsId: { ...fk('news', 'CASCADE'), primaryKey: true },
      userId: { ...fk('users', 'CASCADE'), primaryKey: true },
      createdAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('newsBookmarks', ['userId', 'createdAt']);

    await queryInterface.createTable('cannedReplies', {
      id: { type: INTEGER, autoIncrement: true, primaryKey: true, allowNull: false },
      title: { type: STRING(100), allowNull: false },
      content: { type: TEXT, allowNull: false },
      // NULL = available to every service.
      departmentId: fk('departments', 'CASCADE', true),
      createdById: fk('superAdmins', 'SET NULL', true),
      createdAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('cannedReplies');
    await queryInterface.dropTable('newsBookmarks');
    await queryInterface.dropTable('newsViews');
    await queryInterface.removeColumn('news', 'expiresAt');
  },
};
