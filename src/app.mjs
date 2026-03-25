import path from 'path'
import { createRequire } from 'module'
import config from './config/index.mjs'

const require = createRequire(import.meta.url)

const CHAIN = Symbol('runebase.chain')
const RUNEBASEINFO = Symbol('runebaseinfo')

const app = {
  name: 'runebaseinfo-api',
  config,
  blockchainInfo: {
    tip: null
  },

  get chain() {
    if (!this[CHAIN]) {
      this[CHAIN] = this.runebaseinfo.lib.Chain.get(config.runebase.chain)
    }
    return this[CHAIN]
  },

  get runebaseinfo() {
    if (!this[RUNEBASEINFO]) {
      this[RUNEBASEINFO] = {
        lib: require(path.resolve(config.runebaseinfo.path, 'lib')),
        rpc: require(path.resolve(config.runebaseinfo.path, 'rpc'))
      }
    }
    return this[RUNEBASEINFO]
  },

  // These get set during initialization
  db: null,
  redis: null,
  io: null,
  Sequelize: null,
}

export default app
