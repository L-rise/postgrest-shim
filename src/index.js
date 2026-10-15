/** 
 * postgrest-shim — 轻量级前端 PostgREST 兼容数据层
 * --------------------------------------------------------------------------
 * 把链式查询语法（.from('table').select().eq().order().limit()）翻译成
 * 自定义后端的 HTTP 请求，返回 { data, error } 统一形状。
 *
 * 用法：
 *   import { createClient } from 'postgrest-shim'
 *   const cloud = createClient({ endpoint: '/api/db/query', rpcEndpoint: '/api/db/rpc' })
 *   const { data, error } = await cloud.from('articles').select('*').eq('status','published').order('id',{ascending:false}).limit(10)
 */

/* --------------------------------------------------------------------------
   基础请求：约定的返回形状 { data, error }
   -------------------------------------------------------------------------- */
function rpcError(message, code) {
  return { data: null, error: { message: message, code: code || 'error' } }
}

function request(url, options, fetchFn) {
  var opts = options || {}
  var method = opts.method || 'POST'
  var requestOptions = {
    method: method,
    credentials: 'same-origin',
    cache: 'no-store'
  }
  if (method !== 'GET' && method !== 'HEAD') {
    requestOptions.headers = opts.body instanceof FormData
      ? undefined
      : { 'Content-Type': 'application/json' }
    requestOptions.body = opts.body instanceof FormData
      ? opts.body
      : JSON.stringify(opts.body || {})
  }
  var f = fetchFn || (typeof fetch !== 'undefined' ? fetch : null)
  if (!f) return Promise.resolve(rpcError('fetch 不可用', 'no_fetch'))
  return f(url, requestOptions).then(function (res) {
    return res.json().catch(function () { return null }).then(function (json) {
      if (json && typeof json === 'object') {
        if (json.error) return { data: null, error: json.error }
        return { data: json.data === undefined ? null : json.data, error: null, count: json.count }
      }
      return rpcError('服务返回了无法解析的内容（HTTP ' + res.status + '）', 'bad_response')
    })
  }).catch(function (e) {
    return rpcError((e && e.message) || '网络请求失败', 'network_error')
  })
}

/* --------------------------------------------------------------------------
   链式查询构建器
   -------------------------------------------------------------------------- */
export function Query(table, endpoints, fetchFn) {
  this._table = table
  this._endpoints = endpoints
  this._fetchFn = fetchFn
  this._action = 'select'
  this._columns = null
  this._countMode = null
  this._filters = []
  this._orFilters = []
  this._orders = []
  this._limitN = null
  this._offsetN = null
  this._singleMode = null
  this._payload = null
}

Query.prototype.select = function (columns, opts) {
  this._columns = columns || null
  if (opts && opts.count) this._countMode = opts.count
  return this
}
Query.prototype.insert = function (payload) { this._action = 'insert'; this._payload = payload; return this }
Query.prototype.upsert = function (payload) { this._action = 'upsert'; this._payload = payload; return this }
Query.prototype.update = function (payload) { this._action = 'update'; this._payload = payload; return this }
Query.prototype.delete = function () { this._action = 'delete'; return this }

/* 过滤条件 */
Query.prototype.eq = function (c, v) { this._filters.push({ column: c, op: 'eq', value: v }); return this }
Query.prototype.neq = function (c, v) { this._filters.push({ column: c, op: 'neq', value: v }); return this }
Query.prototype.gt = function (c, v) { this._filters.push({ column: c, op: 'gt', value: v }); return this }
Query.prototype.gte = function (c, v) { this._filters.push({ column: c, op: 'gte', value: v }); return this }
Query.prototype.lt = function (c, v) { this._filters.push({ column: c, op: 'lt', value: v }); return this }
Query.prototype.lte = function (c, v) { this._filters.push({ column: c, op: 'lte', value: v }); return this }
Query.prototype.like = function (c, v) { this._filters.push({ column: c, op: 'like', value: v }); return this }
Query.prototype.ilike = function (c, v) { this._filters.push({ column: c, op: 'ilike', value: v }); return this }
Query.prototype.contains = function (c, v) { this._filters.push({ column: c, op: 'contains', value: v }); return this }
Query.prototype.in = function (c, arr) { this._filters.push({ column: c, op: 'in', value: arr || [] }); return this }
Query.prototype.is = function (c, v) { this._filters.push({ column: c, op: 'is', value: v }); return this }
Query.prototype.not = function (c, op, v) { this._filters.push({ column: c, op: 'not', value: op, value2: v }); return this }

/** match({ a: 1, b: 2 }) — 多个 eq 的语法糖 */
Query.prototype.match = function (obj) {
  var self = this
  Object.keys(obj || {}).forEach(function (k) { self._filters.push({ column: k, op: 'eq', value: obj[k] }) })
  return this
}

/** or('a.eq.1,b.eq.2') — PostgREST 的字符串语法 */
Query.prototype.or = function (expr) {
  var self = this
  String(expr || '').split(',').forEach(function (part) {
    var seg = part.split('.')
    if (seg.length < 3) return
    var column = seg[0]
    var op = seg[1]
    var value = seg.slice(2).join('.')
    if (value === 'null') value = null
    self._orFilters.push({ column: column, op: op, value: value })
  })
  return this
}

Query.prototype.order = function (column, opts) {
  this._orders.push({ column: column, ascending: !(opts && opts.ascending === false) })
  return this
}
Query.prototype.limit = function (n) { this._limitN = Number(n); return this }
Query.prototype.range = function (from, to) {
  this._offsetN = Number(from) || 0
  this._limitN = Math.max(0, (Number(to) || 0) - (Number(from) || 0) + 1)
  return this
}
Query.prototype.single = function () { this._singleMode = 'single'; return this }
Query.prototype.maybeSingle = function () { this._singleMode = 'maybeSingle'; return this }

Query.prototype._exec = function () {
  var body = {
    table: this._table,
    action: this._action,
    columns: this._columns,
    count: this._countMode,
    filters: this._filters,
    orFilters: this._orFilters,
    orders: this._orders,
    limit: this._limitN,
    offset: this._offsetN,
    single: this._singleMode,
    payload: this._payload
  }
  return request(this._endpoints.query, { method: 'POST', body: body }, this._fetchFn)
}

/* thenable：业务代码直接 await / .then() 就能拿到 { data, error } */
Query.prototype.then = function (onOk, onErr) {
  return this._exec().then(onOk, onErr)
}
Query.prototype.catch = function (onErr) {
  return this._exec().catch(onErr)
}
Query.prototype.finally = function (fn) {
  return this._exec().finally(fn)
}

/* --------------------------------------------------------------------------
   客户端工厂
   -------------------------------------------------------------------------- */
export function createClient(opts) {
  opts = opts || {}
  var endpoints = {
    query: opts.queryEndpoint || '/api/db/query',
    rpc: opts.rpcEndpoint || '/api/db/rpc'
  }
  var fetchFn = opts.fetch || null

  var database = {
    from: function (table) { return new Query(table, endpoints, fetchFn) },
    rpc: function (fn, args) {
      return request(endpoints.rpc, { method: 'POST', body: { fn: fn, args: args || {} } }, fetchFn)
    }
  }

  return { database: database, endpoints: endpoints }
}

export { request, rpcError }
export default { createClient, Query, request, rpcError }
