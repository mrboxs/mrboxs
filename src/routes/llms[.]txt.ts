import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/llms.txt')({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const { handleCrawlerRequest } = await import('#/lib/crawlers.server')
				return handleCrawlerRequest(request, 'llms')
			},
		},
	},
})
