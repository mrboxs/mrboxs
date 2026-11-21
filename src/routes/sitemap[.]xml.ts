import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/sitemap.xml')({
	server: {
		handlers: {
			ANY: async ({ request }) => {
				const { handleCrawlerRequest } = await import('#/lib/crawlers.server')
				return handleCrawlerRequest(request, 'sitemap')
			},
		},
	},
})
