import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link } from '@tanstack/react-router'

import { BlogError, BlogPending } from '#/components/blog/blog-feedback'

export const Route = createFileRoute('/blog/')({
	loader: async ({ context }) => {
		await context.queryClient.query(
			context.orpc.blog.list.queryOptions({
				input: {},
				retry: false,
				staleTime: 30_000,
			})
		)
	},
	head: () => ({ meta: [{ title: 'Blog | MrBoxs' }] }),
	headers: () => ({ 'Cache-Control': 'no-store' }),
	pendingComponent: BlogPending,
	errorComponent: BlogError,
	component: BlogListPage,
})

function BlogListPage() {
	const { orpc } = Route.useRouteContext()
	const { data: posts } = useSuspenseQuery(
		orpc.blog.list.queryOptions({ input: {}, retry: false, staleTime: 30_000 })
	)

	return (
		<main
			id="main-content"
			className="mx-auto max-w-3xl space-y-6 px-4 pt-20 pb-12"
		>
			<Link to="/" className="underline">
				Beranda
			</Link>
			<h1>Blog</h1>
			<p>{posts.length} tulisan</p>
			{posts.length === 0 ? (
				<p>Belum ada tulisan yang dipublikasikan.</p>
			) : (
				<ul className="space-y-6">
					{posts.map((post) => (
						<li key={post.slug} className="space-y-2">
							<h2>
								<Link
									to="/blog/$slug"
									params={{ slug: post.slug }}
									className="underline"
								>
									{post.title}
								</Link>
							</h2>
							<p>
								{post.author.name} ·{' '}
								<time dateTime={post.publishedAt}>{post.publishedAt}</time>
							</p>
							<p>{post.description}</p>
							<p>Tags: {post.tags.join(', ') || '—'}</p>
						</li>
					))}
				</ul>
			)}
		</main>
	)
}
