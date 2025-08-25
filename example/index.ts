import { Server, createRouteHandler } from 'vafast'
import { opentelemetry } from '../src/index'

// 创建 OpenTelemetry 中间件
const telemetryMiddleware = opentelemetry({
	serviceName: 'example-app',
	instrumentations: []
})

// 定义路由
const routes = [
	{
		method: 'GET',
		path: '/',
		handler: createRouteHandler(() => {
			return 'Hello, Vafast with OpenTelemetry!'
		})
	},
	{
		method: 'GET',
		path: '/health',
		handler: createRouteHandler(() => {
			return { status: 200, data: 'OK' }
		})
	}
]

// 创建服务器
const server = new Server(routes)

// 导出 fetch 函数，应用中间件
export default {
	fetch: (req: Request) => {
		// 应用 OpenTelemetry 中间件
		return telemetryMiddleware(req, () => server.fetch(req))
	}
}
