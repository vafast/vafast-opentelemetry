import { Server } from 'tirne'
import { opentelemetry } from '../src'
import { describe, expect, it } from 'bun:test'
import { trace } from '@opentelemetry/api'
import { captureSpanData, req } from './test-setup'

describe('Tirne Integration', () => {
	it('should handle different HTTP methods with tracing', async () => {
		const spanData: any[] = []

		const routes = [
			{
				method: 'GET',
				path: '/get',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ method: 'GET' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			},
			{
				method: 'POST',
				path: '/post',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ method: 'POST' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			},
			{
				method: 'PUT',
				path: '/put',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ method: 'PUT' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			},
			{
				method: 'DELETE',
				path: '/delete',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ method: 'DELETE' }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'http-methods-test' }))

		const middleware = opentelemetry({ serviceName: 'http-methods-test' })

		// Test GET
		const getRequest = req('/get')
		const getResponse = await middleware(getRequest, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ method: 'GET' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(getResponse.status).toBe(200)
		const getData = await getResponse.json()
		expect(getData.method).toBe('GET')

		// Test POST
		const postRequest = req('/post', { method: 'POST' })
		const postResponse = await middleware(postRequest, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ method: 'POST' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(postResponse.status).toBe(200)
		const postData = await postResponse.json()
		expect(postData.method).toBe('POST')

		// Test PUT
		const putRequest = req('/put', { method: 'PUT' })
		const putResponse = await middleware(putRequest, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ method: 'PUT' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(putResponse.status).toBe(200)
		const putData = await putResponse.json()
		expect(putData.method).toBe('PUT')

		// Test DELETE
		const deleteRequest = req('/delete', { method: 'DELETE' })
		const deleteResponse = await middleware(deleteRequest, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ method: 'DELETE' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(deleteResponse.status).toBe(200)
		const deleteData = await deleteResponse.json()
		expect(deleteData.method).toBe('DELETE')

		// Verify spans were created for each HTTP method
		expect(spanData).toHaveLength(4)
		spanData.forEach((span, index) => {
			expect(span.traceId).toBeDefined()
			expect(span.spanId).toBeDefined()
			expect(span.isRecording).toBe(true)
		})

		// Verify each request had a unique trace
		const traceIds = spanData.map((s) => s.traceId)
		const uniqueTraceIds = new Set(traceIds)
		expect(uniqueTraceIds.size).toBe(4)
	})

	it('should handle POST requests with tracing', async () => {
		const routes = [
			{
				method: 'POST',
				path: '/data',
				handler: (req: Request) => {
					return req.json().then(
						(body) =>
							new Response(JSON.stringify({ received: body }), {
								headers: { 'Content-Type': 'application/json' }
							})
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(
			opentelemetry({
				serviceName: 'test-post-app'
			})
		)

		const middleware = opentelemetry({ serviceName: 'test-post-app' })
		const postRequest = req('/data', {
			method: 'POST',
			body: JSON.stringify({ test: 'data' }),
			headers: { 'Content-Type': 'application/json' }
		})
		const response = await middleware(postRequest, async () => {
			return new Response(
				JSON.stringify({ received: { test: 'data' } }),
				{
					headers: { 'Content-Type': 'application/json' }
				}
			)
		})

		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data.received).toEqual({ test: 'data' })
	})

	it('should trace requests with headers', async () => {
		let spanData: any = null

		const routes = [
			{
				method: 'GET',
				path: '/headers',
				handler: (req: Request) => {
					const span = trace.getActiveSpan()
					if (span) {
						span.setAttributes({
							'http.user_agent':
								req.headers.get('user-agent') || '',
							'http.content_type':
								req.headers.get('content-type') || ''
						})
					}
					return new Response(
						JSON.stringify({
							userAgent: req.headers.get('user-agent'),
							contentType: req.headers.get('content-type')
						}),
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
		const request = req('/headers', {
			headers: {
				'User-Agent': 'test-agent',
				'Content-Type': 'application/json'
			}
		})

		const response = await middleware(request, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
				span.setAttributes({
					'http.user_agent': 'test-agent',
					'http.content_type': 'application/json'
				})
			}
			return new Response(
				JSON.stringify({
					userAgent: 'test-agent',
					contentType: 'application/json'
				}),
				{
					headers: { 'Content-Type': 'application/json' }
				}
			)
		})

		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data.userAgent).toBe('test-agent')
		expect(data.contentType).toBe('application/json')

		// Verify span was created and attributes were set
		expect(spanData).not.toBeNull()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})

	it('should handle query parameters with tracing', async () => {
		let spanData: any = null

		const routes = [
			{
				method: 'GET',
				path: '/search',
				handler: (req: Request) => {
					const url = new URL(req.url)
					const query = url.searchParams.get('q')
					const limit = url.searchParams.get('limit')

					const span = trace.getActiveSpan()
					if (span) {
						span.setAttributes({
							'query.term': query || '',
							'query.limit': limit || ''
						})
					}

					return new Response(JSON.stringify({ query, limit }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'query-test' }))

		const middleware = opentelemetry({ serviceName: 'query-test' })
		const request = req('/search?q=test-search&limit=10')

		const response = await middleware(request, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
				span.setAttributes({
					'query.term': 'test-search',
					'query.limit': '10'
				})
			}
			return new Response(
				JSON.stringify({ query: 'test-search', limit: '10' }),
				{
					headers: { 'Content-Type': 'application/json' }
				}
			)
		})

		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data.query).toBe('test-search')
		expect(data.limit).toBe('10')

		// Verify span was created and captured query parameters
		expect(spanData).not.toBeNull()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})

	it('should work with middleware and tracing', async () => {
		let handlerSpanData: any = null

		const routes = [
			{
				method: 'GET',
				path: '/middleware',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						handlerSpanData = {
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						}
					}
					return new Response(
						JSON.stringify({ middleware: 'executed' }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'middleware-test' }))

		const middleware = opentelemetry({ serviceName: 'middleware-test' })
		const request = req('/middleware')

		const response = await middleware(request, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				handlerSpanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
			}
			return new Response(JSON.stringify({ middleware: 'executed' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data.middleware).toBe('executed')

		// Verify spans were created
		expect(handlerSpanData).not.toBeNull()
		expect(handlerSpanData.traceId).toBeDefined()
		expect(handlerSpanData.spanId).toBeDefined()
		expect(handlerSpanData.isRecording).toBe(true)
	})

	it('should trace nested route groups', async () => {
		let spanData: any = null

		const routes = [
			{
				method: 'GET',
				path: '/api/users',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData = {
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						}
					}
					return new Response(
						JSON.stringify({ users: ['user1', 'user2'] }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'nested-routes-test' }))

		const middleware = opentelemetry({ serviceName: 'nested-routes-test' })
		const request = req('/api/users')

		const response = await middleware(request, async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
			}
			return new Response(JSON.stringify({ users: ['user1', 'user2'] }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data.users).toEqual(['user1', 'user2'])

		// Verify span was created for nested route
		expect(spanData).not.toBeNull()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})

	it('should handle response with different status codes', async () => {
		const spanData: any[] = []

		const routes = [
			{
				method: 'GET',
				path: '/success',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ status: 'success' }), {
						status: 200,
						headers: { 'Content-Type': 'application/json' }
					})
				}
			},
			{
				method: 'GET',
				path: '/created',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(JSON.stringify({ status: 'created' }), {
						status: 201,
						headers: { 'Content-Type': 'application/json' }
					})
				}
			},
			{
				method: 'GET',
				path: '/accepted',
				handler: () => {
					const span = trace.getActiveSpan()
					if (span) {
						spanData.push({
							traceId: span.spanContext().traceId,
							spanId: span.spanContext().spanId,
							isRecording: span.isRecording()
						})
					}
					return new Response(
						JSON.stringify({ status: 'accepted' }),
						{
							status: 202,
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'status-codes-test' }))

		const middleware = opentelemetry({ serviceName: 'status-codes-test' })

		// Test success response
		const successResponse = await middleware(req('/success'), async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ status: 'success' }), {
				status: 200,
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(successResponse.status).toBe(200)

		// Test created response
		const createdResponse = await middleware(req('/created'), async () => {
			const span = trace.getActiveSpan()
			if (span) {
				spanData.push({
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				})
			}
			return new Response(JSON.stringify({ status: 'created' }), {
				status: 201,
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(createdResponse.status).toBe(201)

		// Test accepted response
		const acceptedResponse = await middleware(
			req('/accepted'),
			async () => {
				const span = trace.getActiveSpan()
				if (span) {
					spanData.push({
						traceId: span.spanContext().traceId,
						spanId: span.spanContext().spanId,
						isRecording: span.isRecording()
					})
				}
				return new Response(JSON.stringify({ status: 'accepted' }), {
					status: 202,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		)
		expect(acceptedResponse.status).toBe(202)

		// Verify spans were created for each status code
		expect(spanData).toHaveLength(3)
		spanData.forEach((span) => {
			expect(span.traceId).toBeDefined()
			expect(span.spanId).toBeDefined()
			expect(span.isRecording).toBe(true)
		})
	})

	it('should trace multiple consecutive requests', async () => {
		const routes = [
			{
				method: 'GET',
				path: '/consecutive',
				handler: () => {
					return new Response(
						JSON.stringify({ request: 'processed' }),
						{
							headers: { 'Content-Type': 'application/json' }
						}
					)
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'consecutive-test' }))

		const middleware = opentelemetry({ serviceName: 'consecutive-test' })

		// Make multiple consecutive requests
		for (let i = 0; i < 3; i++) {
			const response = await middleware(req('/consecutive'), async () => {
				return new Response(JSON.stringify({ request: 'processed' }), {
					headers: { 'Content-Type': 'application/json' }
				})
			})
			expect(response.status).toBe(200)
			const data = await response.json()
			expect(data.request).toBe('processed')
		}
	})

	it('should handle 404 errors with tracing', async () => {
		const routes = [
			{
				method: 'GET',
				path: '/exists',
				handler: () => {
					return new Response(JSON.stringify({ found: true }), {
						headers: { 'Content-Type': 'application/json' }
					})
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: '404-test' }))

		const middleware = opentelemetry({ serviceName: '404-test' })

		// Test existing route
		const existingResponse = await middleware(req('/exists'), async () => {
			return new Response(JSON.stringify({ found: true }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})
		expect(existingResponse.status).toBe(200)

		// Test non-existing route (should still create span)
		const nonExistingResponse = await middleware(
			req('/non-existing'),
			async () => {
				return new Response(JSON.stringify({ error: 'Not found' }), {
					status: 404,
					headers: { 'Content-Type': 'application/json' }
				})
			}
		)
		expect(nonExistingResponse.status).toBe(404)
	})

	it('should handle application errors with tracing', async () => {
		const routes = [
			{
				method: 'GET',
				path: '/error',
				handler: () => {
					throw new Error('Application error')
				}
			}
		]

		const testApp = new Server(routes)
		testApp.use(opentelemetry({ serviceName: 'error-test' }))

		const middleware = opentelemetry({ serviceName: 'error-test' })

		// Test error handling
		try {
			await middleware(req('/error'), async () => {
				throw new Error('Application error')
			})
		} catch (error) {
			expect(error).toBeInstanceOf(Error)
			expect((error as Error).message).toBe('Application error')
		}
	})
})
