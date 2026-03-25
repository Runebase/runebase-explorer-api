import services from '../services/index.mjs'
import app from '../app.mjs'

const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next)

export default (router) => {
  router.get('/search', asyncHandler(async (req, res) => {
    res.json(await services.misc.classify(req.query.query, req.state.transaction))
  }))

  router.get('/misc/rich-list', asyncHandler(async (req, res) => {
    let { totalCount, list } = await services.balance.getRichList(req.state.pagination, req.state.transaction)
    res.json({
      totalCount,
      list: list.map(item => ({
        address: item.addressHex ? item.addressHex.toString('hex') : item.address,
        addressHex: item.addressHex && item.addressHex.toString('hex'),
        balance: item.balance.toString()
      }))
    })
  }))

  router.get('/misc/biggest-miners', asyncHandler(async (req, res) => {
    let lastNBlocks = null
    if (req.query.blocks && /^[1-9]\d*$/.test(req.query.blocks)) {
      lastNBlocks = Number.parseInt(req.query.blocks)
    }
    let { totalCount, list } = await services.block.getBiggestMiners(lastNBlocks, req.state.pagination, req.state.transaction)
    res.json({
      totalCount,
      list: list.map(item => ({
        address: item.address,
        blocks: item.blocks,
        balance: item.balance.toString()
      }))
    })
  }))

  router.get('/misc/prices', asyncHandler(async (req, res) => {
    res.json(JSON.parse(await app.redis.hGet(app.name, 'runebase-price')))
  }))
}
