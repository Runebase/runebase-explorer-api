export default (sequelize, Sequelize) => {
  const { CHAR, TEXT, ENUM } = Sequelize

  let Contract = sequelize.define('contract', {
    address: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    addressString: CHAR(34),
    vm: {
      type: ENUM,
      values: ['evm', 'x86']
    },
    type: {
      type: ENUM,
      values: ['dgp', 'qrc20', 'qrc721'],
      allowNull: true
    },
    description: {
      type: TEXT,
      defaultValue: ''
    }
  }, { freezeTableName: true, underscored: true, timestamps: false })

  Contract.associate = (models) => {
    const { Address, EvmReceipt, EvmReceiptLog } = models
    Contract.hasOne(Address, { as: 'originalAddress', foreignKey: 'data' })
    Address.belongsTo(Contract, { as: 'contract', foreignKey: 'data' })
    EvmReceipt.belongsTo(Contract, { as: 'contract', foreignKey: 'contractAddress' })
    Contract.hasMany(EvmReceipt, { as: 'evmReceipts', foreignKey: 'contractAddress' })
    EvmReceiptLog.belongsTo(Contract, { as: 'contract', foreignKey: 'address' })
    Contract.hasMany(EvmReceiptLog, { as: 'evmLogs', foreignKey: 'address' })
  }

  return Contract
}
