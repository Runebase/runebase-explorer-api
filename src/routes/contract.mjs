import services from '../services/index.mjs'
import app from '../app.mjs'

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export default (router) => {
  router.get('/contract/:contract', asyncHandler(async (req, res) => {
    let summary = await services.contract.getContractSummary(
      req.state.contract.contractAddress, req.state.contract.addressIds, req.state.fromBlock, req.state.toBlock, req.state.transaction
    )
    res.json({
      address: summary.addressHex.toString('hex'),
      addressHex: summary.addressHex.toString('hex'),
      vm: summary.vm,
      type: summary.type,
      ...summary.type === 'qrc20' ? {
        qrc20: {
          name: summary.qrc20.name,
          symbol: summary.qrc20.symbol,
          decimals: summary.qrc20.decimals,
          totalSupply: summary.qrc20.totalSupply.toString(),
          version: summary.qrc20.version,
          holders: summary.qrc20.holders,
          transactions: summary.qrc20.transactions
        }
      } : {},
      ...summary.type === 'qrc721' ? {
        qrc721: {
          name: summary.qrc721.name,
          symbol: summary.qrc721.symbol,
          totalSupply: summary.qrc721.totalSupply.toString()
        }
      } : {},
      balance: summary.balance.toString(),
      totalReceived: summary.totalReceived.toString(),
      totalSent: summary.totalSent.toString(),
      unconfirmed: summary.unconfirmed.toString(),
      qrc20Balances: summary.qrc20Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        balance: item.balance.toString()
      })),
      qrc721Balances: summary.qrc721Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        count: item.count
      })),
      transactionCount: summary.transactionCount
    })
  }))

  router.get('/contract/:contract/txs', asyncHandler(async (req, res) => {
    let { totalCount, transactions } = await services.contract.getContractTransactions(
      req.state.contract.contractAddress, req.state.contract.addressIds, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction
    )
    res.json({
      totalCount,
      transactions: transactions.map(id => id.toString('hex'))
    })
  }))

  router.get('/contract/:contract/basic-txs', asyncHandler(async (req, res) => {
    let { totalCount, transactions } = await services.contract.getContractBasicTransactions(req.state.contract.contractAddress, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction)
    res.json({
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash && transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        type: transaction.scriptPubKey.type,
        gasLimit: transaction.scriptPubKey.gasLimit,
        gasPrice: transaction.scriptPubKey.gasPrice,
        byteCode: transaction.scriptPubKey.byteCode.toString('hex'),
        outputValue: transaction.value.toString(),
        sender: transaction.sender.toString(),
        gasUsed: transaction.gasUsed,
        contractAddress: transaction.contractAddressHex.toString('hex'),
        contractAddressHex: transaction.contractAddressHex.toString('hex'),
        excepted: transaction.excepted,
        exceptedMessage: transaction.exceptedMessage,
        evmLogs: transaction.evmLogs.map(log => ({
          address: log.addressHex.toString('hex'),
          addressHex: log.addressHex.toString('hex'),
          topics: log.topics.map(topic => topic.toString('hex')),
          data: log.data.toString('hex')
        }))
      }))
    })
  }))

  router.get('/contract/:contract/balance-history', asyncHandler(async (req, res) => {
    let { totalCount, transactions } = await services.balance.getBalanceHistory(req.state.contract.addressIds, { nonZero: true }, req.state.pagination, req.state.transaction)
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        ...tx.block ? {
          blockHash: tx.block.hash.toString('hex'),
          blockHeight: tx.block.height,
          timestamp: tx.block.timestamp
        } : {},
        amount: tx.amount.toString(),
        balance: tx.balance.toString()
      }))
    })
  }))

  router.get('/contract/:contract/qrc20-balance-history', asyncHandler(async (req, res) => {
    let tokenAddress = null
    if (req.state.token) {
      if (req.state.token.type === 'qrc20') {
        tokenAddress = req.state.token.contractAddress
      } else {
        return res.json({
          totalCount: 0,
          transactions: []
        })
      }
    }
    let { totalCount, transactions } = await services.qrc20.getQRC20BalanceHistory([req.state.contract.contractAddress], tokenAddress, req.state.pagination, req.state.transaction)
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        hash: tx.block.hash.toString('hex'),
        height: tx.block.height,
        timestamp: tx.block.timestamp,
        tokens: tx.tokens.map(item => ({
          address: item.addressHex.toString('hex'),
          addressHex: item.addressHex.toString('hex'),
          name: item.name,
          symbol: item.symbol,
          decimals: item.decimals,
          amount: item.amount.toString(),
          balance: item.balance.toString()
        }))
      }))
    })
  }))

  router.get('/contract/:contract/qrc20-balance-history/:token', asyncHandler(async (req, res) => {
    let tokenAddress = null
    if (req.state.token) {
      if (req.state.token.type === 'qrc20') {
        tokenAddress = req.state.token.contractAddress
      } else {
        return res.json({
          totalCount: 0,
          transactions: []
        })
      }
    }
    let { totalCount, transactions } = await services.qrc20.getQRC20BalanceHistory([req.state.contract.contractAddress], tokenAddress, req.state.pagination, req.state.transaction)
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        hash: tx.block.hash.toString('hex'),
        height: tx.block.height,
        timestamp: tx.block.timestamp,
        tokens: tx.tokens.map(item => ({
          address: item.addressHex.toString('hex'),
          addressHex: item.addressHex.toString('hex'),
          name: item.name,
          symbol: item.symbol,
          decimals: item.decimals,
          amount: item.amount.toString(),
          balance: item.balance.toString()
        }))
      }))
    })
  }))

  router.get('/contract/:contract/call', asyncHandler(async (req, res) => {
    const { Address } = app.explorerDaemon.lib
    let { data, sender } = req.query
    if (req.state.contract.vm !== 'evm') return res.status(400).end()
    if (!/^([0-9a-f]{2})+$/i.test(data)) return res.status(400).end()
    if (sender != null) {
      try {
        let address = Address.fromString(sender, app.chain)
        if ([Address.PAY_TO_PUBLIC_KEY_HASH, Address.CONTRACT, Address.EVM_CONTRACT].includes(address.type)) {
          sender = address.data
        } else {
          return res.status(400).end()
        }
      } catch (err) {
        return res.status(400).end()
      }
    }
    res.json(await services.contract.callContract(req.state.contract.contractAddress, data, sender))
  }))

  router.get('/searchlogs', asyncHandler(async (req, res) => {
    let { contract, topic1, topic2, topic3, topic4 } = req.query
    if (contract != null) {
      contract = (await services.contract.getContractAddresses([contract]))[0]
    }
    if (topic1 != null) {
      if (/^[0-9a-f]{64}$/i.test(topic1)) {
        topic1 = Buffer.from(topic1, 'hex')
      } else {
        return res.status(400).end()
      }
    }
    if (topic2 != null) {
      if (/^[0-9a-f]{64}$/i.test(topic2)) {
        topic2 = Buffer.from(topic2, 'hex')
      } else {
        return res.status(400).end()
      }
    }
    if (topic3 != null) {
      if (/^[0-9a-f]{64}$/i.test(topic3)) {
        topic3 = Buffer.from(topic3, 'hex')
      } else {
        return res.status(400).end()
      }
    }
    if (topic4 != null) {
      if (/^[0-9a-f]{64}$/i.test(topic4)) {
        topic4 = Buffer.from(topic4, 'hex')
      } else {
        return res.status(400).end()
      }
    }

    let { totalCount, logs } = await services.contract.searchLogs({ contract, topic1, topic2, topic3, topic4 }, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction)
    res.json({
      totalCount,
      logs: logs.map(log => ({
        transactionId: log.transactionId.toString('hex'),
        outputIndex: log.outputIndex,
        blockHash: log.blockHash.toString('hex'),
        blockHeight: log.blockHeight,
        timestamp: log.timestamp,
        sender: log.sender.toString(),
        contractAddress: log.contractAddressHex.toString('hex'),
        contractAddressHex: log.contractAddressHex.toString('hex'),
        address: log.addressHex.toString('hex'),
        addressHex: log.addressHex.toString('hex'),
        topics: log.topics.map(topic => topic.toString('hex')),
        data: log.data.toString('hex')
      }))
    })
  }))
}
