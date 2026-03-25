import app from '../app.mjs'
import db from '../models/index.mjs'
import { sql } from '../utils/sql.mjs'

import { InfoService } from './info.mjs'
import { BlockService } from './block.mjs'
import { TransactionService } from './transaction.mjs'
import { AddressService } from './address.mjs'
import { BalanceService } from './balance.mjs'
import { ContractService } from './contract.mjs'
import { MiscService } from './misc.mjs'
import { QRC20Service } from './qrc20.mjs'
import { QRC721Service } from './qrc721.mjs'
import { StatisticsService } from './statistics.mjs'

// Services are instantiated once and share access to app, db, sql
// Each request creates a transaction context via middleware
const services = {}

export function initServices() {
  const ctx = { app, db, sql, services }

  services.info = new InfoService(ctx)
  services.block = new BlockService(ctx)
  services.transaction = new TransactionService(ctx)
  services.address = new AddressService(ctx)
  services.balance = new BalanceService(ctx)
  services.contract = new ContractService(ctx)
  services.misc = new MiscService(ctx)
  services.qrc20 = new QRC20Service(ctx)
  services.qrc721 = new QRC721Service(ctx)
  services.statistics = new StatisticsService(ctx)

  return services
}

export default services
