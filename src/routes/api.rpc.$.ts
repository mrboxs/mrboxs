import { createFileRoute } from '@tanstack/react-router'

async function handle({ request }: { request: Request }) {
	const { rpcHandler } = await import('#/orpc/handlers')
	const { response, matched } = await rpcHandler.handle(request, {
		prefix: '/api/rpc',
		context: {},
	})

	const result = matched ? response : new Response('Not Found', { status: 404 })
	result.headers.set('Cache-Control', 'no-store')
	return result
}

export const Route = createFileRoute('/api/rpc/$')({
	server: {
		handlers: {
			ANY: handle,
		},
	},
})
