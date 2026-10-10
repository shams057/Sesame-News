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
      type: Datatype.ENUM('open', 'closed'),
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
  });
  return ticket;
};
