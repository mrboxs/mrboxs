import { createFileRoute } from '@tanstack/react-router'

async function handle({ request }: { request: Request }) {
	const { openApiHandler } = await import('#/orpc/handlers')
	const { response, matched } = await openApiHandler.handle(request, {
		prefix: '/api/reference',
		context: {},
	})

	const result = matched ? response : new Response('Not Found', { status: 404 })
	result.headers.set('Cache-Control', 'no-store')
	return result
}

export const Route = createFileRoute('/api/reference/$')({
	server: {
		handlers: {
			ANY: handle,
		},
	},
})
