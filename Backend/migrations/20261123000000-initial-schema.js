'use strict';

/**
 * Initial schema (v2). Replaces the old `sync({ alter: true })` startup logic
 * and the hand-maintained SQL dump. Every later change must be a new migration.
 */
module.exports = {
  async up(queryInterface, Sequelize) {
    const { INTEGER, STRING, TEXT, BOOLEAN, DATE, ENUM, CHAR, TINYINT, JSON } = Sequelize;
    const id = { type: INTEGER, autoIncrement: true, primaryKey: true, allowNull: false };
    const timestamps = {
      createdAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updatedAt: { type: DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    };
    const fk = (table, onDelete, allowNull = true) => ({
      type: INTEGER,
      allowNull,
      references: { model: table, key: 'id' },
      onUpdate: 'CASCADE',
      onDelete,
    });

    await queryInterface.createTable('departments', {
      id,
      name: { type: STRING(120), allowNull: false, unique: true },
      isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
      ...timestamps,
    });

    await queryInterface.createTable('categories', {
      id,
      libelle: { type: STRING(100), allowNull: false, unique: true },
      ...timestamps,
    });

    await queryInterface.createTable('superAdmins', {
      id,
      login: { type: STRING(60), allowNull: false, unique: true },
      password: { type: STRING(100), allowNull: false },
      displayName: { type: STRING(100), allowNull: true },
      // owner: full access (admins, departments, deletions); agent: day-to-day work.
      role: { type: ENUM('owner', 'agent'), allowNull: false, defaultValue: 'agent' },
      // When set, the agent only sees tickets from this department.
      departmentId: fk('departments', 'SET NULL'),
      isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
      lastLoginAt: { type: DATE, allowNull: true },
      ...timestamps,
    });

    await queryInterface.createTable('users', {
      id,
      login: { type: STRING(100), allowNull: false, unique: true },
      email: { type: STRING(255), allowNull: true },
      password: { type: STRING(100), allowNull: false },
      firstname: { type: STRING(100), allowNull: false },
      lastname: { type: STRING(100), allowNull: false },
      GC: { type: BOOLEAN, allowNull: false, defaultValue: false },
      // Deleting a category must never delete students: RESTRICT.
      categorieId: fk('categories', 'RESTRICT'),
      isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
      mustChangePassword: { type: BOOLEAN, allowNull: false, defaultValue: false },
      lastLoginAt: { type: DATE, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('users', ['categorieId']);

    await queryInterface.createTable('sessions', {
      id,
      // SHA-256 of the issued token; the token itself is never stored.
      tokenHash: { type: CHAR(64), allowNull: false, unique: true },
      subjectType: { type: ENUM('user', 'superadmin'), allowNull: false },
      subjectId: { type: INTEGER, allowNull: false },
      expiresAt: { type: DATE, allowNull: false },
      revokedAt: { type: DATE, allowNull: true },
      userAgent: { type: STRING(255), allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('sessions', ['subjectType', 'subjectId']);
    await queryInterface.addIndex('sessions', ['expiresAt']);

    await queryInterface.createTable('news', {
      id,
      titre: { type: STRING(200), allowNull: false },
      description: { type: TEXT, allowNull: false },
      status: { type: ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
      // Visible from this instant (scheduling). NULL = immediately.
      publishAt: { type: DATE, allowNull: true },
      notifiedAt: { type: DATE, allowNull: true },
      pinned: { type: BOOLEAN, allowNull: false, defaultValue: false },
      audienceAll: { type: BOOLEAN, allowNull: false, defaultValue: true },
      eventStart: { type: DATE, allowNull: true },
      eventEnd: { type: DATE, allowNull: true },
      location: { type: STRING(200), allowNull: true },
      superAdminId: fk('superAdmins', 'SET NULL'),
      ...timestamps,
    });
    await queryInterface.addIndex('news', ['status', 'publishAt']);
    await queryInterface.addIndex('news', ['eventStart']);
    await queryInterface.addIndex('news', ['pinned', 'createdAt']);

    await queryInterface.createTable('newsCategories', {
      newsId: { ...fk('news', 'CASCADE', false), primaryKey: true },
      categorieId: { ...fk('categories', 'RESTRICT', false), primaryKey: true },
      createdAt: timestamps.createdAt,
    });
    await queryInterface.addIndex('newsCategories', ['categorieId']);

    await queryInterface.createTable('newsMedia', {
      id,
      newsId: fk('news', 'CASCADE', false),
      path: { type: STRING(255), allowNull: false },
      originalName: { type: STRING(255), allowNull: false },
      mimeType: { type: STRING(100), allowNull: false },
      size: { type: INTEGER, allowNull: false },
      kind: { type: ENUM('image', 'video', 'document'), allowNull: false },
      position: { type: INTEGER, allowNull: false, defaultValue: 0 },
      ...timestamps,
    });
    await queryInterface.addIndex('newsMedia', ['newsId', 'position']);

    await queryInterface.createTable('tickets', {
      id,
      title: { type: STRING(150), allowNull: false },
      description: { type: TEXT, allowNull: false },
      status: { type: ENUM('open', 'in_progress', 'closed'), allowNull: false, defaultValue: 'open' },
      priority: { type: ENUM('low', 'normal', 'high', 'urgent'), allowNull: false, defaultValue: 'normal' },
      departmentId: fk('departments', 'RESTRICT', false),
      userId: fk('users', 'SET NULL'),
      assignedToId: fk('superAdmins', 'SET NULL'),
      firstResponseAt: { type: DATE, allowNull: true },
      closedAt: { type: DATE, allowNull: true },
      rating: { type: TINYINT, allowNull: true },
      ratingComment: { type: STRING(500), allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('tickets', ['status']);
    await queryInterface.addIndex('tickets', ['departmentId']);
    await queryInterface.addIndex('tickets', ['userId']);
    await queryInterface.addIndex('tickets', ['assignedToId']);
    await queryInterface.addIndex('tickets', ['createdAt']);
    await queryInterface.addIndex('tickets', ['closedAt']);

    await queryInterface.createTable('ticketMessages', {
      id,
      ticketId: fk('tickets', 'CASCADE', false),
      content: { type: TEXT, allowNull: false },
      senderRole: { type: ENUM('user', 'superadmin', 'system'), allowNull: false },
      senderName: { type: STRING(100), allowNull: false },
      userId: fk('users', 'SET NULL'),
      superAdminId: fk('superAdmins', 'SET NULL'),
      // Internal notes are visible to staff only.
      isInternal: { type: BOOLEAN, allowNull: false, defaultValue: false },
      userReadAt: { type: DATE, allowNull: true },
      attachmentPath: { type: STRING(255), allowNull: true },
      attachmentName: { type: STRING(255), allowNull: true },
      attachmentMime: { type: STRING(100), allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('ticketMessages', ['ticketId', 'createdAt']);
    await queryInterface.addIndex('ticketMessages', ['ticketId', 'senderRole', 'userReadAt']);

    // Per-admin read cursor (one admin reading no longer marks it read for
    // all). A message id rather than a timestamp: DATETIME has 1 s precision.
    await queryInterface.createTable('ticketReads', {
      ticketId: { ...fk('tickets', 'CASCADE', false), primaryKey: true },
      superAdminId: { ...fk('superAdmins', 'CASCADE', false), primaryKey: true },
      lastReadMessageId: { type: INTEGER, allowNull: false, defaultValue: 0 },
    });

    await queryInterface.createTable('assistantMessages', {
      id,
      userId: fk('users', 'CASCADE', false),
      role: { type: ENUM('user', 'assistant'), allowNull: false },
      content: { type: TEXT, allowNull: false },
      sources: { type: JSON, allowNull: true },
      ...timestamps,
    });
    await queryInterface.addIndex('assistantMessages', ['userId', 'createdAt']);

    await queryInterface.createTable('pushTokens', {
      id,
      userId: fk('users', 'CASCADE', false),
      token: { type: STRING(255), allowNull: false, unique: true },
      platform: { type: STRING(20), allowNull: true },
      ...timestamps,
    });
  },

  async down(queryInterface) {
    for (const table of [
      'pushTokens', 'assistantMessages', 'ticketReads', 'ticketMessages', 'tickets',
      'newsMedia', 'newsCategories', 'news', 'sessions', 'users', 'superAdmins',
      'categories', 'departments',
    ]) {
      await queryInterface.dropTable(table);
    }
  },
};
