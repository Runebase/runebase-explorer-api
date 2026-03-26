export default (sequelize, Sequelize) => {
  const {
    INTEGER,
    BIGINT,
    CHAR,
    STRING,
    BLOB
  } = Sequelize;
  let EvmReceiptLog = sequelize.define('evm_receipt_log', {
    _id: {
      type: BIGINT.UNSIGNED,
      field: '_id',
      primaryKey: true,
      autoIncrement: true
    },
    receiptId: BIGINT.UNSIGNED,
    logIndex: INTEGER.UNSIGNED,
    blockHeight: INTEGER.UNSIGNED,
    address: CHAR(20).BINARY,
    topic1: {
      type: STRING(32).BINARY,
      allowNull: true
    },
    topic2: {
      type: STRING(32).BINARY,
      allowNull: true
    },
    topic3: {
      type: STRING(32).BINARY,
      allowNull: true
    },
    topic4: {
      type: STRING(32).BINARY,
      allowNull: true
    },
    data: BLOB
  }, {
    freezeTableName: true,
    underscored: true,
    timestamps: false
  });
  EvmReceiptLog.associate = models => {
    const {
      EvmReceipt
    } = models;
    EvmReceipt.hasMany(EvmReceiptLog, {
      as: 'logs',
      foreignKey: 'receiptId'
    });
    EvmReceiptLog.belongsTo(EvmReceipt, {
      as: 'receipt',
      foreignKey: 'receiptId'
    });
  };
  return EvmReceiptLog;
};