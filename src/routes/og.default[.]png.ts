import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/og/default.png')({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const { handleOgRequest } = await import('#/lib/og/image.server')
				return handleOgRequest(request)
			},
		},
	},
})
