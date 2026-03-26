export default (sequelize, Sequelize) => {
  const {
    BIGINT
  } = Sequelize;
  let RichList = sequelize.define('rich_list', {
    addressId: {
      type: BIGINT.UNSIGNED,
      primaryKey: true
    },
    balance: {
      type: BIGINT,
      get() {
        let balance = this.getDataValue('balance');
        return balance == null ? null : BigInt(balance);
      },
      set(balance) {
        this.setDataValue('balance', balance.toString());
      }
    }
  }, {
    freezeTableName: true,
    underscored: true,
    timestamps: false
  });
  RichList.associate = models => {
    const {
      Address
    } = models;
    Address.hasOne(RichList, {
      as: 'balance',
      foreignKey: 'addressId'
    });
    RichList.belongsTo(Address, {
      as: 'address',
      foreignKey: 'addressId'
    });
  };
  return RichList;
};