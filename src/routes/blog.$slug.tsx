import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { ORPCError } from '@orpc/client'

import {
	BlogError,
	BlogNotFound,
	BlogPending,
} from '#/components/blog/blog-feedback'
import { BlogPostToolbar } from '#/components/blog/blog-post-toolbar'
import { MarkdownRenderer } from '#/components/markdown-renderer'

export const Route = createFileRoute('/blog/$slug')({
	loader: async ({ context, params }) => {
		try {
			const post = await context.queryClient.query(
				context.orpc.blog.getBySlug.queryOptions({
					input: { params: { slug: params.slug } },
					retry: false,
					staleTime: 30_000,
				})
			)
			return { title: post.title, description: post.description }
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
	head: ({ loaderData }) => ({
		meta: [
			{ title: `${loaderData?.title ?? 'Blog'} | MrBoxs` },
			{ name: 'description', content: loaderData?.description },
		],
	}),
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
	const { data: posts, isPending: navigationPending } = useQuery(
		orpc.blog.list.queryOptions({ input: {}, retry: false, staleTime: 30_000 })
	)
	const postIndex = posts?.findIndex((item) => item.slug === slug) ?? -1
	const previous = postIndex > 0 ? posts?.[postIndex - 1] : undefined
	const next = postIndex >= 0 ? posts?.[postIndex + 1] : undefined

	return (
		<main id="main-content" className="overflow-x-clip pt-14">
			<div className="mx-auto w-full max-w-3xl">
				<div className="relative isolate border-x border-line">
					<div className="h-12" aria-hidden="true" />
					<article aria-labelledby="post-title">
						<div className="screen-line-bottom h-px" aria-hidden="true" />
						<BlogPostToolbar
							key={post.slug}
							post={post}
							previous={previous}
							next={next}
							loading={navigationPending}
						/>
						<div
							className="screen-line-bottom screen-line-top py-px"
							aria-hidden="true"
						>
							<div className="h-4" />
						</div>
						<h1
							id="post-title"
							className="screen-line-bottom px-4 text-4xl font-medium tracking-tight text-balance wrap-anywhere"
						>
							{post.title}
						</h1>
						<div className="px-4 pt-8 pb-5">
							<p className="mb-5 text-base/7 wrap-anywhere text-muted-foreground">
								{post.description}
							</p>
							<MarkdownRenderer
								slug={post.slug}
								content={post.body}
								assets={post.assets}
								prepared={post.prepared}
							/>
						</div>
						<div className="screen-line-top h-4" aria-hidden="true" />
					</article>
				</div>
				<div
					className="screen-line-bottom screen-line-top relative isolate border-x border-line"
					aria-hidden="true"
					data-slot="article-end"
				>
					<div className="stripe-divider h-12" />
				</div>
			</div>
		</main>
	)
}
