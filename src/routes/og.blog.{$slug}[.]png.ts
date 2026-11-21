import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/og/blog/{$slug}.png')({
	server: {
		handlers: {
			ANY: async ({ request, params }) => {
				const { handleOgRequest } = await import('#/lib/og/image.server')
				return handleOgRequest(request, params.slug)
			},
		},
	},
})
