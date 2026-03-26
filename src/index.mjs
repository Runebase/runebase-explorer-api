import http from 'http'
import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import { createClient } from 'redis'
import { io as SocketClient } from 'socket.io-client'

import config from './config/index.mjs'
import app from './app.mjs'
import logger from './utils/logger.mjs'
import { initDatabase } from './models/index.mjs'
import { initServices } from './services/index.mjs'
import { initSocketIO } from './socket/index.mjs'
import { initScheduledTasks } from './schedule/index.mjs'

async function main() {
  // 0. Initialize explorer daemon lib (ESM dynamic import)
  await app.initExplorerDaemon()

  // 1. Initialize database
  logger.info('Connecting to database...')
  const db = await initDatabase()
  app.db = db
  app.Sequelize = db.Sequelize

  // 2. Initialize Redis
  logger.info('Connecting to Redis...')
  const redisUrl = config.redis.password
    ? `redis://:${config.redis.password}@${config.redis.host}:${config.redis.port}/${config.redis.db}`
    : `redis://${config.redis.host}:${config.redis.port}/${config.redis.db}`
  const redis = createClient({ url: redisUrl })
  redis.on('error', (err) => logger.error({ err }, 'Redis error'))
  await redis.connect()
  app.redis = redis
  logger.info('Redis connected')

  // 3. Initialize services
  logger.info('Initializing services...')
  const services = initServices()

  // 4. Create Express app
  const expressApp = express()
  expressApp.use(helmet({ contentSecurityPolicy: false }))
  expressApp.use(cors({ origin: config.cors.origin }))
  expressApp.use(express.json({ limit: '10kb' }))
  expressApp.use(express.urlencoded({ extended: true }))

  // 5. Mount routes
  const { default: createRouter } = await import('./routes/index.mjs')
  const router = createRouter()
  expressApp.use(router)

  // Error handler
  expressApp.use((err, req, res, next) => {
    logger.error({ err }, 'Unhandled error')
    if (!res.headersSent) {
      res.status(err.status || 500).json({ error: err.message || 'Internal Server Error' })
    }
  })

  // 6. Create HTTP server and attach Socket.IO
  const server = http.createServer(expressApp)
  initSocketIO(server)

  // 7. Initialize scheduled tasks
  initScheduledTasks()

  // 8. Start agent (connects to explorer daemon via socket.io-client)
  startAgent(services)

  // 9. Start listening
  server.listen(config.port, () => {
    logger.info(`runebase-explorer-api listening on port ${config.port}`)
  })

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down...')
    server.close()
    await redis.quit()
    await db.sequelize.close()
    process.exit(0)
  }
  process.on('SIGTERM', shutdown)
  process.on('SIGINT', shutdown)
}

function startAgent(services) {
  let tip = null
  const namespace = app.io && app.io.of('/')

  const wsUrl = `http://localhost:${config.explorerDaemon.wsPort}`
  logger.info(`Connecting agent to explorer daemon at ${wsUrl}...`)
  const io = SocketClient(wsUrl)

  io.on('connect', () => {
    logger.info('Agent connected to explorer daemon')
  })

  io.on('tip', (newTip) => {
    tip = newTip
    app.blockchainInfo.tip = tip
    if (namespace) {
      namespace.emit('tip', tip)
    }
  })

  io.on('block', async (block) => {
    tip = block
    app.blockchainInfo.tip = block

    // Update stakeweight
    try {
      let transaction = await app.db.sequelize.transaction()
      try {
        let stakeWeight = await services.info.getStakeWeight(transaction)
        await app.redis.hSet(app.name, 'stakeweight', JSON.stringify(stakeWeight))
        if (namespace) {
          namespace.to('blockchain').emit('stakeweight', stakeWeight)
        }
        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
        logger.error({ err }, 'Failed to update stakeweight')
      }
    } catch (err) {
      logger.error({ err }, 'Failed to create transaction for stakeweight')
    }

    // Update DGP info
    try {
      let dgpInfo = await services.info.getDGPInfo()
      await app.redis.hSet(app.name, 'dgpinfo', JSON.stringify(dgpInfo))
      if (namespace) {
        namespace.to('blockchain').emit('dgpinfo', dgpInfo)
      }
    } catch (err) {
      logger.error({ err }, 'Failed to update DGP info')
    }

    // Emit block tip to socket
    await emitBlockTip(tip, services)
  })

  io.on('reorg', (block) => {
    tip = block
    app.blockchainInfo.tip = block
    if (namespace) {
      namespace.emit('reorg', tip)
    }
  })

  io.on('mempool-transaction', async (id) => {
    if (!id) return
    try {
      let transaction = await app.db.sequelize.transaction()
      try {
        let txData = await services.transaction.getTransaction(Buffer.from(id), transaction)
        if (txData) {
          let transformed = await services.transaction.transformTransaction(txData, { brief: true })
          if (namespace) {
            namespace.to('mempool').emit('mempool/transaction', transformed)
          }
          let addresses = await services.transaction.getMempoolTransactionAddresses(Buffer.from(id), transaction)
          for (let address of addresses) {
            namespace.to(`address/${address}`).emit('address/transaction', { address, id: Buffer.from(id).toString('hex') })
          }
        }
        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
        logger.error({ err }, 'Failed to process mempool transaction')
      }
    } catch (err) {
      logger.error({ err }, 'Failed to create transaction for mempool')
    }
  })

  io.on('disconnect', () => {
    logger.warn('Agent disconnected from explorer daemon')
  })

  // Statistics updates (every 2 minutes)
  let lastTipHash = Buffer.alloc(0)
  async function updateStatistics() {
    if (tip && Buffer.compare(lastTipHash, tip.hash) !== 0) {
      lastTipHash = tip.hash
      try {
        // Update rich list
        await services.balance.updateRichList()
      } catch (err) {
        logger.error({ err }, 'Failed to update rich list')
      }
      try {
        // Update QRC20 statistics
        await services.qrc20.updateQRC20Statistics()
      } catch (err) {
        logger.error({ err }, 'Failed to update QRC20 statistics')
      }
      try {
        // Update daily transactions
        let transaction = await app.db.sequelize.transaction()
        try {
          let dailyTransactions = await services.statistics.getDailyTransactions(transaction)
          await app.redis.hSet(app.name, 'daily-transactions', JSON.stringify(dailyTransactions))
          await transaction.commit()
        } catch (err) {
          await transaction.rollback()
          logger.error({ err }, 'Failed to update daily transactions')
        }
      } catch (err) {
        logger.error({ err }, 'Failed to create transaction for daily transactions')
      }
      try {
        // Update block interval
        let transaction = await app.db.sequelize.transaction()
        try {
          let blockInterval = await services.statistics.getBlockIntervalStatistics(transaction)
          await app.redis.hSet(app.name, 'block-interval', JSON.stringify(blockInterval))
          await transaction.commit()
        } catch (err) {
          await transaction.rollback()
          logger.error({ err }, 'Failed to update block interval')
        }
      } catch (err) {
        logger.error({ err }, 'Failed to create transaction for block interval')
      }
      try {
        // Update address growth
        let transaction = await app.db.sequelize.transaction()
        try {
          let addressGrowth = await services.statistics.getAddressGrowth(transaction)
          await app.redis.hSet(app.name, 'address-growth', JSON.stringify(addressGrowth))
          await transaction.commit()
        } catch (err) {
          await transaction.rollback()
          logger.error({ err }, 'Failed to update address growth')
        }
      } catch (err) {
        logger.error({ err }, 'Failed to create transaction for address growth')
      }
    }
  }
  setInterval(updateStatistics, 2 * 60 * 1000).unref()

  // Initial bootstrap
  const bootstrap = setInterval(() => {
    if (tip) {
      app.blockchainInfo = { tip }
      clearInterval(bootstrap)
      updateStatistics()
    }
  }, 100)

  // Initial fee rates, stakeweight, dgpinfo
  setTimeout(async () => {
    try {
      let transaction = await app.db.sequelize.transaction()
      try {
        let stakeWeight = await services.info.getStakeWeight(transaction)
        await app.redis.hSet(app.name, 'stakeweight', JSON.stringify(stakeWeight))
        await transaction.commit()
      } catch (err) {
        await transaction.rollback()
      }
    } catch (err) {
      logger.error({ err }, 'Failed initial stakeweight update')
    }
    try {
      let feeRate = await services.info.getFeeRates()
      if (feeRate) {
        await app.redis.hSet(app.name, 'feerate', JSON.stringify(feeRate))
      }
    } catch (err) {
      logger.error({ err }, 'Failed initial feerate update')
    }
    try {
      let dgpInfo = await services.info.getDGPInfo()
      await app.redis.hSet(app.name, 'dgpinfo', JSON.stringify(dgpInfo))
    } catch (err) {
      logger.error({ err }, 'Failed initial dgpinfo update')
    }
  }, 1000)
}

async function emitBlockTip(tip, services) {
  const namespace = app.io && app.io.of('/')
  if (!namespace) return

  namespace.emit('tip', tip)

  try {
    let transaction = await app.db.sequelize.transaction()
    try {
      let transactions = (await services.block.getBlockTransactions(tip.height, transaction)).map(id => id.toString('hex'))
      for (let id of transactions) {
        namespace.to(`transaction/${id}`).emit('transaction/confirm', id)
      }
      let list = await services.block.getBlockAddressTransactions(tip.height)
      for (let i = 0; i < transactions.length; ++i) {
        for (let address of list[i] || []) {
          namespace.to(`address/${address}`).emit('address/transaction', { address, id: transactions[i] })
        }
      }
      await transaction.commit()
    } catch (err) {
      await transaction.rollback()
      logger.error({ err }, 'Failed to emit block tip')
    }
  } catch (err) {
    logger.error({ err }, 'Failed to create transaction for block tip')
  }
}

main().catch((err) => {
  logger.fatal({ err }, 'Failed to start runebase-explorer-api')
  process.exit(1)
})
