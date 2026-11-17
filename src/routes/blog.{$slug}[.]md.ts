import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/blog/{$slug}.md')({
	server: {
		handlers: {
			ANY: async ({ request, params }) => {
				const { handleBlogMarkdownRequest } =
					await import('#/lib/blog-markdown.server')
				return handleBlogMarkdownRequest(request, params.slug)
			},
		},
	},
})
