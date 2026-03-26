export class BalanceService {
  constructor({ app, db, sql, services }) {
    this.app = app
    this.db = db
    this.sql = sql
    this.services = services
  }

  async getBalance(ids, transaction) {
    const { TransactionOutput } = this.db
    const { in: $in, gt: $gt } = this.db.Sequelize.Op
    let result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: { [$in]: ids },
        blockHeight: { [$gt]: 0 },
        inputId: 0
      },
      transaction
    })
    return BigInt(result || 0)
  }

  async getTotalBalanceChanges(ids, transaction) {
    if (ids.length === 0) {
      return { totalReceived: 0n, totalSent: 0n }
    }

    const sql = this.sql
    let totalReceived
    let totalSent
    if (ids.length === 1) {
      let [result] = await this.db.sequelize.query(sql`
        SELECT
          SUM(CAST(GREATEST(value, 0) AS DECIMAL(24))) AS totalReceived,
          SUM(CAST(GREATEST(-value, 0) AS DECIMAL(24))) AS totalSent
        FROM balance_change WHERE address_id = ${ids[0]} AND block_height > 0
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
      totalReceived = result.totalReceived == null ? 0n : BigInt(result.totalReceived)
      totalSent = result.totalSent == null ? 0n : BigInt(result.totalSent)
    } else {
      let [result] = await this.db.sequelize.query(sql`
        SELECT
          SUM(CAST(GREATEST(value, 0) AS DECIMAL(24))) AS totalReceived,
          SUM(CAST(GREATEST(-value, 0) AS DECIMAL(24))) AS totalSent
        FROM (
          SELECT SUM(value) AS value FROM balance_change
          WHERE address_id IN ${ids} AND block_height > 0
          GROUP BY transaction_id
        ) AS temp
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
      totalReceived = result.totalReceived == null ? 0n : BigInt(result.totalReceived)
      totalSent = result.totalSent == null ? 0n : BigInt(result.totalSent)
    }
    return { totalReceived, totalSent }
  }

  async getUnconfirmedBalance(ids, transaction) {
    const { TransactionOutput } = this.db
    const { in: $in } = this.db.Sequelize.Op
    let result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: { [$in]: ids },
        blockHeight: 0xffffffff,
        inputHeight: null
      },
      transaction
    })
    return BigInt(result || 0)
  }

  async getStakingBalance(ids, transaction) {
    const { TransactionOutput } = this.db
    const { in: $in, gt: $gt } = this.db.Sequelize.Op
    let result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: { [$in]: ids },
        blockHeight: { [$gt]: this.app.blockchainInfo.tip.height - 500 },
        inputHeight: null,
        isStake: true
      },
      transaction
    })
    return BigInt(result || 0)
  }

  async getMatureBalance(ids, transaction) {
    const { TransactionOutput } = this.db
    const { in: $in, between: $between } = this.db.Sequelize.Op
    let result = await TransactionOutput.aggregate('value', 'SUM', {
      where: {
        addressId: { [$in]: ids },
        blockHeight: { [$between]: [1, this.app.blockchainInfo.tip.height - 500] },
        inputHeight: null
      },
      transaction
    })
    return BigInt(result || 0)
  }

  async getBalanceHistory(ids, { nonZero = false } = {}, pagination, transaction) {
    if (ids.length === 0) {
      return []
    }
    const sql = this.sql
    const { Header, Transaction, BalanceChange } = this.db
    const { in: $in, ne: $ne, gt: $gt } = this.db.Sequelize.Op
    let { limit, offset, reversed = true } = pagination
    let order = reversed ? 'DESC' : 'ASC'

    let totalCount
    let transactionIds
    let list
    if (ids.length === 1) {
      let valueFilter = nonZero ? { value: { [$ne]: 0 } } : {}
      totalCount = await BalanceChange.count({
        where: {
          addressId: ids[0],
          blockHeight: { [$gt]: 0 },
          ...valueFilter
        },
        distinct: true,
        col: 'transactionId',
        transaction
      })
      if (totalCount === 0) {
        return { totalCount: 0, transactions: [] }
      }
      transactionIds = (await BalanceChange.findAll({
        where: { addressId: ids[0], ...valueFilter },
        attributes: ['transactionId'],
        order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]],
        limit,
        offset,
        transaction
      })).map(({ transactionId }) => transactionId)
      list = await BalanceChange.findAll({
        where: { transactionId: { [$in]: transactionIds }, addressId: ids[0] },
        attributes: ['transactionId', 'blockHeight', 'indexInBlock', 'value'],
        include: [
          {
            model: Header,
            as: 'header',
            required: false,
            attributes: ['hash', 'timestamp']
          },
          {
            model: Transaction,
            as: 'transaction',
            required: true,
            attributes: ['id']
          }
        ],
        order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]],
        transaction
      })
    } else {
      let havingFilter = nonZero ? 'SUM(value) != 0' : null
      if (havingFilter) {
        let [{ count }] = await this.db.sequelize.query(sql`
          SELECT COUNT(*) AS count FROM (
            SELECT transaction_id FROM balance_change
            WHERE address_id IN ${ids} AND block_height > 0
            GROUP BY transaction_id
            HAVING ${{ raw: havingFilter }}
          ) list
        `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
        totalCount = count
      } else {
        totalCount = await BalanceChange.count({
          where: { addressId: { [$in]: ids }, blockHeight: { [$gt]: 0 } },
          distinct: true,
          col: 'transactionId',
          transaction
        })
      }
      if (totalCount === 0) {
        return { totalCount: 0, transactions: [] }
      }
      if (havingFilter) {
        transactionIds = (await this.db.sequelize.query(sql`
          SELECT MIN(block_height) AS block_height, MIN(index_in_block) AS index_in_block, transaction_id AS transactionId
          FROM balance_change
          WHERE address_id IN ${ids} AND block_height > 0
          GROUP BY transaction_id
          HAVING ${{ raw: havingFilter }}
          ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, transaction_id ${{ raw: order }}
          LIMIT ${offset}, ${limit}
        `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })).map(({ transactionId }) => transactionId)
      } else {
        transactionIds = (await BalanceChange.findAll({
          where: { addressId: { [$in]: ids } },
          attributes: ['transactionId'],
          order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order]],
          limit,
          offset,
          transaction
        })).map(({ transactionId }) => transactionId)
      }
      list = await this.db.sequelize.query(sql`
        SELECT
          transaction.id AS id, transaction.block_height AS blockHeight,
          transaction.index_in_block AS indexInBlock, transaction._id AS transactionId,
          header.hash AS blockHash, header.timestamp AS timestamp,
          list.value AS value
        FROM (
          SELECT MIN(block_height) AS block_height, MIN(index_in_block) AS index_in_block, transaction_id, SUM(value) AS value
          FROM balance_change
          WHERE transaction_id IN ${transactionIds} AND address_id IN ${ids}
          GROUP BY transaction_id
          ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, transaction_id ${{ raw: order }}
        ) list
        INNER JOIN transaction ON transaction._id = list.transaction_id
        LEFT JOIN header ON header.height = transaction.block_height
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    }

    if (reversed) {
      list = list.reverse()
    }
    let initialBalance = 0n
    if (list.length > 0) {
      let { blockHeight, indexInBlock, transactionId } = list[0]
      let [{ value }] = await this.db.sequelize.query(sql`
        SELECT SUM(value) AS value FROM balance_change
        WHERE address_id IN ${ids}
          AND (block_height, index_in_block, transaction_id) < (${blockHeight}, ${indexInBlock}, ${transactionId})
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
      initialBalance = BigInt(value || 0n)
    }
    let transactions = list.map(item => ({
      id: item.id || item.transaction.id,
      ...item.header ? {
        block: {
          hash: item.header.hash,
          height: item.blockHeight,
          timestamp: item.header.timestamp
        }
      } : {},
      ...item.blockHash ? {
        block: {
          hash: item.blockHash,
          height: item.blockHeight,
          timestamp: item.timestamp
        }
      } : {},
      amount: BigInt(item.value),
    }))
    for (let tx of transactions) {
      tx.balance = initialBalance += tx.amount
    }
    if (reversed) {
      transactions = transactions.reverse()
    }
    return { totalCount, transactions }
  }

  async getRichList(pagination, transaction) {
    const sql = this.sql
    const { RichList } = this.db
    let { limit, offset } = pagination
    let totalCount = await RichList.count({ transaction })
    let list = await this.db.sequelize.query(sql`
      SELECT address.string AS address, rich_list.balance AS balance
      FROM (SELECT address_id FROM rich_list ORDER BY balance DESC LIMIT ${offset}, ${limit}) list
      INNER JOIN rich_list USING (address_id)
      INNER JOIN address ON address._id = list.address_id
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    return {
      totalCount,
      list: list.map(item => ({
        address: item.address,
        balance: BigInt(item.balance)
      }))
    }
  }

  async updateRichList() {
    const sql = this.sql
    const { Address, RichList } = this.db
    let transaction = await this.db.sequelize.transaction()
    try {
      const blockHeight = this.app.blockchainInfo.tip.height
      let list = await this.db.sequelize.query(sql`
        SELECT list.address_id AS addressId, list.balance AS balance
        FROM (
          SELECT address_id, SUM(value) AS balance
          FROM transaction_output
          WHERE
            address_id > 0
            AND (input_height IS NULL OR input_height > ${blockHeight})
            AND (block_height BETWEEN 1 AND ${blockHeight})
            AND value > 0
          GROUP BY address_id
        ) list
        INNER JOIN address ON address._id = list.address_id
        WHERE address.type < ${Address.parseType('contract')}
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
      await this.db.sequelize.query(sql`DELETE FROM rich_list`, { transaction })
      await RichList.bulkCreate(
        list.map(({ addressId, balance }) => ({ addressId, balance: BigInt(balance) })),
        { validate: false, transaction, logging: false }
      )
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
    }
  }

  async getBalanceRanking(addressIds, transaction) {
    if (addressIds.length !== 1) {
      return null
    }
    const { RichList } = this.db
    const { gt: $gt } = this.db.Sequelize.Op
    let item = await RichList.findOne({
      where: { addressId: addressIds[0] },
      attributes: ['balance'],
      transaction
    })
    if (item == null) {
      return null
    } else {
      return await RichList.count({
        where: { balance: { [$gt]: item.balance.toString() } },
        transaction
      }) + 1
    }
  }

  async getDelegationsForStaker(address) {
    try {
      let client = new this.app.explorerDaemon.rpc(this.app.config.explorerDaemon.rpc)
      let info = await client.getdelegationsforstaker(address)
      return info
    } catch (error) {
      console.error('Error in getDelegationsForStaker:', error)
      throw error
    }
  }

  async getDelegationInfoForAddress(address) {
    let client = new this.app.explorerDaemon.rpc(this.app.config.explorerDaemon.rpc)
    let info = await client.getdelegationinfoforaddress(address)
    return info
  }
}
