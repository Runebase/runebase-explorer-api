import { Router } from 'express'
import { pagination } from '../middleware/pagination.mjs'
import { blockFilter } from '../middleware/block-filter.mjs'
import { addressMiddleware } from '../middleware/address.mjs'
import { contractMiddleware } from '../middleware/contract.mjs'
import { dbTransaction } from '../middleware/transaction.mjs'
import { ratelimit } from '../middleware/ratelimit.mjs'

import infoRoutes from './info.mjs'
import blockRoutes from './block.mjs'
import transactionRoutes from './transaction.mjs'
import addressRoutes from './address.mjs'
import contractRoutes from './contract.mjs'
import qrc20Routes from './qrc20.mjs'
import qrc721Routes from './qrc721.mjs'
import miscRoutes from './misc.mjs'
import statisticsRoutes from './statistics.mjs'

export default function createRouter() {
  const router = Router()

  // Global middleware
  router.use(ratelimit())
  router.use(dbTransaction())

  // --- Info routes ---
  infoRoutes(router)

  // --- Block routes ---
  // GET /blocks has no middleware
  // GET /block/list needs pagination
  // GET /block/:block, /raw-block/:block, /recent-blocks have no middleware
  // Block routes register themselves; middleware is applied per-route below
  // We need to register routes with middleware before the sub-route modules
  // so let's use a pattern where we apply middleware inline

  // Since block.mjs registers routes directly, and some need middleware,
  // we need a different approach: register middleware-requiring routes here
  // and let the route files handle the handlers.

  // Actually, the sub-route files register routes directly on the router.
  // For routes needing middleware, we need to insert middleware on specific paths.
  // The cleanest approach: register all routes here with their middleware chains.

  // Let's use a dedicated router approach instead:
  // Each sub-route file registers its handlers. For routes needing middleware,
  // we register the middleware on those specific paths before the handler routes.

  // Re-approach: apply per-path middleware before registering sub-routes

  // Pagination middleware instances
  const paginationMw = pagination()
  const blockFilterMw = blockFilter()
  const addressMw = addressMiddleware()
  const contractMw = contractMiddleware()
  const contractTokenMw = contractMiddleware('token')

  // --- Block routes with middleware ---
  router.get('/block/list', paginationMw)

  // --- Transaction routes with middleware ---
  router.get('/tx/list', paginationMw)
  router.get('/tx/list/:address', paginationMw)

  // --- Address routes with middleware ---
  router.get('/address/:address', addressMw)
  router.get('/address/:address/balance', addressMw)
  router.get('/address/:address/balance/total-received', addressMw)
  router.get('/address/:address/balance/total-sent', addressMw)
  router.get('/address/:address/balance/unconfirmed', addressMw)
  router.get('/address/:address/balance/staking', addressMw)
  router.get('/address/:address/balance/mature', addressMw)
  router.get('/address/:address/delegation', addressMw)
  router.get('/address/:address/super-staker', addressMw)
  router.get('/address/:address/qrc20-balance/:token', addressMw, contractTokenMw)
  router.get('/address/:address/txs', addressMw, paginationMw, blockFilterMw)
  router.get('/address/:address/basic-txs', addressMw, paginationMw, blockFilterMw)
  router.get('/address/:address/contract-txs', addressMw, paginationMw, blockFilterMw)
  router.get('/address/:address/contract-txs/:contract', addressMw, contractMw, paginationMw)
  router.get('/address/:address/qrc20-txs/:token', addressMw, contractTokenMw, paginationMw)
  router.get('/address/:address/qrc20-mempool-txs/:token', addressMw, contractTokenMw)
  router.get('/address/:address/utxo', addressMw)
  router.get('/address/:address/balance-history', addressMw, paginationMw)
  router.get('/address/:address/qrc20-balance-history', addressMw, paginationMw)
  router.get('/address/:address/qrc20-balance-history/:token', addressMw, contractTokenMw, paginationMw)

  // --- Contract routes with middleware ---
  router.get('/contract/:contract', contractMw)
  router.get('/contract/:contract/txs', contractMw, paginationMw, blockFilterMw)
  router.get('/contract/:contract/basic-txs', contractMw, paginationMw, blockFilterMw)
  router.get('/contract/:contract/balance-history', contractMw, paginationMw)
  router.get('/contract/:contract/qrc20-balance-history', contractMw, paginationMw)
  router.get('/contract/:contract/qrc20-balance-history/:token', contractMw, contractTokenMw, paginationMw)
  router.get('/contract/:contract/call', contractMw)
  router.get('/searchlogs', paginationMw, blockFilterMw)

  // --- QRC20 routes with middleware ---
  router.get('/qrc20', paginationMw)
  router.get('/qrc20/txs', paginationMw)
  router.get('/qrc20/:token/txs', contractTokenMw, paginationMw, blockFilterMw)
  router.get('/qrc20/:token/rich-list', contractTokenMw, paginationMw)

  // --- QRC721 routes with middleware ---
  router.get('/qrc721', paginationMw)

  // --- Misc routes with middleware ---
  router.get('/misc/rich-list', paginationMw)
  router.get('/misc/biggest-miners', paginationMw)

  // --- Register all route handlers ---
  // These add the actual handlers (the middleware above runs first due to Express
  // matching the same path+method in registration order)
  blockRoutes(router)
  transactionRoutes(router)
  addressRoutes(router)
  contractRoutes(router)
  qrc20Routes(router)
  qrc721Routes(router)
  miscRoutes(router)
  statisticsRoutes(router)

  return router
}
