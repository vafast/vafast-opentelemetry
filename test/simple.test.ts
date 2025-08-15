import { opentelemetry } from '../src'
import { describe, expect, it } from 'bun:test'
import { trace } from '@opentelemetry/api'

describe('Simple Middleware Test', () => {
	it('should create and access span in middleware', async () => {
		let spanFound = false
		let spanData: any = null

		const middleware = opentelemetry({ serviceName: 'simple-test' })
		
		const request = new Request('http://localhost/test')
		const response = await middleware(request, async () => {
			// Inside the middleware execution context
			const span = trace.getActiveSpan()
			if (span) {
				spanFound = true
				spanData = {
					traceId: span.spanContext().traceId,
					spanId: span.spanContext().spanId,
					isRecording: span.isRecording()
				}
			}
			
			return new Response('OK')
		})

		expect(response.status).toBe(200)
		expect(spanFound).toBe(true)
		expect(spanData).toBeDefined()
		expect(spanData.traceId).toBeDefined()
		expect(spanData.spanId).toBeDefined()
		expect(spanData.isRecording).toBe(true)
	})
})
