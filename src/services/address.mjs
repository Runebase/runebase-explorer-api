export class AddressService {
  constructor({ app, db, sql, services }) {
    this.app = app
    this.db = db
    this.sql = sql
    this.services = services
  }

  async getAddressSummary(addressIds, p2pkhAddressIds, rawAddresses, transaction) {
    const { Address } = this.app.explorerDaemon.lib
    const { Block } = this.db
    const { balance: balanceService, qrc20: qrc20Service, qrc721: qrc721Service } = this.services
    const { in: $in, gt: $gt } = this.db.Sequelize.Op
    let hexAddresses = rawAddresses.filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH).map(address => address.data)
    let [
      { totalReceived, totalSent },
      unconfirmed,
      staking,
      mature,
      qrc20Balances,
      qrc721Balances,
      ranking,
      blocksMined,
      transactionCount
    ] = await Promise.all([
      balanceService.getTotalBalanceChanges(addressIds, transaction),
      balanceService.getUnconfirmedBalance(addressIds, transaction),
      balanceService.getStakingBalance(addressIds, transaction),
      balanceService.getMatureBalance(p2pkhAddressIds, transaction),
      qrc20Service.getAllQRC20Balances(hexAddresses, transaction),
      qrc721Service.getAllQRC721Balances(hexAddresses, transaction),
      balanceService.getBalanceRanking(addressIds, transaction),
      Block.count({ where: { minerId: { [$in]: p2pkhAddressIds }, height: { [$gt]: 0 } }, transaction }),
      this.getAddressTransactionCount(addressIds, rawAddresses, null, null, transaction),
    ])
    return {
      balance: totalReceived - totalSent,
      totalReceived,
      totalSent,
      unconfirmed,
      staking,
      mature,
      qrc20Balances,
      qrc721Balances,
      ranking,
      transactionCount,
      blocksMined
    }
  }

  async getAddressTransactionCount(addressIds, rawAddresses, fromBlock, toBlock, transaction) {
    const { Address: RawAddress, Solidity } = this.app.explorerDaemon.lib
    const TransferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const { Address } = this.db
    const sql = this.sql
    let topics = rawAddresses
      .filter(address => address.type === RawAddress.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => Buffer.concat([Buffer.alloc(12), address.data]))
    let [{ count }] = await this.db.sequelize.query(sql`
      SELECT COUNT(*) AS count FROM (
        SELECT transaction_id FROM balance_change
        WHERE address_id IN ${addressIds} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
        UNION
        SELECT transaction_id FROM evm_receipt
        WHERE (sender_type, sender_data) IN ${rawAddresses.map(address => [Address.parseType(address.type), address.data])}
          AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
        UNION
        SELECT receipt.transaction_id AS transaction_id FROM evm_receipt receipt, evm_receipt_log log, contract
        WHERE receipt._id = log.receipt_id
          AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
          AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
          AND log.topic1 = ${TransferABI.id}
          AND (log.topic2 IN ${topics} OR log.topic3 IN ${topics})
          AND (
            (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
            OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
          )
      ) list
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    return count
  }

  async getAddressTransactions(addressIds, rawAddresses, pagination, fromBlock, toBlock, transaction) {
    const { Address: RawAddress, Solidity } = this.app.explorerDaemon.lib
    const TransferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const { Address } = this.db
    const sql = this.sql
    let { limit, offset, reversed = true } = pagination
    let order = reversed ? 'DESC' : 'ASC'
    let topics = rawAddresses
      .filter(address => address.type === RawAddress.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => Buffer.concat([Buffer.alloc(12), address.data]))
    let totalCount = await this.getAddressTransactionCount(addressIds, rawAddresses, fromBlock, toBlock, transaction)
    let transactions = (await this.db.sequelize.query(sql`
      SELECT tx.id AS id FROM (
        SELECT _id FROM (
          SELECT block_height, index_in_block, transaction_id AS _id FROM balance_change
          WHERE address_id IN ${addressIds} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
          UNION
          SELECT block_height, index_in_block, transaction_id AS _id
          FROM evm_receipt
          WHERE (sender_type, sender_data) IN ${rawAddresses.map(address => [Address.parseType(address.type), address.data])}
            AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
          UNION
          SELECT receipt.block_height AS block_height, receipt.index_in_block AS index_in_block, receipt.transaction_id AS _id
          FROM evm_receipt receipt, evm_receipt_log log, contract
          WHERE receipt._id = log.receipt_id
            AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
            AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
            AND log.topic1 = ${TransferABI.id}
            AND (log.topic2 IN ${topics} OR log.topic3 IN ${topics})
            AND (
              (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
              OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
            )
        ) list
        ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, _id ${{ raw: order }}
        LIMIT ${offset}, ${limit}
      ) list, transaction tx
      WHERE tx._id = list._id
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })).map(({ id }) => id)
    return { totalCount, transactions }
  }

  async getAddressBasicTransactionCount(addressIds, fromBlock, toBlock, transaction) {
    const { BalanceChange } = this.db
    const { in: $in } = this.db.Sequelize.Op
    return await BalanceChange.count({
      where: {
        ...this.services.block.getBlockFilter(fromBlock, toBlock),
        addressId: { [$in]: addressIds }
      },
      distinct: true,
      col: 'transactionId',
      transaction
    })
  }

  async getAddressBasicTransactions(addressIds, pagination, fromBlock, toBlock, transaction) {
    const sql = this.sql
    let { limit, offset, reversed = true } = pagination
    let order = reversed ? 'DESC' : 'ASC'
    let totalCount = await this.getAddressBasicTransactionCount(addressIds, fromBlock, toBlock, transaction)
    let transactionIds = []
    if (addressIds.length === 1) {
      transactionIds = (await this.db.sequelize.query(sql`
        SELECT transaction_id AS _id
        FROM balance_change
        WHERE address_id = ${addressIds[0]} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
        ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, transaction_id ${{ raw: order }}
        LIMIT ${offset}, ${limit}
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })).map(({ _id }) => _id)
    } else {
      transactionIds = (await this.db.sequelize.query(sql`
        SELECT _id FROM (
          SELECT MIN(block_height) AS block_height, MIN(index_in_block) AS index_in_block, transaction_id AS _id
          FROM balance_change
          WHERE address_id IN ${addressIds} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
          GROUP BY _id
        ) list
        ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, _id ${{ raw: order }}
        LIMIT ${offset}, ${limit}
      `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })).map(({ _id }) => _id)
    }

    let transactions = await Promise.all(transactionIds.map(async transactionId => {
      let tx = await this.services.transaction.getBasicTransaction(transactionId, addressIds, transaction)
      return Object.assign(tx, {
        confirmations: tx.blockHeight == null ? 0 : this.app.blockchainInfo.tip.height - tx.blockHeight + 1
      })
    }))
    return { totalCount, transactions }
  }

  async getAddressContractTransactionCount(rawAddresses, contract, fromBlock, toBlock, transaction) {
    const { Address } = this.db
    const sql = this.sql
    let contractFilter = 'TRUE'
    if (contract) {
      contractFilter = sql`contract_address = ${contract.contractAddress}`
    }
    let [{ count }] = await this.db.sequelize.query(sql`
      SELECT COUNT(DISTINCT(_id)) AS count FROM evm_receipt
      WHERE (sender_type, sender_data) IN ${rawAddresses.map(address => [Address.parseType(address.type), address.data])}
        AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)} AND ${{ raw: contractFilter }}
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    return count
  }

  async getAddressContractTransactions(rawAddresses, contract, pagination, fromBlock, toBlock, transaction) {
    const { Address } = this.db
    const sql = this.sql
    let { limit, offset, reversed = true } = pagination
    let order = reversed ? 'DESC' : 'ASC'
    let contractFilter = 'TRUE'
    if (contract) {
      contractFilter = sql`contract_address = ${contract.contractAddress}`
    }
    let totalCount = await this.getAddressContractTransactionCount(rawAddresses, contract, fromBlock, toBlock, transaction)
    let receiptIds = (await this.db.sequelize.query(sql`
      SELECT _id FROM evm_receipt
      WHERE (sender_type, sender_data) IN ${rawAddresses.map(address => [Address.parseType(address.type), address.data])}
        AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)} AND ${{ raw: contractFilter }}
      ORDER BY block_height ${{ raw: order }}, index_in_block ${{ raw: order }}, transaction_id ${{ raw: order }}, output_index ${{ raw: order }}
      LIMIT ${offset}, ${limit}
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })).map(({ _id }) => _id)
    let transactions = await Promise.all(receiptIds.map(async receiptId => {
      let tx = await this.services.transaction.getContractTransaction(receiptId, transaction)
      return Object.assign(tx, {
        confirmations: tx.blockHeight == null ? 0 : this.app.blockchainInfo.tip.height - tx.blockHeight + 1
      })
    }))
    return { totalCount, transactions }
  }

  async getAddressQRC20TokenTransactionCount(rawAddresses, token, transaction) {
    const { Address, Solidity } = this.app.explorerDaemon.lib
    const TransferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const { EvmReceiptLog: EVMReceiptLog } = this.db
    const { or: $or, in: $in } = this.db.Sequelize.Op
    let topicAddresses = rawAddresses
      .filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => Buffer.concat([Buffer.alloc(12), address.data]))
    return await EVMReceiptLog.count({
      where: {
        address: token.contractAddress,
        topic1: TransferABI.id,
        [$or]: [
          { topic2: { [$in]: topicAddresses } },
          { topic3: { [$in]: topicAddresses } }
        ]
      },
      transaction
    })
  }

  async getAddressQRC20TokenTransactions(rawAddresses, token, pagination, transaction) {
    const { Address, Solidity } = this.app.explorerDaemon.lib
    const TransferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer')
    const sql = this.sql
    let { limit, offset, reversed = true } = pagination
    let order = reversed ? 'DESC' : 'ASC'
    let topicAddresses = rawAddresses
      .filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => Buffer.concat([Buffer.alloc(12), address.data]))
    let totalCount = await this.getAddressQRC20TokenTransactionCount(rawAddresses, token, transaction)
    let transactions = await this.db.sequelize.query(sql`
      SELECT
        transaction.id AS transactionId,
        receipt.output_index AS outputIndex,
        header.height AS blockHeight,
        header.hash AS blockHash,
        header.timestamp AS timestamp,
        log.topic2 AS topic2,
        log.topic3 AS topic3,
        log.data AS data
      FROM (
        SELECT _id FROM evm_receipt_log
        WHERE address = ${token.contractAddress} AND topic1 = ${TransferABI.id}
          AND ((topic2 IN ${topicAddresses}) OR (topic3 IN ${topicAddresses}))
        ORDER BY _id ${{ raw: order }}
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN evm_receipt_log log USING (_id)
      INNER JOIN evm_receipt receipt ON receipt._id = log.receipt_id
      INNER JOIN header ON header.height = receipt.block_height
      INNER JOIN transaction ON transaction._id = receipt.transaction_id
      INNER JOIN qrc20 ON qrc20.contract_address = log.address
      ORDER BY list._id ${{ raw: order }}
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })

    let addresses = await this.services.contract.transformHexAddresses(
      transactions.map(tx => [tx.topic2.slice(12), tx.topic3.slice(12)]).flat(),
      transaction
    )
    return {
      totalCount,
      transactions: transactions.map((tx, index) => {
        let from = addresses[index * 2]
        let to = addresses[index * 2 + 1]
        let fromAddress = rawAddresses.find(address => Buffer.compare(address.data, tx.topic2.slice(12)) === 0)
        if (fromAddress) {
          from = fromAddress.toString()
        }
        let toAddress = rawAddresses.find(address => Buffer.compare(address.data, tx.topic3.slice(12)) === 0)
        if (toAddress) {
          to = toAddress.toString()
        }
        let value = BigInt(`0x${tx.data.toString('hex')}`)
        return {
          transactionId: tx.transactionId,
          outputIndex: tx.outputIndex,
          blockHeight: tx.blockHeight,
          blockHash: tx.blockHash,
          timestamp: tx.timestamp,
          confirmations: this.app.blockchainInfo.tip.height - tx.blockHeight + 1,
          ...from && typeof from === 'object' ? { from: from.hex.toString('hex'), fromHex: from.hex } : { from },
          ...to && typeof to === 'object' ? { to: to.hex.toString('hex'), toHex: to.hex } : { to },
          value,
          amount: BigInt(Boolean(toAddress) - Boolean(fromAddress)) * value
        }
      })
    }
  }

  async getAddressQRC20TokenMempoolTransactions(rawAddresses, token, transaction) {
    const { Address: RawAddress, OutputScript, Solidity } = this.app.explorerDaemon.lib
    const transferABI = Solidity.qrc20ABIs.find(abi => abi.name === 'transfer')
    const { Address, Transaction, TransactionOutput, Contract, EvmReceipt: EVMReceipt } = this.db
    let hexAddresses = rawAddresses
      .filter(address => address.type === RawAddress.PAY_TO_PUBLIC_KEY_HASH)
      .map(address => address.data)
    let transactions = await EVMReceipt.findAll({
      where: { blockHeight: 0xffffffff },
      attributes: ['outputIndex', 'senderData'],
      include: [
        {
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id']
        },
        {
          model: TransactionOutput,
          as: 'output',
          on: {
            transactionId: this.db.sequelize.where(this.db.sequelize.col('output.transaction_id'), '=', this.db.sequelize.col('evm_receipt.transaction_id')),
            outputIndex: this.db.sequelize.where(this.db.sequelize.col('output.output_index'), '=', this.db.sequelize.col('evm_receipt.output_index'))
          },
          required: true,
          attributes: ['scriptPubKey'],
          include: [{
            model: Address,
            as: 'address',
            required: true,
            attributes: [],
            include: [{
              model: Contract,
              as: 'contract',
              required: true,
              where: { address: token.contractAddress, type: 'qrc20' },
              attributes: []
            }]
          }]
        },
      ],
      transaction
    })

    transactions = transactions.filter(tx => {
      let scriptPubKey = OutputScript.fromBuffer(tx.output.scriptPubKey)
      if (![OutputScript.EVM_CONTRACT_CALL, OutputScript.EVM_CONTRACT_CALL_SENDER].includes(scriptPubKey.type)) {
        return false
      }
      let byteCode = scriptPubKey.byteCode
      if (byteCode.length !== 68
        || Buffer.compare(byteCode.slice(0, 4), transferABI.id) !== 0
        || Buffer.compare(byteCode.slice(4, 16), Buffer.alloc(12)) !== 0
      ) {
        return false
      }
      let from = tx.senderData
      let to = byteCode.slice(16, 36)
      let isFrom = hexAddresses.some(address => Buffer.compare(address, from) === 0)
      let isTo = hexAddresses.some(address => Buffer.compare(address, to) === 0)
      return isFrom || isTo
    })
    return await Promise.all(transactions.map(async tx => {
      let scriptPubKey = OutputScript.fromBuffer(tx.output.scriptPubKey)
      let byteCode = scriptPubKey.byteCode
      let from = tx.senderData
      let to = byteCode.slice(16, 36)
      let value = BigInt(`0x${byteCode.slice(36).toString('hex')}`)
      let isFrom = hexAddresses.some(address => Buffer.compare(address, from) === 0)
      let isTo = hexAddresses.some(address => Buffer.compare(address, to) === 0)
      let addresses = await this.services.contract.transformHexAddresses([from, to], transaction)
      return {
        transactionId: tx.transaction.id,
        outputIndex: tx.outputIndex,
        ...from && typeof addresses[0] === 'object' ? { from: addresses[0].hex.toString('hex'), fromHex: addresses[0].hex } : { from: addresses[0] },
        ...to && typeof addresses[1] === 'object' ? { to: addresses[1].hex.toString('hex'), toHex: addresses[1].hex } : { to: addresses[1] },
        value,
        amount: BigInt(isTo - isFrom) * value
      }
    }))
  }

  async getUTXO(ids, transaction) {
    const { Address, Transaction, TransactionOutput } = this.db
    const { in: $in, gt: $gt } = this.db.Sequelize.Op
    const blockHeight = this.app.blockchainInfo.tip.height
    let utxos = await TransactionOutput.findAll({
      where: {
        addressId: { [$in]: ids },
        blockHeight: { [$gt]: 0 },
        inputHeight: null
      },
      attributes: ['transactionId', 'outputIndex', 'blockHeight', 'scriptPubKey', 'value', 'isStake'],
      include: [
        {
          model: Transaction,
          as: 'outputTransaction',
          required: true,
          attributes: ['id']
        },
        {
          model: Address,
          as: 'address',
          required: true,
          attributes: ['string']
        }
      ],
      transaction
    })
    return utxos.map(utxo => ({
      transactionId: utxo.outputTransaction.id,
      outputIndex: utxo.outputIndex,
      scriptPubKey: utxo.scriptPubKey,
      address: utxo.address.string,
      value: utxo.value,
      isStake: utxo.isStake,
      blockHeight: utxo.blockHeight,
      confirmations: utxo.blockHeight === 0xffffffff ? 0 : blockHeight - utxo.blockHeight + 1
    }))
  }
}
