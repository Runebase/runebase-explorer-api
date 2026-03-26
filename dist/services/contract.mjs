export class ContractService {
  constructor({
    app,
    db,
    sql,
    services
  }) {
    this.app = app;
    this.db = db;
    this.sql = sql;
    this.services = services;
  }
  async getContractAddresses(list, transaction) {
    const {
      Address
    } = this.app.explorerDaemon.lib;
    const chain = this.app.chain;
    const {
      Contract
    } = this.db;
    let result = [];
    for (let item of list) {
      let rawAddress;
      try {
        rawAddress = Address.fromString(item, chain);
      } catch (err) {
        let error = new Error('Bad Request');
        error.status = 400;
        throw error;
      }
      let filter;
      if (rawAddress.type === Address.CONTRACT) {
        filter = {
          address: Buffer.from(item, 'hex')
        };
      } else if (rawAddress.type === Address.EVM_CONTRACT) {
        filter = {
          addressString: item
        };
      } else {
        let error = new Error('Bad Request');
        error.status = 400;
        throw error;
      }
      let contractResult = await Contract.findOne({
        where: filter,
        attributes: ['address', 'addressString', 'vm', 'type'],
        transaction
      });
      if (!contractResult) {
        let error = new Error('Not Found');
        error.status = 404;
        throw error;
      }
      result.push(contractResult.address);
    }
    return result;
  }
  async getContractSummary(contractAddress, addressIds, fromBlock, toBlock, transaction) {
    const {
      Contract,
      Qrc20: QRC20,
      Qrc20Statistics: QRC20Statistics,
      Qrc721: QRC721
    } = this.db;
    const {
      balance: balanceService,
      qrc20: qrc20Service,
      qrc721: qrc721Service
    } = this.services;
    let contract = await Contract.findOne({
      where: {
        address: contractAddress
      },
      attributes: ['addressString', 'vm', 'type'],
      include: [{
        model: QRC20,
        as: 'qrc20',
        required: false,
        attributes: ['name', 'symbol', 'decimals', 'totalSupply', 'version'],
        include: [{
          model: QRC20Statistics,
          as: 'statistics',
          required: true
        }]
      }, {
        model: QRC721,
        as: 'qrc721',
        required: false,
        attributes: ['name', 'symbol', 'totalSupply']
      }],
      transaction
    });
    let [{
      totalReceived,
      totalSent
    }, unconfirmed, qrc20Balances, qrc721Balances, transactionCount] = await Promise.all([balanceService.getTotalBalanceChanges(addressIds, transaction), balanceService.getUnconfirmedBalance(addressIds, transaction), qrc20Service.getAllQRC20Balances([contractAddress], transaction), qrc721Service.getAllQRC721Balances([contractAddress], transaction), this.getContractTransactionCount(contractAddress, addressIds, fromBlock, toBlock, transaction)]);
    return {
      address: contractAddress.toString('hex'),
      addressHex: contractAddress,
      vm: contract.vm,
      type: contract.type,
      ...(contract.type === 'qrc20' ? {
        qrc20: {
          name: contract.qrc20.name,
          symbol: contract.qrc20.symbol,
          decimals: contract.qrc20.decimals,
          totalSupply: contract.qrc20.totalSupply,
          version: contract.qrc20.version,
          holders: contract.qrc20.statistics.holders,
          transactions: contract.qrc20.statistics.transactions
        }
      } : {}),
      ...(contract.type === 'qrc721' ? {
        qrc721: {
          name: contract.qrc721.name,
          symbol: contract.qrc721.symbol,
          totalSupply: contract.qrc721.totalSupply
        }
      } : {}),
      balance: totalReceived - totalSent,
      totalReceived,
      totalSent,
      unconfirmed,
      qrc20Balances,
      qrc721Balances,
      transactionCount
    };
  }
  async getContractTransactionCount(contractAddress, addressIds, fromBlock, toBlock, transaction) {
    const TransferABI = this.app.explorerDaemon.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer');
    const sql = this.sql;
    let topic = Buffer.concat([Buffer.alloc(12), contractAddress]);
    let [{
      count
    }] = await this.db.sequelize.query(sql`
      SELECT COUNT(*) AS count FROM (
        SELECT transaction_id FROM balance_change
        WHERE address_id IN ${addressIds} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
        UNION
        SELECT transaction_id FROM evm_receipt
        WHERE contract_address = ${contractAddress} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
        UNION
        SELECT receipt.transaction_id AS transaction_id FROM evm_receipt receipt, evm_receipt_log log
        WHERE log.receipt_id = receipt._id AND log.address = ${contractAddress}
          AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
        UNION
        SELECT receipt.transaction_id AS transaction_id FROM evm_receipt receipt, evm_receipt_log log, contract
        WHERE log.receipt_id = receipt._id
          AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
          AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
          AND log.topic1 = ${TransferABI.id}
          AND (log.topic2 = ${topic} OR log.topic3 = ${topic})
          AND (
            (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
            OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
          )
      ) list
    `, {
      type: this.db.sequelize.QueryTypes.SELECT,
      transaction
    });
    return count;
  }
  async getContractTransactions(contractAddress, addressIds, pagination, fromBlock, toBlock, transaction) {
    const TransferABI = this.app.explorerDaemon.lib.Solidity.qrc20ABIs.find(abi => abi.name === 'Transfer');
    const sql = this.sql;
    let {
      limit,
      offset,
      reversed = true
    } = pagination;
    let order = reversed ? 'DESC' : 'ASC';
    let topic = Buffer.concat([Buffer.alloc(12), contractAddress]);
    let totalCount = await this.getContractTransactionCount(contractAddress, addressIds, fromBlock, toBlock, transaction);
    let transactions = (await this.db.sequelize.query(sql`
      SELECT tx.id AS id FROM (
        SELECT block_height, index_in_block, _id FROM (
          SELECT block_height, index_in_block, transaction_id AS _id FROM balance_change
          WHERE address_id IN ${addressIds} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
          UNION
          SELECT block_height, index_in_block, transaction_id AS _id FROM evm_receipt
          WHERE contract_address = ${contractAddress} AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock)}
          UNION
          SELECT receipt.block_height AS block_height, receipt.index_in_block AS index_in_block, receipt.transaction_id AS _id
          FROM evm_receipt receipt, evm_receipt_log log
          WHERE log.receipt_id = receipt._id AND log.address = ${contractAddress}
            AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
          UNION
          SELECT receipt.block_height AS block_height, receipt.index_in_block AS index_in_block, receipt.transaction_id AS _id
          FROM evm_receipt receipt, evm_receipt_log log, contract
          WHERE log.receipt_id = receipt._id
            AND ${this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height')}
            AND contract.address = log.address AND contract.type IN ('qrc20', 'qrc721')
            AND log.topic1 = ${TransferABI.id}
            AND (log.topic2 = ${topic} OR log.topic3 = ${topic})
            AND (
              (contract.type = 'qrc20' AND log.topic3 IS NOT NULL AND log.topic4 IS NULL)
              OR (contract.type = 'qrc721' AND log.topic4 IS NOT NULL)
            )
        ) list
        ORDER BY block_height ${{
      raw: order
    }}, index_in_block ${{
      raw: order
    }}, _id ${{
      raw: order
    }}
        LIMIT ${offset}, ${limit}
      ) list, transaction tx
      WHERE tx._id = list._id
      ORDER BY list.block_height ${{
      raw: order
    }}, list.index_in_block ${{
      raw: order
    }}, list._id ${{
      raw: order
    }}
    `, {
      type: this.db.sequelize.QueryTypes.SELECT,
      transaction
    })).map(({
      id
    }) => id);
    return {
      totalCount,
      transactions
    };
  }
  async getContractBasicTransactionCount(contractAddress, fromBlock, toBlock, transaction) {
    const {
      EvmReceipt: EVMReceipt
    } = this.db;
    return await EVMReceipt.count({
      where: {
        contractAddress,
        ...this.services.block.getBlockFilter(fromBlock, toBlock)
      },
      transaction
    });
  }
  async getContractBasicTransactions(contractAddress, pagination, fromBlock, toBlock, transaction) {
    const {
      Address,
      OutputScript
    } = this.app.explorerDaemon.lib;
    const {
      Header,
      Transaction,
      TransactionOutput,
      Contract,
      EvmReceipt: EVMReceipt,
      EvmReceiptLog: EVMReceiptLog
    } = this.db;
    const {
      in: $in
    } = this.db.Sequelize.Op;
    let {
      limit,
      offset,
      reversed = true
    } = pagination;
    let order = reversed ? 'DESC' : 'ASC';
    let totalCount = await this.getContractBasicTransactionCount(contractAddress, fromBlock, toBlock, transaction);
    let receiptIds = (await EVMReceipt.findAll({
      where: {
        contractAddress,
        ...this.services.block.getBlockFilter(fromBlock, toBlock)
      },
      attributes: ['_id'],
      order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order], ['outputIndex', order]],
      limit,
      offset,
      transaction
    })).map(receipt => receipt._id);
    let receipts = await EVMReceipt.findAll({
      where: {
        _id: {
          [$in]: receiptIds
        }
      },
      include: [{
        model: Header,
        as: 'header',
        required: false,
        attributes: ['hash', 'timestamp']
      }, {
        model: Transaction,
        as: 'transaction',
        required: true,
        attributes: ['id']
      }, {
        model: TransactionOutput,
        as: 'output',
        on: {
          transactionId: this.db.sequelize.where(this.db.sequelize.col('output.transaction_id'), '=', this.db.sequelize.col('evm_receipt.transaction_id')),
          outputIndex: this.db.sequelize.where(this.db.sequelize.col('output.output_index'), '=', this.db.sequelize.col('evm_receipt.output_index'))
        },
        required: true,
        attributes: ['scriptPubKey', 'value']
      }, {
        model: EVMReceiptLog,
        as: 'logs',
        required: false,
        include: [{
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['addressString']
        }]
      }, {
        model: Contract,
        as: 'contract',
        required: true,
        attributes: ['addressString']
      }],
      order: [['blockHeight', order], ['indexInBlock', order], ['transactionId', order], ['outputIndex', order]],
      transaction
    });
    let transactions = receipts.map(receipt => ({
      transactionId: receipt.transaction.id,
      outputIndex: receipt.outputIndex,
      ...(receipt.header ? {
        blockHeight: receipt.blockHeight,
        blockHash: receipt.header.hash,
        timestamp: receipt.header.timestamp,
        confirmations: this.app.blockchainInfo.tip.height - receipt.blockHeight + 1
      } : {
        confirmations: 0
      }),
      scriptPubKey: OutputScript.fromBuffer(receipt.output.scriptPubKey),
      value: receipt.output.value,
      sender: new Address({
        type: receipt.senderType,
        data: receipt.senderData,
        chain: this.app.chain
      }),
      gasUsed: receipt.gasUsed,
      contractAddress: receipt.contractAddress.toString('hex'),
      contractAddressHex: receipt.contractAddress,
      excepted: receipt.excepted,
      exceptedMessage: receipt.exceptedMessage,
      evmLogs: receipt.logs.sort((x, y) => x.logIndex - y.logIndex).map(log => ({
        address: log.address.toString('hex'),
        addressHex: log.address,
        topics: this.services.transaction.transformTopics(log),
        data: log.data
      }))
    }));
    return {
      totalCount,
      transactions
    };
  }
  async callContract(contract, data, sender) {
    let client = new this.app.explorerDaemon.rpc(this.app.config.explorerDaemon.rpc);
    return await client.callcontract(contract.toString('hex'), data.toString('hex'), ...(sender == null ? [] : [sender.toString('hex')]));
  }
  async searchLogs({
    contract,
    topic1,
    topic2,
    topic3,
    topic4
  } = {}, pagination, fromBlock, toBlock, transaction) {
    const {
      Address
    } = this.app.explorerDaemon.lib;
    const {
      Header,
      Transaction,
      EvmReceipt: EVMReceipt,
      EvmReceiptLog: EVMReceiptLog,
      Contract
    } = this.db;
    const {
      in: $in
    } = this.db.Sequelize.Op;
    const sql = this.sql;
    let {
      limit,
      offset
    } = pagination;
    let blockFilter = this.services.block.getRawBlockFilter(fromBlock, toBlock, 'receipt.block_height');
    let contractFilter = contract ? sql`log.address = ${contract}` : 'TRUE';
    let topic1Filter = topic1 ? sql`log.topic1 = ${topic1}` : 'TRUE';
    let topic2Filter = topic2 ? sql`log.topic2 = ${topic2}` : 'TRUE';
    let topic3Filter = topic3 ? sql`log.topic3 = ${topic3}` : 'TRUE';
    let topic4Filter = topic4 ? sql`log.topic4 = ${topic4}` : 'TRUE';
    let [{
      count: totalCount
    }] = await this.db.sequelize.query(sql`
      SELECT COUNT(DISTINCT(log._id)) AS count from evm_receipt receipt, evm_receipt_log log
      WHERE receipt._id = log.receipt_id AND ${blockFilter} AND ${{
      raw: contractFilter
    }}
        AND ${{
      raw: topic1Filter
    }} AND ${{
      raw: topic2Filter
    }} AND ${{
      raw: topic3Filter
    }} AND ${{
      raw: topic4Filter
    }}
    `, {
      type: this.db.sequelize.QueryTypes.SELECT,
      transaction
    });
    if (totalCount === 0) {
      return {
        totalCount,
        logs: []
      };
    }
    let ids = (await this.db.sequelize.query(sql`
      SELECT log._id AS _id from evm_receipt receipt, evm_receipt_log log
      WHERE receipt._id = log.receipt_id AND ${blockFilter} AND ${{
      raw: contractFilter
    }}
        AND ${{
      raw: topic1Filter
    }} AND ${{
      raw: topic2Filter
    }} AND ${{
      raw: topic3Filter
    }} AND ${{
      raw: topic4Filter
    }}
      ORDER BY log._id ASC
      LIMIT ${offset}, ${limit}
    `, {
      type: this.db.sequelize.QueryTypes.SELECT,
      transaction
    })).map(log => log._id);
    let logs = await EVMReceiptLog.findAll({
      where: {
        _id: {
          [$in]: ids
        }
      },
      attributes: ['topic1', 'topic2', 'topic3', 'topic4', 'data'],
      include: [{
        model: EVMReceipt,
        as: 'receipt',
        required: true,
        attributes: ['transactionId', 'outputIndex', 'blockHeight', 'senderType', 'senderData'],
        include: [{
          model: Transaction,
          as: 'transaction',
          required: true,
          attributes: ['id'],
          include: [{
            model: Header,
            as: 'header',
            required: true,
            attributes: ['hash', 'height', 'timestamp']
          }]
        }, {
          model: Contract,
          as: 'contract',
          required: true,
          attributes: ['address', 'addressString']
        }]
      }, {
        model: Contract,
        as: 'contract',
        required: true,
        attributes: ['address', 'addressString']
      }],
      order: [['_id', 'ASC']],
      transaction
    });
    return {
      totalCount,
      logs: logs.map(log => ({
        transactionId: log.receipt.transaction.id,
        outputIndex: log.receipt.outputIndex,
        blockHeight: log.receipt.transaction.header.height,
        blockHash: log.receipt.transaction.header.hash,
        timestamp: log.receipt.transaction.header.timestamp,
        sender: new Address({
          type: log.receipt.senderType,
          data: log.receipt.senderData,
          chain: this.app.chain
        }),
        contractAddress: log.receipt.contract.address.toString('hex'),
        contractAddressHex: log.receipt.contract.address,
        address: log.contract.address.toString('hex'),
        addressHex: log.contract.address,
        topics: this.services.transaction.transformTopics(log),
        data: log.data
      }))
    };
  }
  async transformHexAddresses(addresses, transaction) {
    if (addresses.length === 0) {
      return [];
    }
    const {
      Contract
    } = this.db;
    const {
      in: $in
    } = this.db.Sequelize.Op;
    const {
      Address
    } = this.app.explorerDaemon.lib;
    let result = addresses.map(address => Buffer.compare(address, Buffer.alloc(20)) === 0 ? null : address);
    let contracts = await Contract.findAll({
      where: {
        address: {
          [$in]: addresses.filter(address => Buffer.compare(address, Buffer.alloc(20)) !== 0)
        }
      },
      attributes: ['address', 'addressString'],
      transaction
    });
    let mapping = new Map(contracts.map(({
      address,
      addressString
    }) => [address.toString('hex'), addressString]));
    for (let i = 0; i < result.length; ++i) {
      if (result[i]) {
        let string = mapping.get(result[i].toString('hex'));
        if (string) {
          result[i] = {
            string,
            hex: result[i]
          };
        } else {
          result[i] = new Address({
            type: Address.PAY_TO_PUBLIC_KEY_HASH,
            data: result[i],
            chain: this.app.chain
          }).toString();
        }
      }
    }
    return result;
  }
}