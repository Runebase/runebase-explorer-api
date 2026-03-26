import services from '../services/index.mjs';
import app from '../app.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/blocks', asyncHandler(async (req, res) => {
    let date = req.query.date;
    if (!date) {
      let d = new Date();
      let yyyy = d.getUTCFullYear().toString();
      let mm = (d.getUTCMonth() + 1).toString();
      let dd = d.getUTCDate().toString();
      date = `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
    }
    let min = Math.floor(Date.parse(date) / 1000);
    let max = min + 24 * 60 * 60;
    let {
      blocks
    } = await services.block.listBlocks({
      min,
      max
    }, null, req.state.transaction);
    res.json(blocks.map(block => ({
      hash: block.hash.toString('hex'),
      height: block.height,
      timestamp: block.timestamp,
      ...(block.height > 0 ? {
        interval: block.interval
      } : {}),
      size: block.size,
      transactionCount: block.transactionsCount,
      miner: block.miner,
      reward: block.reward.toString()
    })));
  }));
  router.get('/block/list', asyncHandler(async (req, res) => {
    let dateFilter = null;
    let date = req.query.date;
    if (date) {
      let min = Math.floor(Date.parse(date) / 1000);
      let max = min + 24 * 60 * 60;
      dateFilter = {
        min,
        max
      };
    }
    let result = await services.block.listBlocks(dateFilter, req.state.pagination, req.state.transaction);
    res.json({
      totalCount: result.totalCount,
      blocks: result.blocks.map(block => ({
        hash: block.hash.toString('hex'),
        height: block.height,
        timestamp: block.timestamp,
        ...(block.height > 0 ? {
          interval: block.interval
        } : {}),
        size: block.size,
        transactionCount: block.transactionsCount,
        miner: block.miner,
        reward: block.reward.toString()
      }))
    });
  }));
  router.get('/block/:block', asyncHandler(async (req, res) => {
    let arg = req.params.block;
    if (!arg) return res.status(404).end();
    if (/^(0|[1-9]\d{0,9})$/.test(arg)) {
      arg = Number.parseInt(arg);
    } else if (/^[0-9a-f]{64}$/i.test(arg)) {
      arg = Buffer.from(arg, 'hex');
    } else {
      return res.status(400).end();
    }
    let block = await services.block.getBlock(arg, req.state.transaction);
    if (!block) return res.status(404).end();
    res.json({
      hash: block.hash.toString('hex'),
      height: block.height,
      version: block.version,
      prevHash: block.prevHash.toString('hex'),
      ...(block.nextHash ? {
        nextHash: block.nextHash.toString('hex')
      } : {}),
      merkleRoot: block.merkleRoot.toString('hex'),
      timestamp: block.timestamp,
      bits: block.bits.toString(16),
      nonce: block.nonce,
      hashStateRoot: block.hashStateRoot.toString('hex'),
      hashUTXORoot: block.hashUTXORoot.toString('hex'),
      prevOutStakeHash: block.stakePrevTxId.toString('hex'),
      prevOutStakeN: block.stakeOutputIndex,
      signature: block.signature.toString('hex'),
      chainwork: block.chainwork.toString(16).padStart(64, '0'),
      flags: block.proofOfStake ? 'proof-of-stake' : 'proof-of-work',
      ...(block.height > 0 ? {
        interval: block.interval
      } : {}),
      size: block.size,
      weight: block.weight,
      transactions: block.transactions.map(id => id.toString('hex')),
      miner: block.miner,
      difficulty: block.difficulty,
      reward: block.reward.toString(),
      confirmations: app.blockchainInfo.tip.height - block.height + 1
    });
  }));
  router.get('/raw-block/:block', asyncHandler(async (req, res) => {
    let arg = req.params.block;
    if (!arg) return res.status(404).end();
    if (/^(0|[1-9]\d{0,9})$/.test(arg)) {
      arg = Number.parseInt(arg);
    } else if (/^[0-9a-f]{64}$/i.test(arg)) {
      arg = Buffer.from(arg, 'hex');
    } else {
      return res.status(400).end();
    }
    let block = await services.block.getRawBlock(arg, req.state.transaction);
    if (!block) return res.status(404).end();
    res.send(block.toBuffer().toString('hex'));
  }));
  router.get('/recent-blocks', asyncHandler(async (req, res) => {
    let count = Number.parseInt(req.query.count || 10);
    let blocks = await services.block.getRecentBlocks(count, req.state.transaction);
    res.json(blocks.map(block => ({
      hash: block.hash.toString('hex'),
      height: block.height,
      timestamp: block.timestamp,
      ...(block.height > 0 ? {
        interval: block.interval
      } : {}),
      size: block.size,
      transactionCount: block.transactionsCount,
      miner: block.miner,
      reward: block.reward.toString()
    })));
  }));
};