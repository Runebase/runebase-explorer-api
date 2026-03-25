export default (sequelize, Sequelize) => {
  const { INTEGER, CHAR } = Sequelize

  let Qrc20Statistics = sequelize.define('qrc20_statistics', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    holders: INTEGER.UNSIGNED,
    transactions: INTEGER.UNSIGNED
  }, { freezeTableName: true, underscored: true, timestamps: false })

  Qrc20Statistics.associate = (models) => {
    const { Qrc20 } = models
    Qrc20Statistics.belongsTo(Qrc20, { as: 'qrc20', foreignKey: 'contractAddress' })
    Qrc20.hasOne(Qrc20Statistics, { as: 'statistics', foreignKey: 'contractAddress' })
  }

  return Qrc20Statistics
}
