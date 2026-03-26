import path from 'path';
import { pathToFileURL } from 'url';
import config from './config/index.mjs';
const CHAIN = Symbol('runebase.chain');
const EXPLORER_DAEMON = Symbol('explorerDaemon');
const app = {
  name: 'runebase-explorer-api',
  config,
  blockchainInfo: {
    tip: null
  },
  get chain() {
    if (!this[CHAIN]) {
      this[CHAIN] = this.explorerDaemon.lib.Chain.get(config.runebase.chain);
    }
    return this[CHAIN];
  },
  get explorerDaemon() {
    return this[EXPLORER_DAEMON];
  },
  async initExplorerDaemon() {
    if (!this[EXPLORER_DAEMON]) {
      const libPath = pathToFileURL(path.resolve(config.explorerDaemon.path, 'src', 'lib', 'index.mjs')).href;
      const rpcPath = pathToFileURL(path.resolve(config.explorerDaemon.path, 'src', 'rpc', 'index.mjs')).href;
      const lib = await import(libPath);
      const rpc = await import(rpcPath);
      this[EXPLORER_DAEMON] = {
        lib,
        rpc: rpc.default
      };
    }
  },
  // These get set during initialization
  db: null,
  redis: null,
  io: null,
  Sequelize: null
};
export default app;