import { Server, defineRoute, defineRoutes, json } from 'vafast'
import { opentelemetry } from '../src/index'
import { describe, expect, it } from 'vitest'

describe('Vafast OpenTelemetry Plugin', () => {
	it('should create OpenTelemetry middleware', () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'test-app',
			instrumentations: []
		})

		expect(telemetryMiddleware).toBeDefined()
		expect(typeof telemetryMiddleware).toBe('function')
	})

	it('should process requests through OpenTelemetry middleware', async () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'test-app',
			instrumentations: []
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/',
					handler: () => 'Hello, OpenTelemetry!'
				})
			])
		)

		// 应用中间件
		const wrappedFetch = (req: Request) => {
			return telemetryMiddleware(req, () => app.fetch(req))
		}

		const res = await wrappedFetch(new Request('http://localhost/'))
		const data = await res.text()

		expect(data).toBe('Hello, OpenTelemetry!')
		expect(res.status).toBe(200)
	})

	it('should handle errors in OpenTelemetry middleware', async () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'test-app',
			instrumentations: []
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'GET',
					path: '/error',
					handler: () => {
						throw new Error('Test error')
					}
				})
			])
		)

		// 应用中间件
		const wrappedFetch = (req: Request) => {
			return telemetryMiddleware(req, () => app.fetch(req))
		}

		// 测试错误处理 - OpenTelemetry 中间件应该能够处理错误
		const result = await wrappedFetch(new Request('http://localhost/error'))
		// 如果中间件正确处理了错误，我们应该得到一个响应而不是抛出异常
		expect(result).toBeDefined()
	})

	it('should work with custom service name', () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'custom-service',
			instrumentations: []
		})

		expect(telemetryMiddleware).toBeDefined()
	})

	it('should work with instrumentations', () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'test-app',
			instrumentations: []
		})

		expect(telemetryMiddleware).toBeDefined()
	})

	it('should handle different HTTP methods', async () => {
		const telemetryMiddleware = opentelemetry({
			serviceName: 'test-app',
			instrumentations: []
		})

		const app = new Server(
			defineRoutes([
				defineRoute({
					method: 'POST',
					path: '/',
					handler: () => json({ message: 'POST request' })
				}),
				defineRoute({
					method: 'PUT',
					path: '/',
					handler: () => json({ message: 'PUT request' })
				})
			])
		)

		// 应用中间件
		const wrappedFetch = (req: Request) => {
			return telemetryMiddleware(req, () => app.fetch(req))
		}

		const postRes = await wrappedFetch(
			new Request('http://localhost/', { method: 'POST' })
		)
		const postData = await postRes.json()
		expect(postData.message).toBe('POST request')

		const putRes = await wrappedFetch(
			new Request('http://localhost/', { method: 'PUT' })
		)
		const putData = await putRes.json()
		expect(putData.message).toBe('PUT request')
	})
})
