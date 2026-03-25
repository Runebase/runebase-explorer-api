import app from '../app.mjs'
import db from '../models/index.mjs'

export function contractMiddleware(paramName = 'contract') {
  return async (req, res, next) => {
    if (!req.params[paramName]) {
      return res.status(404).end()
    }
    const { Address: RawAddress } = app.runebaseinfo.lib
    const chain = app.chain
    const { Address, Contract } = db
    const { gte: $gte } = db.Sequelize.Op

    let contract = {}
    let rawAddress
    try {
      rawAddress = RawAddress.fromString(req.params[paramName], chain)
    } catch (err) {
      return res.status(400).end()
    }
    let filter
    if (rawAddress.type === RawAddress.CONTRACT) {
      filter = { address: Buffer.from(req.params[paramName], 'hex') }
    } else if (rawAddress.type === RawAddress.EVM_CONTRACT) {
      filter = { addressString: req.params[paramName] }
    } else {
      return res.status(400).end()
    }
    let contractResult = await Contract.findOne({
      where: filter,
      attributes: ['address', 'addressString', 'vm', 'type'],
      transaction: req.state && req.state.transaction
    })
    if (!contractResult) {
      return res.status(404).end()
    }
    contract.contractAddress = contractResult.address
    contract.address = contractResult.addressString
    contract.vm = contractResult.vm
    contract.type = contractResult.type

    let addressList = await Address.findAll({
      where: {
        type: { [$gte]: Address.parseType('contract') },
        data: contract.contractAddress
      },
      attributes: ['_id'],
      transaction: req.state && req.state.transaction
    })
    contract.addressIds = addressList.map(address => address._id)
    req.state = req.state || {}
    req.state[paramName] = contract
    next()
  }
}
