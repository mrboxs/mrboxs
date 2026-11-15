import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/blog/assets/$slug/$')({
	server: {
		handlers: {
			ANY: async ({ request, params }) => {
				const { handleBlogAssetRequest } =
					await import('#/lib/blog-assets.server')
				return handleBlogAssetRequest(request, params.slug, params._splat ?? '')
			},
		},
	},
})
