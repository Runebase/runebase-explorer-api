import services from '../services/index.mjs';
import app from '../app.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/info', asyncHandler(async (req, res) => {
    res.json(await services.info.getInfo(req.state.transaction));
  }));
  router.get('/supply', asyncHandler(async (req, res) => {
    res.send(String(services.info.getTotalSupply()));
  }));
  router.get('/total-max-supply', asyncHandler(async (req, res) => {
    res.send(String(services.info.getTotalMaxSupply()));
  }));
  router.get('/circulating-supply', asyncHandler(async (req, res) => {
    res.send(String(services.info.getCirculatingSupply()));
  }));
  router.get('/feerates', asyncHandler(async (req, res) => {
    let feeRates = JSON.parse(await app.redis.hGet(app.name, 'feerate')).filter(item => [2, 4, 6, 12, 24].includes(item.blocks));
    res.json(feeRates);
  }));
};