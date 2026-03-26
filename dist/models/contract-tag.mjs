export default (sequelize, Sequelize) => {
  const {
    BIGINT,
    CHAR,
    STRING
  } = Sequelize;
  let ContractTag = sequelize.define('contract_tag', {
    _id: {
      type: BIGINT.UNSIGNED,
      field: '_id',
      primaryKey: true
    },
    contractAddress: CHAR(20).BINARY,
    tag: STRING(32)
  }, {
    freezeTableName: true,
    underscored: true,
    timestamps: false
  });
  ContractTag.associate = models => {
    const {
      Contract
    } = models;
    Contract.hasMany(ContractTag, {
      as: 'tags',
      foreignKey: 'contractAddress'
    });
    ContractTag.belongsTo(Contract, {
      as: 'contract',
      foreignKey: 'contractAddress'
    });
  };
  return ContractTag;
};