import app from '../app.mjs';
import db from '../models/index.mjs';
export function addressMiddleware() {
  return async (req, res, next) => {
    if (!req.params.address) {
      return res.status(404).end();
    }
    const {
      Address: RawAddress
    } = app.explorerDaemon.lib;
    const chain = app.chain;
    const {
      Address
    } = db;
    const {
      in: $in
    } = db.Sequelize.Op;
    let addresses = req.params.address.split(',');
    let rawAddresses = [];
    for (let address of addresses) {
      try {
        rawAddresses.push(RawAddress.fromString(address, chain));
      } catch (err) {
        return res.status(400).end();
      }
    }
    let result = await Address.findAll({
      where: {
        string: {
          [$in]: addresses
        }
      },
      attributes: ['_id', 'type', 'data'],
      transaction: req.state && req.state.transaction
    });
    req.state = req.state || {};
    req.state.address = {
      rawAddresses,
      addressIds: result.map(address => address._id),
      p2pkhAddressIds: result.filter(address => address.type === RawAddress.PAY_TO_PUBLIC_KEY_HASH).map(address => address._id)
    };
    next();
  };
}