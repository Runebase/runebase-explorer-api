export default (sequelize, Sequelize) => {
  const {
    CHAR,
    BLOB
  } = Sequelize;
  let Qrc721 = sequelize.define('qrc721', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    name: {
      type: BLOB,
      get() {
        return this.getDataValue('name').toString();
      },
      set(name) {
        this.setDataValue('name', Buffer.from(name));
      }
    },
    symbol: {
      type: BLOB,
      get() {
        return this.getDataValue('symbol').toString();
      },
      set(symbol) {
        this.setDataValue('symbol', Buffer.from(symbol));
      }
    },
    totalSupply: {
      type: CHAR(32).BINARY,
      get() {
        let totalSupply = this.getDataValue('totalSupply');
        return totalSupply == null ? null : BigInt(`0x${totalSupply.toString('hex')}`);
      },
      set(totalSupply) {
        this.setDataValue('totalSupply', Buffer.from(totalSupply.toString(16).padStart(64, '0'), 'hex'));
      }
    }
  }, {
    freezeTableName: true,
    underscored: true,
    timestamps: false
  });
  Qrc721.associate = models => {
    const {
      EvmReceiptLog,
      Contract
    } = models;
    EvmReceiptLog.belongsTo(Qrc721, {
      as: 'qrc721',
      foreignKey: 'address',
      sourceKey: 'contractAddress'
    });
    Qrc721.hasOne(EvmReceiptLog, {
      as: 'logs',
      foreignKey: 'address',
      sourceKey: 'contractAddress'
    });
    Contract.hasOne(Qrc721, {
      as: 'qrc721',
      foreignKey: 'contractAddress'
    });
    Qrc721.belongsTo(Contract, {
      as: 'contract',
      foreignKey: 'contractAddress'
    });
  };
  return Qrc721;
};