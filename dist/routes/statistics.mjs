import app from '../app.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/stats/daily-transactions', asyncHandler(async (req, res) => {
    let dailyTransactions = JSON.parse((await app.redis.hGet(app.name, 'daily-transactions')) || '[]');
    res.json(dailyTransactions.map(({
      timestamp,
      transactionsCount,
      contractTransactionsCount
    }) => ({
      time: new Date(timestamp * 1000),
      transactionCount: transactionsCount,
      contractTransactionCount: contractTransactionsCount
    })));
  }));
  router.get('/stats/block-interval', asyncHandler(async (req, res) => {
    let blockInterval = JSON.parse((await app.redis.hGet(app.name, 'block-interval')) || '[]');
    res.json(blockInterval);
  }));
  router.get('/stats/address-growth', asyncHandler(async (req, res) => {
    let addressGrowth = JSON.parse((await app.redis.hGet(app.name, 'address-growth')) || '[]');
    res.json(addressGrowth.map(({
      timestamp,
      count
    }) => ({
      time: new Date(timestamp * 1000),
      addresses: count
    })));
  }));
};