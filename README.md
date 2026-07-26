# @vafast/opentelemetry

Vafast 的 OpenTelemetry **追踪（tracing）** 中间件：为每个 HTTP 请求创建根 span，并导出 `getTracer` / `startActiveSpan` 等辅助 API。

完整 metrics / logs 需自行配置 NodeSDK 或其它方案。

## 先搞清几个概念

| 名词 | 白话 |
|------|------|
| **Trace** | 一次请求的完整调用链（同一 `traceId`） |
| **Span** | 链上的一段计时操作（HTTP 入口、DB、下游调用等） |
| **instrumentations** | 交给 NodeSDK 的自动埋点插件（如 `getNodeAutoInstrumentations()`） |
| **Preload vs 中间件** | 生产建议进程入口先 `NodeSDK.start()`；若仍是 `ProxyTracer`，`opentelemetry()` 会就地启动 SDK |

中间件会 `propagation.extract` 入站 Headers，创建 `SERVER` 根 span，名称最终为 `` `${method} ${pathname}` ``。

## 安装

```bash
npm install @vafast/opentelemetry
```

## 快速开始

```typescript
import { Server, defineRoute, defineRoutes, serve } from 'vafast'
import { opentelemetry } from '@vafast/opentelemetry'

const routes = defineRoutes([
  defineRoute({
    method: 'GET',
    path: '/',
    handler: () => ({ ok: true }),
  }),
])

const server = new Server(routes)
server.use(
  opentelemetry({
    serviceName: 'my-app', // 默认 '@vafast/vafast'
    instrumentations: [],
  }),
)

serve({ fetch: server.fetch, port: 3000 })
```

### 推荐：先 preload NodeSDK

```typescript
// preload.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'

new NodeSDK({
  serviceName: 'your-service',
  instrumentations: [getNodeAutoInstrumentations()],
  spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter())],
}).start()
```

```typescript
import './preload'
import { opentelemetry } from '@vafast/opentelemetry'

server.use(opentelemetry({ serviceName: 'your-service' }))
```

### 业务 span

```typescript
import { startActiveSpan, setAttributes } from '@vafast/opentelemetry'

await startActiveSpan('db.query', async (span) => {
  span.setAttributes({ 'db.system': 'postgres' })
  setAttributes({ 'cache.hit': false })
})
```

## API

### `opentelemetry(options?)`

`options` 透传 NodeSDK，初学者常用：

| 参数 | 说明 |
|------|------|
| `serviceName` | 服务名，默认 `'@vafast/vafast'` |
| `instrumentations` | 自动埋点插件 |
| `spanProcessors` / `traceExporter` | 如何把 span 导出到后端 |
| `sampler` | 采样，控制上报量 |
| `resource` | 资源属性（环境、版本等） |
| `contextManager` | 本包补充：全局尚无 ContextManager 时设置 |

另支持 NodeSDK 的 propagator、spanLimits、metricReader 等——主路径仍是 tracing。

### 主要导出

| 导出 | 说明 |
|------|------|
| `opentelemetry(options?)` | HTTP 追踪中间件 |
| `getTracer()` | 包装后的 tracer |
| `startActiveSpan` / `record` | 活跃 span（自动 end / 记错） |
| `getCurrentSpan()` | 当前 span |
| `setAttributes(attrs)` | 写当前 span 属性 |

## 最佳实践

- Preload SDK，中间件只管 HTTP 根 span
- Span 名稳定、低基数；敏感数据不要进属性
- 高流量务必配置采样

## 注意事项

- 成功路径会 clone 响应估算 body size
- 不写入 User-Agent 请求头属性
- 注意与其它库的全局 OTel 初始化顺序

## 相关链接

- 文档：[OpenTelemetry](https://vafast.dev/middleware/opentelemetry)（仓库内 `vafast-doc/docs/middleware/opentelemetry.md`）
- [OpenTelemetry JS](https://opentelemetry.io/docs/languages/js/)
- [NodeSDK](https://www.npmjs.com/package/@opentelemetry/sdk-node)

## License

MIT
