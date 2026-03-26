import axios from 'axios';
export class MiscService {
  constructor({
    app,
    db,
    sql,
    services
  }) {
    this.app = app;
    this.db = db;
    this.sql = sql;
    this.services = services;
  }
  async classify(id, transaction) {
    const {
      Block,
      Transaction,
      Contract,
      Qrc20: QRC20
    } = this.db;
    const {
      or: $or,
      like: $like
    } = this.db.Sequelize.Op;
    const {
      Address
    } = this.app.explorerDaemon.lib;
    const sql = this.sql;
    if (/^(0|[1-9]\d{0,9})$/.test(id)) {
      let height = Number.parseInt(id);
      if (height <= this.app.blockchainInfo.tip.height) {
        return {
          type: 'block'
        };
      }
    }
    if (/^[0-9a-f]{64}$/i.test(id)) {
      if (await Block.findOne({
        where: {
          hash: Buffer.from(id, 'hex')
        },
        attributes: ['height']
      })) {
        return {
          type: 'block'
        };
      } else if (await Transaction.findOne({
        where: {
          id: Buffer.from(id, 'hex')
        },
        attributes: ['_id'],
        transaction
      })) {
        return {
          type: 'transaction'
        };
      }
    }
    try {
      let address = Address.fromString(id, this.app.chain);
      if ([Address.CONTRACT, Address.EVM_CONTRACT].includes(address.type)) {
        let contract = await Contract.findOne({
          where: {
            address: address.data
          },
          attributes: ['address'],
          transaction
        });
        if (contract) {
          return {
            type: 'contract'
          };
        }
      } else {
        return {
          type: 'address'
        };
      }
    } catch (err) {}
    let qrc20Results = (await QRC20.findAll({
      where: {
        [$or]: [this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('name USING utf8mb4'))), id.toLowerCase()), this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('symbol USING utf8mb4'))), id.toLowerCase())]
      },
      attributes: ['contractAddress'],
      transaction
    })).map(qrc20 => qrc20.contractAddress);
    if (qrc20Results.length === 0) {
      qrc20Results = (await QRC20.findAll({
        where: {
          [$or]: [this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('name USING utf8mb4'))), {
            [$like]: ['', ...id.toLowerCase(), ''].join('%')
          }), this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('name USING utf8mb4'))), {
            [$like]: `%${id.toLowerCase()}%`
          }), this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('symbol USING utf8mb4'))), {
            [$like]: ['', ...id.toLowerCase(), ''].join('%')
          }), this.db.sequelize.where(this.db.sequelize.fn('LOWER', this.db.sequelize.fn('CONVERT', this.db.sequelize.literal('symbol USING utf8mb4'))), {
            [$like]: `%${id.toLowerCase()}%`
          })]
        },
        attributes: ['contractAddress'],
        transaction
      })).map(qrc20 => qrc20.contractAddress);
    }
    if (qrc20Results.length) {
      let [{
        addressHex
      }] = await this.db.sequelize.query(sql`
        SELECT contract.address_string AS address, contract.address AS addressHex FROM (
          SELECT contract_address FROM qrc20_statistics
          WHERE contract_address IN ${qrc20Results}
          ORDER BY transactions DESC LIMIT 1
        ) qrc20_balance
        INNER JOIN contract ON contract.address = qrc20_balance.contract_address
      `, {
        type: this.db.sequelize.QueryTypes.SELECT,
        transaction
      });
      return {
        type: 'contract',
        address: addressHex.toString('hex'),
        addressHex: addressHex.toString('hex')
      };
    }
    return {};
  }
  async getPrices() {
    let apiKey = this.app.config.cmcAPIKey;
    if (!apiKey) {
      return {};
    }
    const coinId = 1684;
    let [USDResult, CNYResult] = await Promise.all([axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json'
      },
      params: {
        id: coinId,
        convert: 'USD'
      }
    }), axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/quotes/latest', {
      headers: {
        'X-CMC_PRO_API_KEY': apiKey,
        Accept: 'application/json'
      },
      params: {
        id: coinId,
        convert: 'CNY'
      }
    })]);
    return {
      USD: USDResult.data.data[coinId].quote.USD.price,
      CNY: CNYResult.data.data[coinId].quote.CNY.price
    };
  }
}