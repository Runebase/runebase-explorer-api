export default (sequelize, Sequelize) => {
  const { BIGINT } = Sequelize

  let ContractSpend = sequelize.define('contract_spend', {
    sourceId: {
      type: BIGINT.UNSIGNED,
      primaryKey: true
    },
    destId: BIGINT.UNSIGNED
  }, { freezeTableName: true, underscored: true, timestamps: false })

  ContractSpend.associate = (models) => {
    const { Transaction } = models
    Transaction.hasOne(ContractSpend, { as: 'contractSpendSource', foreignKey: 'sourceId' })
    ContractSpend.belongsTo(Transaction, { as: 'sourceTransaction', foreignKey: 'sourceId' })
    Transaction.hasMany(ContractSpend, { as: 'contractSpendDests', foreignKey: 'destId' })
    ContractSpend.belongsTo(Transaction, { as: 'destTransaction', foreignKey: 'destId' })
  }

  return ContractSpend
}
