export class QRC721Service {
  constructor({ app, db, sql, services }) {
    this.app = app
    this.db = db
    this.sql = sql
    this.services = services
  }

  async listQRC721Tokens(pagination, transaction) {
    const sql = this.sql
    let { limit, offset } = pagination

    let [{ totalCount }] = await this.db.sequelize.query(sql`
      SELECT COUNT(DISTINCT(qrc721_token.contract_address)) AS count FROM qrc721_token
      INNER JOIN qrc721 USING (contract_address)
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    let list = await this.db.sequelize.query(sql`
      SELECT
        contract.address_string AS address, contract.address AS addressHex,
        qrc721.name AS name, qrc721.symbol AS symbol, qrc721.total_supply AS totalSupply,
        list.holders AS holders
      FROM (
        SELECT contract_address, COUNT(*) AS holders FROM qrc721_token
        INNER JOIN qrc721 USING (contract_address)
        GROUP BY contract_address
        ORDER BY holders DESC
        LIMIT ${offset}, ${limit}
      ) list
      INNER JOIN qrc721 USING (contract_address)
      INNER JOIN contract ON contract.address = list.contract_address
      ORDER BY holders DESC
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })

    return {
      totalCount,
      tokens: list.map(item => ({
        address: item.addressHex.toString('hex'),
        addressHex: item.addressHex,
        name: item.name.toString(),
        symbol: item.symbol.toString(),
        totalSupply: BigInt(`0x${item.totalSupply.toString('hex')}`),
        holders: item.holders
      }))
    }
  }

  async getAllQRC721Balances(hexAddresses, transaction) {
    if (hexAddresses.length === 0) {
      return []
    }
    const sql = this.sql
    let list = await this.db.sequelize.query(sql`
      SELECT
        contract.address AS addressHex, contract.address_string AS address,
        qrc721.name AS name,
        qrc721.symbol AS symbol,
        qrc721_token.count AS count
      FROM (
        SELECT contract_address, COUNT(*) AS count FROM qrc721_token
        WHERE holder IN ${hexAddresses}
        GROUP BY contract_address
      ) qrc721_token
      INNER JOIN contract ON contract.address = qrc721_token.contract_address
      INNER JOIN qrc721 ON qrc721.contract_address = qrc721_token.contract_address
    `, { type: this.db.sequelize.QueryTypes.SELECT, transaction })
    return list.map(item => ({
      address: item.addressHex.toString('hex'),
      addressHex: item.addressHex,
      name: item.name.toString(),
      symbol: item.symbol.toString(),
      count: item.count
    }))
  }
}
