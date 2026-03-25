export function pagination({ defaultPageSize = 100 } = {}) {
  return (req, res, next) => {
    if (!['GET', 'POST'].includes(req.method)) {
      return next()
    }
    let object = req.method === 'GET' ? req.query : req.body
    let limit = defaultPageSize
    let offset = 0
    let reversed
    if ('limit' in object && 'offset' in object) {
      limit = Number.parseInt(object.limit)
      offset = Number.parseInt(object.offset)
    }
    if ('pageSize' in object && 'pageIndex' in object) {
      let pageSize = Number.parseInt(object.pageSize)
      let pageIndex = Number.parseInt(object.pageIndex)
      limit = pageSize
      offset = pageSize * pageIndex
    }
    if ('pageSize' in object && 'page' in object) {
      let pageSize = Number.parseInt(object.pageSize)
      let pageIndex = Number.parseInt(object.page)
      limit = pageSize
      offset = pageSize * pageIndex
    }
    if ('from' in object && 'to' in object) {
      let from = Number.parseInt(object.from)
      let to = Number.parseInt(object.to)
      limit = to - from + 1
      offset = from
    }
    if (limit <= 0 || offset < 0) {
      return res.status(400).end()
    }
    if ('reversed' in object) {
      reversed = ![false, 'false', 0, '0'].includes(object.reversed)
    }
    req.state = req.state || {}
    req.state.pagination = { limit, offset, reversed }
    next()
  }
}
