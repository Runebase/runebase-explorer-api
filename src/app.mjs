import path from 'path'
import { pathToFileURL } from 'url'
import config from './config/index.mjs'

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
    return this[RUNEBASEINFO]
  },

  async initRunebaseinfo() {
    if (!this[RUNEBASEINFO]) {
      const libPath = pathToFileURL(path.resolve(config.runebaseinfo.path, 'src', 'lib', 'index.mjs')).href
      const rpcPath = pathToFileURL(path.resolve(config.runebaseinfo.path, 'src', 'rpc', 'index.mjs')).href
      const lib = await import(libPath)
      const rpc = await import(rpcPath)
      this[RUNEBASEINFO] = {
        lib,
        rpc: rpc.default
      }
    }
  },

  // These get set during initialization
  db: null,
  redis: null,
  io: null,
  Sequelize: null,
}

export default app
