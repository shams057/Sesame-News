module.exports = (sequelize, DataType) => {
  const ticketMessage = sequelize.define('ticketMessage', {
    content: {
      type: DataType.TEXT,
      allowNull: false,
    },
    senderRole: {
      type: DataType.ENUM('user', 'superadmin'),
      allowNull: false,
    },
    senderName: {
      type: DataType.STRING(100),
      allowNull: false,
    },
    userReadAt: {
      type: DataType.DATE,
      allowNull: true,
    },
    adminReadAt: {
      type: DataType.DATE,
      allowNull: true,
    },
  });

  ticketMessage.associate = (models) => {
    ticketMessage.belongsTo(models.ticket, { foreignKey: { allowNull: false }, onDelete: 'CASCADE' });
    ticketMessage.belongsTo(models.user, { foreignKey: { allowNull: true }, onDelete: 'SET NULL' });
    ticketMessage.belongsTo(models.superAdmin, { foreignKey: { allowNull: true }, onDelete: 'SET NULL' });
  };

  return ticketMessage;
};
