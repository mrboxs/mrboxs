import { useQuery, useSuspenseQuery } from '@tanstack/react-query'
import { createFileRoute, notFound } from '@tanstack/react-router'

import { useMemo } from 'react'

import { ORPCError } from '@orpc/client'

import {
	BlogError,
	BlogNotFound,
	BlogPending,
} from '#/components/blog/blog-feedback'
import { BlogPostToolbar } from '#/components/blog/blog-post-toolbar'
import { TOCMinimap } from '#/components/custom/toc-minimap'
import { MarkdownRenderer } from '#/components/markdown-renderer'
import { ContentImage } from '#/components/markdown-renderer/image'
import { articleHeadings } from '#/constants/headings'
import { useBlogNavigation } from '#/hooks/use-blog-navigation'
import { useBlogUpdates } from '#/hooks/use-blog-updates'
import { getPostAssetUrl } from '#/lib/blog'

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
	useBlogUpdates(post.cover.src.commit)
	const postIndex = posts?.findIndex((item) => item.slug === slug) ?? -1
	const previous = postIndex > 0 ? posts?.[postIndex - 1] : undefined
	const next = postIndex >= 0 ? posts?.[postIndex + 1] : undefined
	useBlogNavigation(previous, next)
	const tocItems = useMemo(
		() =>
			articleHeadings(post.body).map(({ id, title, depth }) => ({
				title,
				depth,
				url: `#${id}`,
			})),
		[post.body]
	)

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
						<div data-slot="post-reading" className="relative px-4 pt-8 pb-5">
							<p className="mb-5 text-base/7 wrap-anywhere text-muted-foreground">
								{post.description}
							</p>
							<div data-slot="post-cover" className="mb-6 aspect-video">
								<ContentImage
									src={getPostAssetUrl(post.cover.src)}
									alt={post.cover.alt}
									assets={post.assets}
									preview={false}
									loading="eager"
									fetchPriority="high"
									width={1200}
									height={675}
									className="aspect-video w-full rounded-xl"
								/>
							</div>
							{tocItems.length > 0 && (
								<div
									data-slot="toc-rail"
									className="mb-4 flex justify-end lg:pointer-events-none lg:absolute lg:inset-x-[calc((100%-100vw)/2)] lg:top-8 lg:bottom-5 lg:mb-0 lg:items-start lg:pr-2"
								>
									<TOCMinimap
										key={post.slug}
										items={tocItems}
										className="pointer-events-auto self-start lg:sticky"
									/>
								</div>
							)}
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
