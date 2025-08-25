import type { Middleware } from 'vafast'
import {
	trace,
	context as otelContext,
	propagation,
	SpanStatusCode,
	type ContextManager,
	type Context,
	type SpanOptions,
	type Span,
	type Attributes,
	TraceAPI,
	ProxyTracer,
	SpanKind
} from '@opentelemetry/api'

import { NodeSDK } from '@opentelemetry/sdk-node'

// @ts-ignore bun only
const headerHasToJSON = typeof new Headers().toJSON === 'function'

const parseNumericString = (message: string): number | null => {
	if (message.length < 16) {
		if (message.length === 0) return null

		const length = Number(message)
		if (Number.isNaN(length)) return null

		return length
	}

	// if 16 digit but less then 9,007,199,254,740,991 then can be parsed
	if (message.length === 16) {
		const number = Number(message)

		if (
			number.toString() !== message ||
			message.trim().length === 0 ||
			Number.isNaN(number)
		)
			return null

		return number
	}

	return null
}

type OpenTeleMetryOptions = NonNullable<
	ConstructorParameters<typeof NodeSDK>[0]
>

/**
 * Initialize OpenTelemetry SDK
 *
 * For best practice, you should be using preload OpenTelemetry SDK if possible
 * however, this is a simple way to initialize OpenTelemetry SDK
 */
export interface VafastOpenTelemetryOptions extends OpenTeleMetryOptions {
	contextManager?: ContextManager
}

export type ActiveSpanArgs<
	F extends (span: Span) => unknown = (span: Span) => unknown
> =
	| [name: string, fn: F]
	| [name: string, options: SpanOptions, fn: F]
	| [name: string, options: SpanOptions, context: Context, fn: F]

const createActiveSpanHandler = (fn: (span: Span) => unknown) =>
	function (span: Span) {
		try {
			const result = fn(span)

			// @ts-ignore
			if (result instanceof Promise || typeof result?.then === 'function')
				// @ts-ignore
				return result.then((result) => {
					if (span.isRecording()) span.end()

					return result
				})

			if (span.isRecording()) span.end()

			return result
		} catch (error) {
			if (!span.isRecording()) throw error

			const err = error as Error

			span.setStatus({
				code: SpanStatusCode.ERROR,
				message: err?.message
			})

			span.recordException(err)
			span.end()

			throw error
		}
	}

const createContext = (parent: Span) => ({
	getValue() {
		return parent
	},
	setValue() {
		return otelContext.active()
	},
	deleteValue() {
		return otelContext.active()
	}
})

const isNotEmpty = (obj?: Object) => {
	if (!obj) return false

	for (const x in obj) return true

	return false
}

export type Tracer = ReturnType<TraceAPI['getTracer']>
export type StartSpan = Tracer['startSpan']
export type StartActiveSpan = Tracer['startActiveSpan']

export const contextKeySpan = Symbol.for('OpenTelemetry Context Key SPAN')

export const getTracer = (): ReturnType<TraceAPI['getTracer']> => {
	const tracer = trace.getTracer('@vafast/vafast')

	return {
		...tracer,
		startSpan(name: string, options?: SpanOptions, context?: Context) {
			return tracer.startSpan(name, options, context)
		},
		startActiveSpan(...args: ActiveSpanArgs) {
			switch (args.length) {
				case 2:
					return tracer.startActiveSpan(
						args[0],
						createActiveSpanHandler(args[1])
					)

				case 3:
					return tracer.startActiveSpan(
						args[0],
						args[1],
						createActiveSpanHandler(args[2])
					)

				case 4:
					return tracer.startActiveSpan(
						args[0],
						args[1],
						args[2],
						createActiveSpanHandler(args[3])
					)
			}
		}
	}
}

export const startActiveSpan: StartActiveSpan = (...args: ActiveSpanArgs) => {
	const tracer = getTracer()

	switch (args.length) {
		case 2:
			return tracer.startActiveSpan(
				args[0],
				createActiveSpanHandler(args[1])
			)

		case 3:
			return tracer.startActiveSpan(
				args[0],
				args[1],
				createActiveSpanHandler(args[2])
			)

		case 4:
			return tracer.startActiveSpan(
				args[0],
				args[1],
				args[2],
				createActiveSpanHandler(args[3])
			)
	}
}

export const record = startActiveSpan

export const getCurrentSpan = (): Span | undefined => {
	const current: Span = otelContext
		.active()
		// @ts-ignore
		._currentContext?.get(contextKeySpan)

	return current
}

/**
 * Set attributes to the current span
 *
 * @returns boolean - whether the attributes are set or not
 */
export const setAttributes = (attributes: Attributes) => {
	return !!getCurrentSpan()?.setAttributes(attributes)
}

export const opentelemetry = ({
	serviceName = '@vafast/vafast',
	instrumentations,
	contextManager,
	...options
}: VafastOpenTelemetryOptions = {}): Middleware => {
	let tracer = trace.getTracer(serviceName)

	if (tracer instanceof ProxyTracer) {
		const sdk = new NodeSDK({
			...options,
			serviceName,
			instrumentations
		})

		sdk.start()

		tracer = trace.getTracer(serviceName)
	}

	// @ts-expect-error private property
	if (!otelContext._getContextManager?.() && contextManager)
		try {
			contextManager.enable()
			otelContext.setGlobalContextManager(contextManager)
		} catch {
			// Noop ContextManager
		}

	return async (req: Request, next: () => Promise<Response>) => {
		let headers
		if (headerHasToJSON) {
			// @ts-ignore bun only
			headers = req.headers.toJSON()
		} else {
			headers = Object.fromEntries(req.headers.entries())
		}

		const ctx = propagation.extract(otelContext.active(), headers)

		return tracer.startActiveSpan(
			'request',
			{ kind: SpanKind.SERVER },
			ctx,
			async (rootSpan) => {
				// Execute the next middleware/handler within the span context
				const response = await otelContext.with(
					trace.setSpan(ctx, rootSpan),
					async () => {
						try {
							// Execute the next middleware/handler
							const response = await next()

							// Set success status
							rootSpan.setStatus({
								code: SpanStatusCode.OK
							})

							// Set basic attributes
							const attributes: Record<string, string | number> =
								{
									'http.request.method': req.method,
									'url.path': new URL(req.url).pathname,
									'url.full': req.url,
									'http.response.status_code': response.status
								}

							// Add response body size if available
							if (response.body) {
								const clonedResponse = response.clone()
								const text = await clonedResponse.text()
								attributes['http.response.body.size'] =
									text.length
							}

							// Add request headers
							for (const [key, value] of req.headers.entries()) {
								if (key.toLowerCase() === 'user-agent') continue
								attributes[
									`http.request.header.${key.toLowerCase()}`
								] = value
							}

							// Add response headers
							for (const [
								key,
								value
							] of response.headers.entries()) {
								attributes[
									`http.response.header.${key.toLowerCase()}`
								] = value
							}

							rootSpan.setAttributes(attributes)

							return response
						} catch (error) {
							// Set error status
							rootSpan.setStatus({
								code: SpanStatusCode.ERROR,
								message:
									error instanceof Error
										? error.message
										: String(error)
							})

							if (error instanceof Error) {
								rootSpan.recordException(error)
							}

							throw error
						} finally {
							// Update span name with method and path
							const url = new URL(req.url)
							rootSpan.updateName(`${req.method} ${url.pathname}`)
							rootSpan.end()
						}
					}
				)

				return response
			}
		)
	}
}
