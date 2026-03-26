import services from '../services/index.mjs';
import app from '../app.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/address/:address', asyncHandler(async (req, res) => {
    let {
      address
    } = req.state;
    let summary = await services.address.getAddressSummary(address.addressIds, address.p2pkhAddressIds, address.rawAddresses, req.state.transaction);
    res.json({
      balance: summary.balance.toString(),
      totalReceived: summary.totalReceived.toString(),
      totalSent: summary.totalSent.toString(),
      unconfirmed: summary.unconfirmed.toString(),
      staking: summary.staking.toString(),
      mature: summary.mature.toString(),
      qrc20Balances: summary.qrc20Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        balance: item.balance.toString(),
        unconfirmed: {
          received: item.unconfirmed.received.toString(),
          sent: item.unconfirmed.sent.toString()
        },
        isUnconfirmed: item.isUnconfirmed
      })),
      qrc721Balances: summary.qrc721Balances.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        count: item.count
      })),
      ranking: summary.ranking,
      transactionCount: summary.transactionCount,
      blocksMined: summary.blocksMined
    });
  }));
  router.get('/address/:address/balance', asyncHandler(async (req, res) => {
    let balance = await services.balance.getBalance(req.state.address.addressIds, req.state.transaction);
    res.send(balance.toString());
  }));
  router.get('/address/:address/balance/total-received', asyncHandler(async (req, res) => {
    let {
      totalReceived
    } = await services.balance.getTotalBalanceChanges(req.state.address.addressIds, req.state.transaction);
    res.send(totalReceived.toString());
  }));
  router.get('/address/:address/balance/total-sent', asyncHandler(async (req, res) => {
    let {
      totalSent
    } = await services.balance.getTotalBalanceChanges(req.state.address.addressIds, req.state.transaction);
    res.send(totalSent.toString());
  }));
  router.get('/address/:address/balance/unconfirmed', asyncHandler(async (req, res) => {
    let unconfirmed = await services.balance.getUnconfirmedBalance(req.state.address.addressIds, req.state.transaction);
    res.send(unconfirmed.toString());
  }));
  router.get('/address/:address/balance/staking', asyncHandler(async (req, res) => {
    let staking = await services.balance.getStakingBalance(req.state.address.addressIds, req.state.transaction);
    res.send(staking.toString());
  }));
  router.get('/address/:address/balance/mature', asyncHandler(async (req, res) => {
    let mature = await services.balance.getMatureBalance(req.state.address.p2pkhAddressIds, req.state.transaction);
    res.send(mature.toString());
  }));
  router.get('/address/:address/delegation', asyncHandler(async (req, res) => {
    const {
      address
    } = req.params;
    let delegationInfo = await services.balance.getDelegationInfoForAddress(address);
    res.json(delegationInfo);
  }));
  router.get('/address/:address/super-staker', asyncHandler(async (req, res) => {
    const {
      address
    } = req.params;
    let superStakerInfo = await services.balance.getDelegationsForStaker(address);
    res.json(superStakerInfo);
  }));
  router.get('/address/:address/qrc20-balance/:token', asyncHandler(async (req, res) => {
    let {
      address,
      token
    } = req.state;
    if (token.type !== 'qrc20') {
      return res.json({});
    }
    let {
      name,
      symbol,
      decimals,
      balance,
      unconfirmed
    } = await services.qrc20.getQRC20Balance(address.rawAddresses, token.contractAddress, req.state.transaction);
    res.json({
      name,
      symbol,
      decimals,
      balance: balance.toString(),
      unconfirmed: {
        received: unconfirmed.received.toString(),
        sent: unconfirmed.sent.toString()
      }
    });
  }));
  router.get('/address/:address/txs', asyncHandler(async (req, res) => {
    let {
      address
    } = req.state;
    let {
      totalCount,
      transactions
    } = await services.address.getAddressTransactions(address.addressIds, address.rawAddresses, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(id => id.toString('hex'))
    });
  }));
  router.get('/address/:address/basic-txs', asyncHandler(async (req, res) => {
    let {
      totalCount,
      transactions
    } = await services.address.getAddressBasicTransactions(req.state.address.addressIds, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(transaction => ({
        id: transaction.id.toString('hex'),
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash && transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        amount: transaction.amount.toString(),
        inputValue: transaction.inputValue.toString(),
        outputValue: transaction.outputValue.toString(),
        refundValue: transaction.refundValue.toString(),
        fees: transaction.fees.toString(),
        type: transaction.type
      }))
    });
  }));
  router.get('/address/:address/contract-txs', asyncHandler(async (req, res) => {
    let {
      address,
      contract
    } = req.state;
    let {
      totalCount,
      transactions
    } = await services.address.getAddressContractTransactions(address.rawAddresses, contract, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction);
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
        outputAddress: transaction.outputAddressHex.toString('hex'),
        outputAddressHex: transaction.outputAddressHex.toString('hex'),
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
    });
  }));
  router.get('/address/:address/contract-txs/:contract', asyncHandler(async (req, res) => {
    let {
      address,
      contract
    } = req.state;
    let {
      totalCount,
      transactions
    } = await services.address.getAddressContractTransactions(address.rawAddresses, contract, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction);
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
        outputAddress: transaction.outputAddressHex.toString('hex'),
        outputAddressHex: transaction.outputAddressHex.toString('hex'),
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
    });
  }));
  router.get('/address/:address/qrc20-txs/:token', asyncHandler(async (req, res) => {
    let {
      address,
      token
    } = req.state;
    let {
      totalCount,
      transactions
    } = await services.address.getAddressQRC20TokenTransactions(address.rawAddresses, token, req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        confirmations: transaction.confirmations,
        from: transaction.from,
        fromHex: transaction.fromHex && transaction.fromHex.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex && transaction.toHex.toString('hex'),
        value: transaction.value.toString(),
        amount: transaction.amount.toString()
      }))
    });
  }));
  router.get('/address/:address/qrc20-mempool-txs/:token', asyncHandler(async (req, res) => {
    let {
      address,
      token
    } = req.state;
    let transactions = await services.address.getAddressQRC20TokenMempoolTransactions(address.rawAddresses, token, req.state.transaction);
    res.json(transactions.map(transaction => ({
      transactionId: transaction.transactionId.toString('hex'),
      outputIndex: transaction.outputIndex,
      from: transaction.from,
      fromHex: transaction.fromHex && transaction.fromHex.toString('hex'),
      to: transaction.to,
      toHex: transaction.toHex && transaction.toHex.toString('hex'),
      value: transaction.value.toString(),
      amount: transaction.amount.toString()
    })));
  }));
  router.get('/address/:address/utxo', asyncHandler(async (req, res) => {
    let utxos = await services.address.getUTXO(req.state.address.addressIds, req.state.transaction);
    res.json(utxos.map(utxo => ({
      transactionId: utxo.transactionId.toString('hex'),
      outputIndex: utxo.outputIndex,
      scriptPubKey: utxo.scriptPubKey.toString('hex'),
      address: utxo.address,
      value: utxo.value.toString(),
      isStake: utxo.isStake,
      blockHeight: utxo.blockHeight,
      confirmations: utxo.confirmations
    })));
  }));
  router.get('/address/:address/balance-history', asyncHandler(async (req, res) => {
    let {
      totalCount,
      transactions
    } = await services.balance.getBalanceHistory(req.state.address.addressIds, {}, req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        ...(tx.block ? {
          blockHash: tx.block.hash.toString('hex'),
          blockHeight: tx.block.height,
          timestamp: tx.block.timestamp
        } : {}),
        amount: tx.amount.toString(),
        balance: tx.balance.toString()
      }))
    });
  }));
  router.get('/address/:address/qrc20-balance-history', asyncHandler(async (req, res) => {
    const {
      Address
    } = app.explorerDaemon.lib;
    let tokenAddress = null;
    if (req.state.token) {
      if (req.state.token.type === 'qrc20') {
        tokenAddress = req.state.token.contractAddress;
      } else {
        return res.json({
          totalCount: 0,
          transactions: []
        });
      }
    }
    let hexAddresses = req.state.address.rawAddresses.filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH).map(address => address.data);
    let {
      totalCount,
      transactions
    } = await services.qrc20.getQRC20BalanceHistory(hexAddresses, tokenAddress, req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        blockHash: tx.block.hash.toString('hex'),
        blockHeight: tx.block.height,
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
    });
  }));
  router.get('/address/:address/qrc20-balance-history/:token', asyncHandler(async (req, res) => {
    const {
      Address
    } = app.explorerDaemon.lib;
    let tokenAddress = null;
    if (req.state.token) {
      if (req.state.token.type === 'qrc20') {
        tokenAddress = req.state.token.contractAddress;
      } else {
        return res.json({
          totalCount: 0,
          transactions: []
        });
      }
    }
    let hexAddresses = req.state.address.rawAddresses.filter(address => address.type === Address.PAY_TO_PUBLIC_KEY_HASH).map(address => address.data);
    let {
      totalCount,
      transactions
    } = await services.qrc20.getQRC20BalanceHistory(hexAddresses, tokenAddress, req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(tx => ({
        id: tx.id.toString('hex'),
        blockHash: tx.block.hash.toString('hex'),
        blockHeight: tx.block.height,
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
    });
  }));
};