import services from '../services/index.mjs';
const asyncHandler = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
export default router => {
  router.get('/qrc721', asyncHandler(async (req, res) => {
    let {
      totalCount,
      tokens
    } = await services.qrc721.listQRC721Tokens(req.state.pagination, req.state.transaction);
    res.json({
      totalCount,
      tokens: tokens.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex.toString('hex'),
        name: item.name,
        symbol: item.symbol,
        totalSupply: item.totalSupply.toString(),
        holders: item.holders
      }))
    });
  }));
};