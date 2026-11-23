'use strict';

const { Sequelize, DataTypes } = require('sequelize');
const env = require('../config/env');
const dbConfig = require('../config/database')[env.NODE_ENV];

const sequelize = new Sequelize(dbConfig.database, dbConfig.username, dbConfig.password, dbConfig);

const { INTEGER, STRING, TEXT, BOOLEAN, DATE, ENUM, CHAR, TINYINT, JSON } = DataTypes;

// ─── Reference data ─────────────────────────────────────────────────────────
const Department = sequelize.define('department', {
  name: { type: STRING(120), allowNull: false, unique: true },
  isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
}, { tableName: 'departments' });

const Categorie = sequelize.define('categorie', {
  libelle: { type: STRING(100), allowNull: false, unique: true },
  departmentId: { type: INTEGER, allowNull: true },
}, { tableName: 'categories' });

// ─── Accounts ───────────────────────────────────────────────────────────────
const hidePassword = {
  defaultScope: { attributes: { exclude: ['password'] } },
  scopes: { withPassword: { attributes: { include: ['password'] } } },
};

const SuperAdmin = sequelize.define('superAdmin', {
  login: { type: STRING(60), allowNull: false, unique: true },
  password: { type: STRING(100), allowNull: false },
  displayName: { type: STRING(100), allowNull: true },
  role: { type: ENUM('owner', 'agent'), allowNull: false, defaultValue: 'agent' },
  departmentId: { type: INTEGER, allowNull: true },
  isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
  lastLoginAt: { type: DATE, allowNull: true },
}, { tableName: 'superAdmins', ...hidePassword });

const User = sequelize.define('user', {
  login: { type: STRING(100), allowNull: false, unique: true },
  email: { type: STRING(255), allowNull: true, validate: { isEmail: true } },
  password: { type: STRING(100), allowNull: false },
  firstname: { type: STRING(100), allowNull: false },
  lastname: { type: STRING(100), allowNull: false },
  categorieId: { type: INTEGER, allowNull: true },
  isActive: { type: BOOLEAN, allowNull: false, defaultValue: true },
  mustChangePassword: { type: BOOLEAN, allowNull: false, defaultValue: false },
  lastLoginAt: { type: DATE, allowNull: true },
}, { tableName: 'users', ...hidePassword });

const Session = sequelize.define('session', {
  tokenHash: { type: CHAR(64), allowNull: false, unique: true },
  subjectType: { type: ENUM('user', 'superadmin'), allowNull: false },
  subjectId: { type: INTEGER, allowNull: false },
  expiresAt: { type: DATE, allowNull: false },
  revokedAt: { type: DATE, allowNull: true },
  userAgent: { type: STRING(255), allowNull: true },
}, { tableName: 'sessions' });

// ─── News ───────────────────────────────────────────────────────────────────
const News = sequelize.define('news', {
  titre: { type: STRING(200), allowNull: false },
  description: { type: TEXT, allowNull: false },
  status: { type: ENUM('draft', 'published'), allowNull: false, defaultValue: 'published' },
  publishAt: { type: DATE, allowNull: true },
  notifiedAt: { type: DATE, allowNull: true },
  pinned: { type: BOOLEAN, allowNull: false, defaultValue: false },
  audienceAll: { type: BOOLEAN, allowNull: false, defaultValue: true },
  eventStart: { type: DATE, allowNull: true },
  eventEnd: { type: DATE, allowNull: true },
  location: { type: STRING(200), allowNull: true },
  expiresAt: { type: DATE, allowNull: true },
  superAdminId: { type: INTEGER, allowNull: true },
}, { tableName: 'news', freezeTableName: true });

const NewsCategorie = sequelize.define('newsCategorie', {
  newsId: { type: INTEGER, primaryKey: true },
  categorieId: { type: INTEGER, primaryKey: true },
}, { tableName: 'newsCategories', updatedAt: false });

const NewsMedia = sequelize.define('newsMedia', {
  newsId: { type: INTEGER, allowNull: false },
  path: { type: STRING(255), allowNull: false },
  originalName: { type: STRING(255), allowNull: false },
  mimeType: { type: STRING(100), allowNull: false },
  size: { type: INTEGER, allowNull: false },
  kind: { type: ENUM('image', 'video', 'document'), allowNull: false },
  position: { type: INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'newsMedia', freezeTableName: true });

const NewsView = sequelize.define('newsView', {
  newsId: { type: INTEGER, primaryKey: true },
  userId: { type: INTEGER, primaryKey: true },
  viewedAt: { type: DATE, allowNull: false, defaultValue: DataTypes.NOW },
}, { tableName: 'newsViews', timestamps: false });

const NewsBookmark = sequelize.define('newsBookmark', {
  newsId: { type: INTEGER, primaryKey: true },
  userId: { type: INTEGER, primaryKey: true },
}, { tableName: 'newsBookmarks', updatedAt: false });

// ─── Tickets ────────────────────────────────────────────────────────────────
const Ticket = sequelize.define('ticket', {
  title: { type: STRING(150), allowNull: false },
  description: { type: TEXT, allowNull: false },
  status: { type: ENUM('open', 'in_progress', 'closed'), allowNull: false, defaultValue: 'open' },
  priority: { type: ENUM('low', 'normal', 'high', 'urgent'), allowNull: false, defaultValue: 'normal' },
  departmentId: { type: INTEGER, allowNull: false },
  userId: { type: INTEGER, allowNull: true },
  assignedToId: { type: INTEGER, allowNull: true },
  firstResponseAt: { type: DATE, allowNull: true },
  closedAt: { type: DATE, allowNull: true },
  rating: { type: TINYINT, allowNull: true, validate: { min: 1, max: 5 } },
  ratingComment: { type: STRING(500), allowNull: true },
}, { tableName: 'tickets' });

const TicketMessage = sequelize.define('ticketMessage', {
  ticketId: { type: INTEGER, allowNull: false },
  content: { type: TEXT, allowNull: false },
  senderRole: { type: ENUM('user', 'superadmin', 'system'), allowNull: false },
  senderName: { type: STRING(100), allowNull: false },
  userId: { type: INTEGER, allowNull: true },
  superAdminId: { type: INTEGER, allowNull: true },
  isInternal: { type: BOOLEAN, allowNull: false, defaultValue: false },
  userReadAt: { type: DATE, allowNull: true },
  attachmentPath: { type: STRING(255), allowNull: true },
  attachmentName: { type: STRING(255), allowNull: true },
  attachmentMime: { type: STRING(100), allowNull: true },
}, { tableName: 'ticketMessages' });

const TicketRead = sequelize.define('ticketRead', {
  ticketId: { type: INTEGER, primaryKey: true },
  superAdminId: { type: INTEGER, primaryKey: true },
  lastReadMessageId: { type: INTEGER, allowNull: false, defaultValue: 0 },
}, { tableName: 'ticketReads', timestamps: false });

const CannedReply = sequelize.define('cannedReply', {
  title: { type: STRING(100), allowNull: false },
  content: { type: TEXT, allowNull: false },
  departmentId: { type: INTEGER, allowNull: true },
  createdById: { type: INTEGER, allowNull: true },
}, { tableName: 'cannedReplies' });

// ─── Assistant & push ───────────────────────────────────────────────────────
const AssistantMessage = sequelize.define('assistantMessage', {
  userId: { type: INTEGER, allowNull: false },
  role: { type: ENUM('user', 'assistant'), allowNull: false },
  content: { type: TEXT, allowNull: false },
  sources: { type: JSON, allowNull: true },
}, { tableName: 'assistantMessages' });

const PushToken = sequelize.define('pushToken', {
  userId: { type: INTEGER, allowNull: false },
  token: { type: STRING(255), allowNull: false, unique: true },
  platform: { type: STRING(20), allowNull: true },
}, { tableName: 'pushTokens' });

// ─── Associations (onDelete mirrors the migration) ──────────────────────────
Department.hasMany(SuperAdmin, { foreignKey: 'departmentId' });
SuperAdmin.belongsTo(Department, { foreignKey: 'departmentId', onDelete: 'SET NULL' });
// Each student class belongs to a department; its admins manage those students.
Department.hasMany(Categorie, { foreignKey: 'departmentId', as: 'classes' });
Categorie.belongsTo(Department, { foreignKey: 'departmentId', as: 'department', onDelete: 'SET NULL' });

Categorie.hasMany(User, { foreignKey: 'categorieId', onDelete: 'RESTRICT' });
User.belongsTo(Categorie, { foreignKey: 'categorieId' });

SuperAdmin.hasMany(News, { foreignKey: 'superAdminId', as: 'news' });
News.belongsTo(SuperAdmin, { foreignKey: 'superAdminId', as: 'author', onDelete: 'SET NULL' });
News.belongsToMany(Categorie, { through: NewsCategorie, foreignKey: 'newsId', otherKey: 'categorieId', as: 'categories' });
Categorie.belongsToMany(News, { through: NewsCategorie, foreignKey: 'categorieId', otherKey: 'newsId', as: 'news' });
News.hasMany(NewsMedia, { foreignKey: 'newsId', as: 'media', onDelete: 'CASCADE' });
NewsMedia.belongsTo(News, { foreignKey: 'newsId' });

Ticket.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
Ticket.belongsTo(User, { foreignKey: 'userId', as: 'user' });
Ticket.belongsTo(SuperAdmin, { foreignKey: 'assignedToId', as: 'assignedTo' });
User.hasMany(Ticket, { foreignKey: 'userId' });
Ticket.hasMany(TicketMessage, { foreignKey: 'ticketId', as: 'messages', onDelete: 'CASCADE' });
TicketMessage.belongsTo(Ticket, { foreignKey: 'ticketId' });
Ticket.hasMany(TicketRead, { foreignKey: 'ticketId', onDelete: 'CASCADE' });

CannedReply.belongsTo(Department, { foreignKey: 'departmentId', as: 'department' });
News.hasMany(NewsView, { foreignKey: 'newsId', onDelete: 'CASCADE' });
News.hasMany(NewsBookmark, { foreignKey: 'newsId', onDelete: 'CASCADE' });

User.hasMany(AssistantMessage, { foreignKey: 'userId', onDelete: 'CASCADE' });
User.hasMany(PushToken, { foreignKey: 'userId', onDelete: 'CASCADE' });

module.exports = {
  sequelize,
  Sequelize,
  Department,
  Categorie,
  SuperAdmin,
  User,
  Session,
  News,
  NewsCategorie,
  NewsMedia,
  NewsView,
  NewsBookmark,
  CannedReply,
  Ticket,
  TicketMessage,
  TicketRead,
  AssistantMessage,
  PushToken,
};
