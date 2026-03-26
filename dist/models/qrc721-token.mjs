export default (sequelize, Sequelize) => {
  const {
    CHAR
  } = Sequelize;
  let Qrc721Token = sequelize.define('qrc721_token', {
    contractAddress: {
      type: CHAR(20).BINARY,
      primaryKey: true
    },
    tokenId: {
      type: CHAR(32).BINARY,
      primaryKey: true
    },
    holder: CHAR(20).BINARY
  }, {
    freezeTableName: true,
    underscored: true,
    timestamps: false
  });
  Qrc721Token.associate = models => {
    const {
      Contract
    } = models;
    Contract.hasMany(Qrc721Token, {
      as: 'qrc721Tokens',
      foreignKey: 'contractAddress'
    });
    Qrc721Token.belongsTo(Contract, {
      as: 'contract',
      foreignKey: 'contractAddress'
    });
  };
  return Qrc721Token;
};