export default (sequelize, Sequelize) => {
  const { INTEGER, CHAR, BLOB } = Sequelize

  let Witness = sequelize.define('witness', {
    transactionId: {
      type: CHAR(32).BINARY,
      primaryKey: true
    },
    inputIndex: {
      type: INTEGER.UNSIGNED,
      primaryKey: true
    },
    witnessIndex: {
      type: INTEGER.UNSIGNED,
      primaryKey: true
    },
    script: BLOB
  }, { freezeTableName: true, underscored: true, timestamps: false })

  Witness.associate = (models) => {
    const { Transaction } = models
    Transaction.hasMany(Witness, { as: 'witnesses', foreignKey: 'transactionId', sourceKey: 'id' })
    Witness.belongsTo(Transaction, { foreignKey: 'transactionId', targetKey: 'id' })
  }

  return Witness
}
