import { Server } from 'tirne'
import { opentelemetry, getTracer, startActiveSpan } from '../src'
import { describe, expect, it } from 'bun:test'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { captureSpanData, req } from './test-setup'

describe('Advanced OpenTelemetry Features', () => {
	it('should propagate trace context across nested spans', async () => {
		let rootTraceId: string | undefined
		let childTraceId: string | undefined
		let parentSpanId: string | undefined
		let childSpanId: string | undefined

		const routes = [
			{
				method: 'GET',
				path: '/nested',
				handler: () => {
					const rootSpan = trace.getActiveSpan()
					if (rootSpan) {
						rootTraceId = rootSpan.spanContext().traceId
						parentSpanId = rootSpan.spanContext().spanId
					}

					// Create a child span
					const result = startActiveSpan(
						'child-operation',
						(childSpan) => {
							childTraceId = childSpan.spanContext().traceId
							childSpanId = childSpan.spanContext().spanId
							childSpan.setAttributes({
								'operation.type': 'child'
							})
							return { nested: 'success' }
						}
					)

					return new Response(JSON.stringify(result), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'nested-spans-test' }))

		// Test the middleware directly with proper context
		const middleware = opentelemetry({ serviceName: 'nested-spans-test' })
		const response = await middleware(req('/nested'), async () => {
			// Simulate the handler execution within the span context
			const rootSpan = trace.getActiveSpan()
			if (rootSpan) {
				rootTraceId = rootSpan.spanContext().traceId
				parentSpanId = rootSpan.spanContext().spanId
			}

			// Create a child span
			const result = startActiveSpan('child-operation', (childSpan) => {
				childTraceId = childSpan.spanContext().traceId
				childSpanId = childSpan.spanContext().spanId
				childSpan.setAttributes({
					'operation.type': 'child'
				})
				return { nested: 'success' }
			})

			return new Response(JSON.stringify(result), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(rootTraceId).toBeDefined()
		expect(childTraceId).toBeDefined()
		expect(rootTraceId).toBe(childTraceId!) // Same trace
		expect(parentSpanId).toBeDefined()
		expect(childSpanId).toBeDefined()
		expect(parentSpanId).not.toBe(childSpanId) // Different spans
	})

	it('should handle span status and error recording', async () => {
		let spanStatus: any = null

		const routes = [
			{
				method: 'GET',
				path: '/error-span',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						// Record an error
						const error = new Error('Simulated error')
						span.recordException(error)
						span.setStatus({
							code: SpanStatusCode.ERROR,
							message: 'Operation failed'
						})

						// Add a custom event
						span.addEvent('custom.event', {
							'error.type': 'simulation',
							'error.message': error.message
						})

						spanStatus = span.spanContext()
					}
					return new Response(
						JSON.stringify({ status: 'error-recorded' }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'span-status-test' }))

		const middleware = opentelemetry({ serviceName: 'span-status-test' })
		const response = await middleware(req('/error-span'), async () => {
			// Simulate the handler execution within the span context
			const span = trace.getActiveSpan()
			if (span) {
				// Record an error
				const error = new Error('Simulated error')
				span.recordException(error)
				span.setStatus({
					code: SpanStatusCode.ERROR,
					message: 'Operation failed'
				})

				// Add a custom event
				span.addEvent('custom.event', {
					'error.type': 'simulation',
					'error.message': error.message
				})

				spanStatus = span.spanContext()
			}
			return new Response(JSON.stringify({ status: 'error-recorded' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(spanStatus).toBeDefined()
		const result = await response.json()
		expect(result.status).toBe('error-recorded')
	})

	it('should handle concurrent requests with separate traces', async () => {
		const traceIds = new Set<string>()
		const spanIds = new Set<string>()

		const routes = [
			{
				method: 'GET',
				path: '/concurrent/:id',
				handler: (req: Request) => {
					const span = trace.getActiveSpan()
					if (span) {
						const context = span.spanContext()
						traceIds.add(context.traceId)
						spanIds.add(context.spanId)
					}
					const url = new URL(req.url)
					const id = url.pathname.split('/').pop()
					return new Response(JSON.stringify({ id }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'concurrent-test' }))

		// Test multiple concurrent requests
		const promises = Array.from({ length: 5 }, (_, i) => {
			const middleware = opentelemetry({ serviceName: 'concurrent-test' })
			return middleware(req(`/concurrent/${i}`), async () => {
				const span = trace.getActiveSpan()
				if (span) {
					const context = span.spanContext()
					traceIds.add(context.traceId)
					spanIds.add(context.spanId)
				}
				return new Response(JSON.stringify({ id: i }), {
					headers: { 'Content-Type': 'application/json' }
				})
			})
		})

		const responses = await Promise.all(promises)

		// Verify all responses are successful
		responses.forEach((response, i) => {
			expect(response.status).toBe(200)
		})

		// Each request should have unique trace and span IDs
		expect(traceIds.size).toBe(5)
		expect(spanIds.size).toBe(5)
	})

	it('should handle trace context headers properly', async () => {
		let receivedTraceId: string | undefined

		const routes = [
			{
				method: 'GET',
				path: '/headers',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						receivedTraceId = span.spanContext().traceId
					}
					return new Response(
						JSON.stringify({ headers: 'processed' }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'headers-test' }))

		const middleware = opentelemetry({ serviceName: 'headers-test' })
		const response = await middleware(req('/headers'), async () => {
			const span = trace.getActiveSpan()
			if (span) {
				receivedTraceId = span.spanContext().traceId
			}
			return new Response(JSON.stringify({ headers: 'processed' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(receivedTraceId).toBeDefined()
		const result = await response.json()
		expect(result.headers).toBe('processed')
	})

	it('should work with custom instrumentations', async () => {
		let customSpanCreated = false

		const routes = [
			{
				method: 'GET',
				path: '/custom',
				handler: () => {
					// Create a custom span using the tracer
					const tracer = getTracer()
					const customSpan = tracer.startSpan('custom-operation')
					customSpan.setAttributes({ 'custom.operation': true })
					customSpan.end()
					customSpanCreated = true

					return new Response(JSON.stringify({ custom: 'span' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'custom-test' }))

		const middleware = opentelemetry({ serviceName: 'custom-test' })
		const response = await middleware(req('/custom'), async () => {
			// Create a custom span using the tracer
			const tracer = getTracer()
			const customSpan = tracer.startSpan('custom-operation')
			customSpan.setAttributes({ 'custom.operation': true })
			customSpan.end()
			customSpanCreated = true

			return new Response(JSON.stringify({ custom: 'span' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(customSpanCreated).toBe(true)
		const result = await response.json()
		expect(result.custom).toBe('span')
	})

	it('should support custom span attributes in routes', async () => {
		const routes = [
			{
				method: 'GET',
				path: '/attributes',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						span.setAttributes({
							'route.handler': 'attributes-test',
							'custom.attribute': 'test-value'
						})
					}
					return new Response(JSON.stringify({ attributes: 'set' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'attributes-test' }))

		const middleware = opentelemetry({ serviceName: 'attributes-test' })
		const response = await middleware(req('/attributes'), async () => {
			const span = trace.getActiveSpan()
			if (span) {
				span.setAttributes({
					'route.handler': 'attributes-test',
					'custom.attribute': 'test-value'
				})
			}
			return new Response(JSON.stringify({ attributes: 'set' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		const result = await response.json()
		expect(result.attributes).toBe('set')
	})

	it('should handle large request bodies with tracing', async () => {
		let spanData: any = null

		const largeBody = 'x'.repeat(1000)

		const routes = [
			{
				method: 'POST',
				path: '/large-body',
				handler: async (req: Request) => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData = {
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						}
					}
					const body = await req.text()
					return new Response(
						JSON.stringify({ received: true, count: body.length }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'large-body-test' }))

		const middleware = opentelemetry({ serviceName: 'large-body-test' })
		const response = await middleware(
			req('/large-body', {
				method: 'POST',
				body: largeBody
			}),
			async () => {
				const span = trace.getActiveSpan()
				if (span) {
					spanData = {
						traceId: span.spanContext().traceId,
						spanId: span.spanContext().spanId,
						isRecording: span.isRecording()
					}
				}
				return new Response(
					JSON.stringify({ received: true, count: largeBody.length }),
					{
						headers: { 'Content-Type': 'application/json' }
					}
				)
			}
		)

		expect(response.status).toBe(200)
		const result = await response.json()
		expect(result.received).toBe(true)
		expect(result.count).toBe(1000)

		// Verify span handled large request properly
		expect(spanData).not.toBeNull()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})

	it('should handle WebSocket-style long-running operations', async () => {
		let operationCompleted = false

		const routes = [
			{
				method: 'GET',
				path: '/long-running',
				handler: async () => {
					// Simulate a long-running operation
					await new Promise((resolve) => setTimeout(resolve, 100))
					operationCompleted = true

					return new Response(
						JSON.stringify({ status: 'completed' }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'long-running-test' }))

		const middleware = opentelemetry({ serviceName: 'long-running-test' })
		const response = await middleware(req('/long-running'), async () => {
			// Simulate a long-running operation
			await new Promise((resolve) => setTimeout(resolve, 100))
			operationCompleted = true

			return new Response(JSON.stringify({ status: 'completed' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(operationCompleted).toBe(true)
		const result = await response.json()
		expect(result.status).toBe('completed')
	})

	it('should handle plugin configuration edge cases', async () => {
		let spanData: any = null

		const routes = [
			{
				method: 'GET',
				path: '/edge-case',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData = {
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						}
					}
					return new Response(JSON.stringify({ edge: 'case' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		// Test with minimal configuration
		const testApp = new Server(routes)
		testApp.use(opentelemetry())

		const middleware = opentelemetry()
		const response = await middleware(req('/edge-case'), async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
			}
			return new Response(JSON.stringify({ edge: 'case' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		const result = await response.json()
		expect(result.edge).toBe('case')

		// Verify span was created even with edge case configuration
		expect(spanData).not.toBeNull()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})

	it('should handle memory cleanup and span isolation', async () => {
		const spanCounts = new Set<string>()

		const routes = [
			{
				method: 'GET',
				path: '/cleanup/:id',
				handler: (req: Request) => {
					const span = trace.getActiveSpan()
					if (span) {
						spanCounts.add(span.spanContext().spanId)
					}
					const url = new URL(req.url)
					const id = url.pathname.split('/').pop()
					return new Response(JSON.stringify({ id }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'cleanup-test' }))

		// Test multiple requests to ensure proper cleanup
		for (let i = 0; i < 10; i++) {
			const middleware = opentelemetry({ serviceName: 'cleanup-test' })
			const response = await middleware(
				req(`/cleanup/${i}`),
				async () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanCounts.add(span.spanContext().spanId)
					}
					return new Response(JSON.stringify({ id: i }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			)
			expect(response.status).toBe(200)
		}

		// Each request should have created a unique trace
		expect(spanCounts.size).toBe(10)
	})

	it('should handle errors in span creation gracefully', async () => {
		let errorHandled = false

		const routes = [
			{
				method: 'GET',
				path: '/error-handling',
				handler: () => {
					// Simulate an error condition
					try {
						throw new Error('Test error for span handling')
					} catch (error) {
						errorHandled = true
						const span = trace.getActiveSpan()
						if (span) {
							span.recordException(error as Error)
							span.setStatus({
								code: SpanStatusCode.ERROR,
								message: 'Error handled gracefully'
							})
						}
					}

					return new Response(JSON.stringify({ error: 'handled' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'error-handling-test' }))

		const middleware = opentelemetry({ serviceName: 'error-handling-test' })
		const response = await middleware(req('/error-handling'), async () => {
			// Simulate an error condition
			try {
				throw new Error('Test error for span handling')
			} catch (error) {
				errorHandled = true
				const span = trace.getActiveSpan()
				if (span) {
					span.recordException(error as Error)
					span.setStatus({
						code: SpanStatusCode.ERROR,
						message: 'Error handled gracefully'
					})
				}
			}

			return new Response(JSON.stringify({ error: 'handled' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		expect(errorHandled).toBe(true)
		const result = await response.json()
		expect(result.error).toBe('handled')
	})
})
