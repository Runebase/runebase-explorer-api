export default (sequelize, Sequelize) => {
  const { CHAR, BLOB, TEXT } = Sequelize

  let ContractCode = sequelize.define('contract_code', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    code: BLOB,
    source: {
      type: TEXT('long'),
      allowNull: true
    }
  }, { freezeTableName: true, underscored: true, timestamps: false })

  ContractCode.associate = (models) => {
    const { Contract } = models
    Contract.hasOne(ContractCode, { as: 'code', foreignKey: 'contractAddress' })
    ContractCode.belongsTo(Contract, { as: 'contract', foreignKey: 'contractAddress' })
  }

  return ContractCode
}
