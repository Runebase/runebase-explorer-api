import services from '../services/index.mjs'

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export default (router) => {
  const txListHandler = asyncHandler(async (req, res) => {
    const address = req.params.address || null
    let { totalCount, ids } = await services.transaction.getAllTransactions(address, req.state.pagination, req.state.transaction)
    let transactions = await Promise.all(ids.map(id => services.transaction.getTransaction(id, req.state.transaction)))
    res.json({
      totalCount,
      transactions: await Promise.all(transactions.map(tx => services.transaction.transformTransaction(tx)))
    })
  })
  router.get('/tx/list', txListHandler)
  router.get('/tx/list/:address', txListHandler)

  router.get('/tx/:id', asyncHandler(async (req, res) => {
    if (!req.params.id || !/^[0-9a-f]{64}$/i.test(req.params.id)) {
      return res.status(404).end()
    }
    let brief = 'brief' in req.query
    let id = Buffer.from(req.params.id, 'hex')
    let transaction = await services.transaction.getTransaction(id, req.state.transaction)
    if (!transaction) return res.status(404).end()
    res.json(await services.transaction.transformTransaction(transaction, { brief }))
  }))

  router.get('/txs/:ids', asyncHandler(async (req, res) => {
    if (!req.params.ids) return res.status(404).end()
    let ids = req.params.ids.split(',')
    if (ids.length > 100 || !ids.every(id => /^[0-9a-f]{64}$/i.test(id))) {
      return res.status(404).end()
    }
    let brief = 'brief' in req.query
    let transactions = await Promise.all(ids.map(
      id => services.transaction.getTransaction(Buffer.from(id, 'hex'), req.state.transaction)
    ))
    if (!transactions.every(Boolean)) return res.status(404).end()
    res.json(await Promise.all(transactions.map(
      tx => services.transaction.transformTransaction(tx, { brief })
    )))
  }))

  router.get('/raw-tx/:id', asyncHandler(async (req, res) => {
    if (!/^[0-9a-f]{64}$/.test(req.params.id)) {
      return res.status(404).end()
    }
    let id = Buffer.from(req.params.id, 'hex')
    let transaction = await services.transaction.getRawTransaction(id, req.state.transaction)
    if (!transaction) return res.status(404).end()
    res.send(transaction.toBuffer().toString('hex'))
  }))

  router.get('/recent-txs', asyncHandler(async (req, res) => {
    let count = Number.parseInt(req.query.count || 10)
    let ids = await services.transaction.getRecentTransactions(count, req.state.transaction)
    let transactions = await Promise.all(ids.map(
      id => services.transaction.getTransaction(Buffer.from(id, 'hex'), req.state.transaction)
    ))
    res.json(await Promise.all(transactions.map(
      tx => services.transaction.transformTransaction(tx, { brief: true })
    )))
  }))

  router.post('/tx/send', asyncHandler(async (req, res) => {
    let { rawtx: data } = req.body
    if (!/^([0-9a-f][0-9a-f])+$/i.test(data)) {
      return res.json({ status: 1, message: 'TX decode failed' })
    }
    try {
      let id = await services.transaction.sendRawTransaction(Buffer.from(data, 'hex'))
      res.json({ status: 0, id: id.toString('hex'), txid: id.toString('hex') })
    } catch (err) {
      res.json({ status: 1, message: err.message })
    }
  }))
}
