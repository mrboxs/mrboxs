import { createFileRoute } from '@tanstack/react-router'

import { evlogRequest } from '#/lib/evlog-middleware'

export const Route = createFileRoute('/api/reference/$')({
	server: {
		middleware: [evlogRequest],
		handlers: {
			ANY: async ({ request, context }) => {
				context.log.set({ action: 'openapi.request' })
				const { openApiHandler } = await import('#/orpc/handlers')
				const { response, matched } = await openApiHandler.handle(request, {
					prefix: '/api/reference',
					context: {},
				})

				context.log.set({ openapi: { matched } })
				if (!matched) {
					const { createError } = await import('evlog')
					throw createError({
						status: 404,
						code: 'OPENAPI_ROUTE_NOT_FOUND',
						message: 'API endpoint not found',
						why: 'No API reference endpoint matches this request.',
						fix: 'Check the path and HTTP method in the API reference.',
						link: '/api/reference',
					})
				}

				response.headers.set('Cache-Control', 'no-store')
				return response
			},
		},
	},
})
