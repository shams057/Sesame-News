module.exports = (sequelize, Datatype) => {
  const ticket = sequelize.define('ticket', {
    title: {
      type: Datatype.STRING(150),
      allowNull: false,
    },
    description: {
      type: Datatype.TEXT,
      allowNull: true,
    },
    status: {
      type: Datatype.ENUM('open', 'in_progress', 'closed'),
      allowNull: false,
      defaultValue: 'open',
    },
    department: {
      type: Datatype.STRING(60),
      allowNull: false,
    },
    openedAt: {
      type: Datatype.DATE,
      allowNull: true,
    },
    closedAt: {
      type: Datatype.DATE,
      allowNull: true,
    },
    userId: {
      type: Datatype.INTEGER,
      allowNull: true,
    },
  });

  ticket.associate = (models) => {
    ticket.belongsTo(models.user, {
      foreignKey: 'userId',
      onDelete: 'SET NULL',
    });
  };

  return ticket;
};
