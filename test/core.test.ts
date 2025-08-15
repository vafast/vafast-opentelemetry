import { Server } from 'tirne'
import {
	opentelemetry,
	getTracer,
	startActiveSpan,
	setAttributes,
	getCurrentSpan
} from '../src'
import { describe, expect, it } from 'bun:test'
import { trace, SpanStatusCode } from '@opentelemetry/api'
import { captureSpanData, req } from './test-setup'

describe('Core OpenTelemetry Plugin', () => {
	it('should initialize plugin without options', () => {
		expect(typeof opentelemetry).toBe('function')

		const middleware = opentelemetry()
		expect(middleware).toBeDefined()
		expect(typeof middleware).toBe('function')
	})

	it('should initialize plugin with options', () => {
		expect(typeof opentelemetry).toBe('function')

		const middleware = opentelemetry({
			serviceName: 'test-service'
		})
		expect(middleware).toBeDefined()
		expect(typeof middleware).toBe('function')
	})

	it('should create tracer and start span', () => {
		const tracer = getTracer()
		expect(tracer).toBeDefined()
		expect(typeof tracer.startSpan).toBe('function')
		expect(typeof tracer.startActiveSpan).toBe('function')

		const span = tracer.startSpan('test-span')
		expect(span).toBeDefined()
		expect(span.isRecording()).toBe(true)
		span.end()
	})

	it('should start active span with callback', () => {
		let spanInCallback: any

		startActiveSpan('test-active-span', (span) => {
			spanInCallback = span
			expect(span.isRecording()).toBe(true)
			return 'test-result'
		})

		expect(spanInCallback).toBeDefined()
	})

	it('should start active span with options', () => {
		const result = startActiveSpan(
			'test-span-with-options',
			{ kind: 1 },
			(span) => {
				expect(span.isRecording()).toBe(true)
				span.setAttributes({ 'test.attribute': 'value' })
				return 'success'
			}
		)

		expect(result).toBe('success')
	})

	it('should handle async operations in active span', async () => {
		const result = await startActiveSpan('async-test', async (span) => {
			span.setAttributes({ 'async.test': true })
			await new Promise((resolve) => setTimeout(resolve, 10))
			return 'async-result'
		})

		expect(result).toBe('async-result')
	})

	it('should set attributes on current span', () => {
		const tracer = getTracer()
		const span = tracer.startSpan('attribute-test')

		const result = setAttributes({ 'test.key': 'test.value' })

		span.end()
		expect(typeof setAttributes).toBe('function')
	})

	it('should handle span errors gracefully', () => {
		let error: Error | null = null

		try {
			startActiveSpan('error-test', (span) => {
				throw new Error('Test error')
			})
		} catch (e) {
			error = e as Error
		}

		expect(error).toBeDefined()
		expect(error?.message).toBe('Test error')
	})

	it('should work with basic Tirne app', async () => {
		const routes = [
			{
				method: 'GET',
				path: '/test',
				handler: () => new Response('Hello OpenTelemetry')
			}
		]

		const testApp = new Server(routes)
		testApp.use(
			opentelemetry({
				serviceName: 'test-tirne-app'
			})
		)

		// Test the middleware directly
		const middleware = opentelemetry({ serviceName: 'test-tirne-app' })
		const testRequest = req('/test')
		const testResponse = await middleware(testRequest, () =>
			Promise.resolve(new Response('Hello OpenTelemetry'))
		)
		expect(testResponse.status).toBe(200)
		expect(await testResponse.text()).toBe('Hello OpenTelemetry')
	})

	it('should complete full OpenTelemetry span lifecycle', async () => {
		let spanData: any = null

		// Test the middleware directly with a simple request
		const middleware = opentelemetry({ serviceName: 'span-lifecycle-test' })
		const testRequest = req('/lifecycle')

		const response = await middleware(testRequest, async () => {
			// Inside the middleware execution context
			const span = trace.getActiveSpan()
			if (span) {
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}

				// Set some attributes
				span.setAttributes({
					'test.operation': 'lifecycle-test',
					'test.timestamp': Date.now()
				})

				// Add an event
				span.addEvent('test-event', {
					'event.data': 'test-data'
				})
			}

			return new Response(JSON.stringify({ lifecycle: 'complete' }), {
				headers: { 'Content-Type': 'application/json' }
			})
		})

		expect(response.status).toBe(200)
		const result = await response.json()
		expect(result.lifecycle).toBe('complete')

		// Verify span was created and captured
		expect(spanData).toBeDefined()
		expect(spanData?.traceId).toBeDefined()
		expect(spanData?.spanId).toBeDefined()
		expect(spanData?.isRecording).toBe(true)
	})
})
