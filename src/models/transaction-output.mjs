export default (sequelize, Sequelize) => {
  const { INTEGER, BIGINT, BOOLEAN, BLOB } = Sequelize

  let TransactionOutput = sequelize.define('transaction_output', {
    transactionId: {
      type: BIGINT.UNSIGNED,
      primaryKey: true
    },
    outputIndex: {
      type: INTEGER.UNSIGNED,
      primaryKey: true
    },
    scriptPubKey: {
      type: BLOB('medium'),
      field: 'scriptpubkey'
    },
    blockHeight: INTEGER.UNSIGNED,
    value: {
      type: BIGINT,
      get() {
        let value = this.getDataValue('value')
        return value == null ? null : BigInt(value)
      },
      set(value) {
        this.setDataValue('value', value.toString())
      }
    },
    addressId: BIGINT.UNSIGNED,
    isStake: BOOLEAN,
    inputId: BIGINT.UNSIGNED,
    inputIndex: INTEGER.UNSIGNED,
    inputHeight: {
      type: INTEGER.UNSIGNED,
      allowNull: true
    }
  }, { freezeTableName: true, underscored: true, timestamps: false })

  TransactionOutput.associate = (models) => {
    const { Address, Transaction, TransactionInput } = models
    Transaction.hasMany(TransactionOutput, { as: 'outputs', foreignKey: 'transactionId' })
    TransactionOutput.belongsTo(Transaction, { as: 'outputTransaction', foreignKey: 'transactionId' })
    TransactionOutput.belongsTo(Transaction, { as: 'inputTransaction', foreignKey: 'inputId' })
    TransactionOutput.belongsTo(TransactionInput, { as: 'input', foreignKey: 'inputId' })
    Address.hasMany(TransactionOutput, { as: 'outputTxos', foreignKey: 'addressId' })
    TransactionOutput.belongsTo(Address, { as: 'address', foreignKey: 'addressId' })
  }

  return TransactionOutput
}
