import { Server } from 'tirne'
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
		handler: () => new Response('Hello, Tirne with OpenTelemetry!')
	},
	{
		method: 'GET',
		path: '/health',
		handler: () => new Response('OK', { status: 200 })
	}
]

// 创建服务器并应用中间件
const server = new Server(routes)
server.use(telemetryMiddleware)

// 启动服务器
console.log('Server starting...')
server.listen(3000)
console.log('Server running on http://localhost:3000')
