import path from 'path'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

dotenv.config({ path: path.resolve(__dirname, '../../.env') })

const config = {
  port: parseInt(process.env.PORT || '7001', 10),
  env: process.env.NODE_ENV || 'development',

  db: {
    dialect: process.env.DB_DIALECT || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    database: process.env.DB_NAME || 'runebaseinfo',
    username: process.env.DB_USER || 'runebaseinfo',
    password: process.env.DB_PASS || 'Runebaseinfo1!',
    logging: process.env.NODE_ENV === 'development' ? false : false,
  },

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || '',
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  runebase: {
    chain: process.env.RUNEBASE_CHAIN || 'mainnet',
  },

  runebaseinfo: {
    path: path.resolve(process.env.RUNEBASEINFO_PATH || path.join(__dirname, '../../../runebaseinfo')),
    wsPort: parseInt(process.env.RUNEBASEINFO_WS_PORT || '3001', 10),
    rpc: {
      protocol: process.env.RPC_PROTOCOL || 'http',
      host: process.env.RPC_HOST || 'localhost',
      port: parseInt(process.env.RPC_PORT || '9948', 10),
      user: process.env.RPC_USER || 'runebaseinfo',
      password: process.env.RPC_PASS || 'runebaseinfo',
    },
  },

  cmcAPIKey: process.env.CMC_API_KEY || null,

  rateLimit: {
    duration: parseInt(process.env.RATE_LIMIT_DURATION || '600000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '600', 10),
  },

  cors: {
    origin: process.env.CORS_ORIGIN || '*',
  },
}

export default config
