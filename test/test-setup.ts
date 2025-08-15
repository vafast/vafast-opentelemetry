import { trace } from '@opentelemetry/api'

// Test utility to capture span data
export interface CapturedSpan {
	name?: string
	traceId: string
	spanId: string
	parentSpanId?: string
	attributes?: Record<string, any>
	events?: Array<{ name: string; attributes?: Record<string, any> }>
	status?: { code: number; message?: string }
	isRecording: boolean
}

export let capturedSpans: CapturedSpan[] = []

export const captureSpanData = (spanName?: string): CapturedSpan | null => {
	const span = trace.getActiveSpan()
	if (!span) return null

	const context = span.spanContext()
	const captured: CapturedSpan = {
		name: spanName,
		traceId: context.traceId,
		spanId: context.spanId,
		isRecording: span.isRecording()
	}

	capturedSpans.push(captured)
	return captured
}

export const resetCapturedSpans = () => {
	capturedSpans = []
}

export const req = (path: string, options?: RequestInit) =>
	new Request(`http://localhost${path}`, options)

// Global setup for tests
import { beforeEach, afterEach } from 'bun:test'

beforeEach(() => {
	resetCapturedSpans()
})

afterEach(async () => {
	// Clean up any active spans
	const activeSpan = trace.getActiveSpan()
	if (activeSpan) {
		activeSpan.end()
	}
	resetCapturedSpans()
})
