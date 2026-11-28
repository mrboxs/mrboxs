import { createMiddleware } from '@tanstack/react-start'

export const evlogRequest = createMiddleware().server(
	async ({ request, next }) => {
		const { isOrpcRequest, requestLogger } = await import('#/lib/evlog.server')
		const log = requestLogger(request)
		if (isOrpcRequest(request)) return next({ context: { log } })

		try {
			const result = await next({ context: { log } })
			log.emit({ status: result.response.status })
			return result
		} catch (error) {
			log.emit({ status: error instanceof Response ? error.status : 500 })
			throw error
		}
	}
)

export const evlogErrorHandler = createMiddleware()
	.middleware([evlogRequest])
	.server(async ({ context, next }) => {
		try {
			return await next()
		} catch (error) {
			const { structuredErrorResponse } = await import('#/lib/evlog.server')
			const response = structuredErrorResponse(error, context.log)
			if (response) return response
			throw error
		}
	})
