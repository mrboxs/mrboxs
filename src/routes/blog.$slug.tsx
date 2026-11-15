import { useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, Link, notFound } from '@tanstack/react-router'

import { ORPCError } from '@orpc/client'

import {
	BlogError,
	BlogNotFound,
	BlogPending,
} from '#/components/blog/blog-feedback'

export const Route = createFileRoute('/blog/$slug')({
	loader: async ({ context, params }) => {
		try {
			await context.queryClient.query(
				context.orpc.blog.getBySlug.queryOptions({
					input: { params: { slug: params.slug } },
					retry: false,
					staleTime: 30_000,
				})
			)
		} catch (error) {
			if (
				error instanceof ORPCError &&
				(error.code === 'NOT_FOUND' || error.code === 'BAD_REQUEST')
			) {
				notFound({ throw: true })
			}
			throw error
		}
	},
	head: () => ({ meta: [{ title: 'Tulisan | MrBoxs' }] }),
	headers: () => ({ 'Cache-Control': 'no-store' }),
	pendingComponent: BlogPending,
	notFoundComponent: BlogNotFound,
	errorComponent: BlogError,
	component: BlogDetailPage,
})

function BlogDetailPage() {
	const { slug } = Route.useParams()
	const { orpc } = Route.useRouteContext()
	const { data: post } = useSuspenseQuery(
		orpc.blog.getBySlug.queryOptions({
			input: { params: { slug } },
			retry: false,
			staleTime: 30_000,
		})
	)

	return (
		<main
			id="main-content"
			className="mx-auto max-w-3xl space-y-4 px-4 pt-20 pb-12"
		>
			<Link to="/blog" className="underline">
				Kembali ke daftar tulisan
			</Link>
			<article className="space-y-4">
				<h1>{post.title}</h1>
				<p>{post.description}</p>
				<p>
					{post.author.name} ·{' '}
					<time dateTime={post.publishedAt}>{post.publishedAt}</time>
				</p>
				<p>Tags: {post.tags.join(', ') || '—'}</p>
				<p className="wrap-anywhere">Cover: {post.cover.src.path}</p>
				<pre className="font-sans wrap-anywhere whitespace-pre-wrap">
					{post.body}
				</pre>
			</article>
		</main>
	)
}
