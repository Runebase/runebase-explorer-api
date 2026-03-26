import cron from 'node-cron';
import app from '../app.mjs';
import services from '../services/index.mjs';
import logger from '../utils/logger.mjs';
export function initScheduledTasks() {
  // Update fee rates every hour
  cron.schedule('0 * * * *', async () => {
    try {
      let feeRate = await services.info.getFeeRates();
      if (feeRate) {
        await app.redis.hSet(app.name, 'feerate', JSON.stringify(feeRate));
        let namespace = app.io && app.io.of('/');
        if (namespace) {
          namespace.to('blockchain').emit('feerate', feeRate.find(item => item.blocks === 10).feeRate);
        }
      }
    } catch (err) {
      logger.error({
        err
      }, 'Failed to update fee rates');
    }
  });

  // Update prices every hour
  cron.schedule('0 * * * *', async () => {
    try {
      let price = await services.misc.getPrices();
      await app.redis.hSet(app.name, 'runebase-price', JSON.stringify(price));
      let namespace = app.io && app.io.of('/');
      if (namespace) {
        namespace.to('coin').emit('runebase-price', price);
      }
    } catch (err) {
      logger.error({
        err
      }, 'Failed to update prices');
    }
  });
  logger.info('Scheduled tasks initialized');
}