export class StatisticsService {
  constructor({ app, db, sql, services }) {
    this.app = app
    this.db = db
    this.sql = sql
    this.services = services
  }

  async getDailyTransactions(transaction) {
    const { sql } = this
    let result = await this.db.sequelize.query(sql`
      SELECT
        FLOOR(header.timestamp / 86400) AS date,
        SUM(block.transactions_count) AS transactionsCount,
        SUM(block.contract_transactions_count) AS contractTransactionsCount
      FROM header, block
      WHERE header.height = block.height
      GROUP BY date
      ORDER BY date ASC
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    return result.map(({ date, transactionsCount, contractTransactionsCount }) => ({
      timestamp: date * 86400,
      transactionsCount,
      contractTransactionsCount
    }))
  }

  async getBlockIntervalStatistics(transaction) {
    const { sql } = this
    let result = await this.db.sequelize.query(sql`
      SELECT header.timestamp - prev_header.timestamp AS blockInterval, COUNT(*) AS count FROM header
      INNER JOIN header prev_header ON prev_header.height = header.height - 1
      WHERE header.height > 5001
      GROUP BY blockInterval
      ORDER BY blockInterval ASC
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    let total = this.app.blockchainInfo.tip.height - 5001
    return result.map(({ blockInterval, count }) => ({ interval: blockInterval, count, percentage: count / total }))
  }

  async getAddressGrowth(transaction) {
    const { Address } = this.db
    const { sql } = this
    let result = await this.db.sequelize.query(sql`
      SELECT FLOOR(header.timestamp / 86400) AS date, COUNT(*) AS count FROM address, header
      WHERE address.create_height = header.height AND address.type < ${Address.parseType('contract')}
      GROUP BY date
      ORDER BY date ASC
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    let sum = 0
    return result.map(({ date, count }) => {
      sum += count
      return {
        timestamp: date * 86400,
        count: sum
      }
    })
  }
}
