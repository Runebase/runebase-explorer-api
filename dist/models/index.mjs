import { Sequelize } from 'sequelize';
import config from '../config/index.mjs';
import logger from '../utils/logger.mjs';
import defineHeader from './header.mjs';
import defineAddress from './address.mjs';
import defineBlock from './block.mjs';
import defineTransaction from './transaction.mjs';
import defineTransactionInput from './transaction-input.mjs';
import defineTransactionOutput from './transaction-output.mjs';
import defineWitness from './witness.mjs';
import defineBalanceChange from './balance-change.mjs';
import defineContract from './contract.mjs';
import defineContractCode from './contract-code.mjs';
import defineContractSpend from './contract-spend.mjs';
import defineContractTag from './contract-tag.mjs';
import defineEvmReceipt from './evm-receipt.mjs';
import defineEvmReceiptLog from './evm-receipt-log.mjs';
import defineGasRefund from './gas-refund.mjs';
import defineQrc20 from './qrc20.mjs';
import defineQrc20Balance from './qrc20-balance.mjs';
import defineQrc20Statistics from './qrc20-statistics.mjs';
import defineQrc721 from './qrc721.mjs';
import defineQrc721Token from './qrc721-token.mjs';
import defineRichList from './rich-list.mjs';
const db = {};
async function initDatabase() {
  const sequelize = new Sequelize(config.db.database, config.db.username, config.db.password, {
    host: config.db.host,
    port: config.db.port,
    dialect: config.db.dialect,
    logging: config.db.logging,
    define: {
      freezeTableName: true,
      underscored: true,
      timestamps: false
    }
  });
  const models = {
    Header: defineHeader(sequelize, Sequelize),
    Address: defineAddress(sequelize, Sequelize),
    Block: defineBlock(sequelize, Sequelize),
    Transaction: defineTransaction(sequelize, Sequelize),
    TransactionInput: defineTransactionInput(sequelize, Sequelize),
    TransactionOutput: defineTransactionOutput(sequelize, Sequelize),
    Witness: defineWitness(sequelize, Sequelize),
    BalanceChange: defineBalanceChange(sequelize, Sequelize),
    Contract: defineContract(sequelize, Sequelize),
    ContractCode: defineContractCode(sequelize, Sequelize),
    ContractSpend: defineContractSpend(sequelize, Sequelize),
    ContractTag: defineContractTag(sequelize, Sequelize),
    EvmReceipt: defineEvmReceipt(sequelize, Sequelize),
    EvmReceiptLog: defineEvmReceiptLog(sequelize, Sequelize),
    GasRefund: defineGasRefund(sequelize, Sequelize),
    Qrc20: defineQrc20(sequelize, Sequelize),
    Qrc20Balance: defineQrc20Balance(sequelize, Sequelize),
    Qrc20Statistics: defineQrc20Statistics(sequelize, Sequelize),
    Qrc721: defineQrc721(sequelize, Sequelize),
    Qrc721Token: defineQrc721Token(sequelize, Sequelize),
    RichList: defineRichList(sequelize, Sequelize)
  };
  for (let modelName of Object.keys(models)) {
    if (models[modelName].associate) {
      models[modelName].associate(models);
    }
  }
  db.sequelize = sequelize;
  db.Sequelize = Sequelize;
  Object.assign(db, models);
  try {
    await sequelize.authenticate();
    logger.info('Database connection established successfully');
  } catch (err) {
    logger.error({
      err
    }, 'Unable to connect to database');
    throw err;
  }
  return db;
}
export { db, initDatabase };
export default db;