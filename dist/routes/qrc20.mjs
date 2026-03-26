import services from '../services/index.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/qrc20', asyncHandler(async (req, res) => {
    let {
      totalCount,
      tokens
    } = await services.qrc20.listQRC20Tokens(req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      tokens: tokens.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        decimals: item.decimals,
        totalSupply: item.totalSupply.toString(),
        version: item.version,
        holders: item.holders,
        transactions: item.transactions
      }))
    });
  }));
  router.get('/qrc20/txs', asyncHandler(async (req, res) => {
    let {
      totalCount,
      transactions
    } = await services.qrc20.getAllQRC20TokenTransactions(req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        token: {
          name: transaction.token.name,
          symbol: transaction.token.symbol,
          decimals: transaction.token.decimals
        },
        from: transaction.from,
        fromHex: transaction.fromHex && transaction.fromHex.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex && transaction.toHex.toString('hex'),
        value: transaction.value.toString()
      }))
    });
  }));
  router.get('/qrc20/:token/txs', asyncHandler(async (req, res) => {
    if (req.state.token.type !== 'qrc20') return res.status(404).end();
    let {
      totalCount,
      transactions
    } = await services.qrc20.getQRC20TokenTransactions(req.state.token.contractAddress, req.state.pagination, req.state.fromBlock, req.state.toBlock, req.state.transaction);
    res.json({
      totalCount,
      transactions: transactions.map(transaction => ({
        transactionId: transaction.transactionId.toString('hex'),
        outputIndex: transaction.outputIndex,
        blockHeight: transaction.blockHeight,
        blockHash: transaction.blockHash.toString('hex'),
        timestamp: transaction.timestamp,
        from: transaction.from,
        fromHex: transaction.fromHex && transaction.fromHex.toString('hex'),
        to: transaction.to,
        toHex: transaction.toHex && transaction.toHex.toString('hex'),
        value: transaction.value.toString()
      }))
    });
  }));
  router.get('/qrc20/:token/rich-list', asyncHandler(async (req, res) => {
    if (req.state.token.type !== 'qrc20') return res.status(404).end();
    let {
      totalCount,
      list
    } = await services.qrc20.getQRC20TokenRichList(req.state.token.contractAddress, req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      list: list.map(item => ({
        address: item.address,
        addressHex: item.addressHex,
        balance: item.balance.toString()
      }))
    });
  }));
};