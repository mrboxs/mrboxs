import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/reference/$')({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const { openApiHandler } = await import('#/orpc/handlers')
				const { response } = await openApiHandler.handle(request, {
					prefix: '/api/reference',
				})
				response.headers.set('Cache-Control', 'no-store')
				return response
			},
		},
	},
})
