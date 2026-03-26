import db from '../models/index.mjs';
export function blockFilter() {
  return async (req, res, next) => {
    const {
      Header
    } = db;
    const {
      gte: $gte,
      lte: $lte
    } = db.Sequelize.Op;
    if (!['GET', 'POST'].includes(req.method)) {
      return next();
    }
    let fromBlock = 1;
    let toBlock = null;
    let object = req.method === 'GET' ? req.query : req.body;
    if ('fromBlock' in object) {
      let height = Number.parseInt(object.fromBlock);
      if (!(height >= 0 && height <= 0xffffffff)) {
        return res.status(400).end();
      }
      if (height > fromBlock) {
        fromBlock = height;
      }
    }
    if ('toBlock' in object) {
      let height = Number.parseInt(object.toBlock);
      if (!(height >= 0 && height <= 0xffffffff)) {
        return res.status(400).end();
      }
      if (toBlock == null || height < toBlock) {
        toBlock = height;
      }
    }
    if ('fromTime' in object) {
      let timestamp = Math.floor(Date.parse(object.fromTime) / 1000);
      if (!(timestamp >= 0 && timestamp <= 0xffffffff)) {
        return res.status(400).end();
      }
      let header = await Header.findOne({
        where: {
          timestamp: {
            [$gte]: timestamp
          }
        },
        attributes: ['height'],
        order: [['timestamp', 'ASC']],
        transaction: req.state && req.state.transaction
      });
      if (header && header.height > fromBlock) {
        fromBlock = header.height;
      }
    }
    if ('toTime' in object) {
      let timestamp = Math.floor(Date.parse(object.toTime) / 1000);
      if (!(timestamp >= 0 && timestamp <= 0xffffffff)) {
        return res.status(400).end();
      }
      let header = await Header.findOne({
        where: {
          timestamp: {
            [$lte]: timestamp
          }
        },
        attributes: ['height'],
        order: [['timestamp', 'DESC']],
        transaction: req.state && req.state.transaction
      });
      if (header && (toBlock == null || header.height < toBlock)) {
        toBlock = header.height;
      }
    }
    req.state = req.state || {};
    req.state.fromBlock = fromBlock;
    req.state.toBlock = toBlock;
    next();
  };
}