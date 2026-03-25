export default (sequelize, Sequelize) => {
  const { INTEGER, CHAR, BLOB } = Sequelize

  let Qrc20 = sequelize.define('qrc20', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    name: {
      type: BLOB,
      get() {
        let name = this.getDataValue('name')
        return name == null ? null : name.toString()
      },
      set(name) {
        this.setDataValue('name', Buffer.from(name))
      }
    },
    symbol: {
      type: BLOB,
      get() {
        let symbol = this.getDataValue('symbol')
        return symbol == null ? null : symbol.toString()
      },
      set(symbol) {
        this.setDataValue('symbol', Buffer.from(symbol))
      }
    },
    decimals: INTEGER(3).UNSIGNED,
    totalSupply: {
      type: CHAR(32).BINARY,
      get() {
        let totalSupply = this.getDataValue('totalSupply')
        return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`)
      },
      set(totalSupply) {
        this.setDataValue(
          'totalSupply',
          Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex')
        )
      }
    },
    version: {
      type: BLOB,
      allowNull: true,
      get() {
        let version = this.getDataValue('version')
        return version == null ? null : version.toString()
      },
      set(version) {
        this.setDataValue('version', Buffer.from(version))
      }
    }
  }, { freezeTableName: true, underscored: true, timestamps: false })

  Qrc20.associate = (models) => {
    const { EvmReceiptLog, Contract } = models
    EvmReceiptLog.belongsTo(Qrc20, { as: 'qrc20', foreignKey: 'address', sourceKey: 'contractAddress' })
    Qrc20.hasMany(EvmReceiptLog, { as: 'logs', foreignKey: 'address', sourceKey: 'contractAddress' })
    Contract.hasOne(Qrc20, { as: 'qrc20', foreignKey: 'contractAddress' })
    Qrc20.belongsTo(Contract, { as: 'contract', foreignKey: 'contractAddress' })
  }

  return Qrc20
}
