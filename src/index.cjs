/**
 * postgrest-shim — CommonJS 入口
 * 用法：const { createClient } = require('postgrest-shim')
 */
const { createClient, Query, request, rpcError } = require('./index.js')
module.exports = { createClient, Query, request, rpcError }
