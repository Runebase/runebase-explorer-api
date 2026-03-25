export default (sequelize, Sequelize) => {
  const { CHAR } = Sequelize

  let Qrc20Balance = sequelize.define('qrc20_balance', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    address: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    balance: {
      type: CHAR(32).BINARY,
      get() {
        let balance = this.getDataValue('balance')
        return balance == null ? null : BigInt(`0x${balance.toString('hex')}`)
      },
      set(balance) {
        this.setDataValue(
          'balance',
          Buffer.from(balance.toString(16).padStart(64, '0'), 'hex')
        )
      }
    }
  }, { freezeTableName: true, underscored: true, timestamps: false })

  Qrc20Balance.associate = (models) => {
    const { Contract } = models
    Contract.hasMany(Qrc20Balance, { as: 'qrc20Balances', foreignKey: 'contractAddress' })
    Qrc20Balance.belongsTo(Contract, { as: 'contract', foreignKey: 'contractAddress' })
  }

  return Qrc20Balance
}
