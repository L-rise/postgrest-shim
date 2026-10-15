# postgrest-shim

> 轻量级前端 PostgREST 兼容数据层
 <https://content-publish-site.app.workbuddy.host/>
  <https://shu-svcgd1rq9xm.qoder.zone/>
## 核心价值

链式查询语法 → 自定义后端 HTTP 请求，返回 `{ data, error }` 统一形状。切换后端时业务代码零改动。

## 安装

```bash
npm install postgrest-shim
```

## 快速示例

```js
import { createClient } from 'postgrest-shim'

const cloud = createClient({
  queryEndpoint: '/api/db/query',
  rpcEndpoint: '/api/db/rpc',
})

const { data, error } = await cloud.database
  .from('articles')
  .select('*')
  .eq('status', 'published')
  .order('id', { ascending: false })
  .limit(10)
```

## API

### `createClient(opts)`

创建客户端实例。`opts.queryEndpoint` 与 `opts.rpcEndpoint` 指定后端接收地址。

### `database.from(table)`

返回 Query 链式对象，支持链式调用后 `await` 直接执行。

### `database.rpc(fn, args)`

调用远程函数（RPC），`fn` 为函数名，`args` 为参数对象。

## Query 方法

| 类别 | 方法 |
| --- | --- |
| 读取 | `select`、`single`、`maybeSingle` |
| 写入 | `insert`、`upsert`、`update`、`delete` |
| 过滤 | `eq`、`neq`、`gt`、`gte`、`lt`、`lte`、`like`、`ilike`、`contains`、`in`、`is`、`not`、`match` |
| 组合 | `or` |
| 排序/分页 | `order`、`limit`、`range` |

## 特性

- **thenable**：Query 对象可直接 `await`，无需 `.then()` 回调包装
- **零依赖**：不引入任何第三方库，体积小巧
- **同构**：浏览器与 Node.js 环境均可使用

## License

MIT
